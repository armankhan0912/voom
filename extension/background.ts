import { VOOM_APP_URL } from "./config";
import {
  RECORDER_PORT_NAME,
  type RecorderControlAction,
  type RecorderState,
  type VoomBeginMessage,
  type VoomRuntimeMessage,
  type VoomSession,
  type VoomUiState,
} from "./messages";
import { sendVoomMessage } from "./runtime";
import bridgePath from "./bridge.ts?script";
import injectOverlayPath from "./inject-overlay.ts?script";
import removeOverlayPath from "./remove-overlay.ts?script";

const SESSION_KEY = "voom-session";
const OVERLAY_STATES = new Set<RecorderState>([
  "recording",
  "paused",
  "stopping",
]);

/** Long-lived ports from recorder.html. Keeps the SW alive and carries Stop. */
const recorderPorts = new Set<chrome.runtime.Port>();

type SendResponse = (response?: unknown) => void;

type CompleteUploadInput = {
  videoId: string;
  duration?: number;
  failed?: boolean;
};

type AbortUploadInput = {
  videoId?: string;
};

type StartUploadResult = {
  video?: { id: string };
};

type PresignResult = {
  uploadUrl: string;
  contentType: string;
  video: { id: string };
};

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

function isVoomRuntimeMessage(message: unknown): message is VoomRuntimeMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof (message as { type: unknown }).type === "string" &&
    (message as { type: string }).type.startsWith("voom-")
  );
}

function emptySession(): VoomSession {
  return {
    recorderTabId: null,
    usingOffscreen: false,
    overlayTabId: null,
    sourceTabId: null,
    pendingStreamId: null,
    state: "idle",
    elapsedMs: 0,
    videoId: null,
    uploadSettled: false,
  };
}

async function getSession(): Promise<VoomSession> {
  const stored = await chrome.storage.session.get(SESSION_KEY);
  const raw = stored[SESSION_KEY];
  if (raw && typeof raw === "object") {
    return { ...emptySession(), ...(raw as Partial<VoomSession>) };
  }
  return emptySession();
}

async function setSession(patch: Partial<VoomSession>) {
  const session = { ...(await getSession()), ...patch };
  await chrome.storage.session.set({ [SESSION_KEY]: session });
  await updateBadge(session.state);
  return session;
}

async function clearSession() {
  await chrome.storage.session.remove(SESSION_KEY);
  await updateBadge("idle");
}

async function updateBadge(state: RecorderState) {
  if (state === "recording") {
    await chrome.action.setBadgeBackgroundColor({ color: "#e11d48" });
    await chrome.action.setBadgeText({ text: "REC" });
    return;
  }
  if (state === "paused") {
    await chrome.action.setBadgeBackgroundColor({ color: "#1a1a1a" });
    await chrome.action.setBadgeText({ text: "II" });
    return;
  }
  await chrome.action.setBadgeText({ text: "" });
}

function isInjectableUrl(url: string | undefined) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    if (
      parsed.hostname === "chrome.google.com" &&
      parsed.pathname.startsWith("/webstore")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function tabExists(tabId: number | null | undefined) {
  if (tabId == null) return false;
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

async function injectOverlay(tabId: number | null | undefined) {
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [injectOverlayPath],
    });
  } catch {
    // chrome://, Web Store, or tab gone.
  }
}

async function detachOverlay(tabId: number | null | undefined) {
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [removeOverlayPath],
    });
  } catch {
    // Tab gone or restricted.
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function releaseOverlayCamera() {
  void sendVoomMessage({ type: "voom-release-camera" }).catch(() => {});
}

async function moveOverlayToTab(tabId: number) {
  const session = await getSession();
  if (tabId === session.recorderTabId) {
    return;
  }

  if (session.overlayTabId != null && session.overlayTabId !== tabId) {
    releaseOverlayCamera();
    await delay(180);
    await detachOverlay(session.overlayTabId);
    await delay(120);
  } else if (session.overlayTabId == null) {
    await detachOverlay(tabId);
  }

  await injectOverlay(tabId);
  await setSession({ overlayTabId: tabId });
}

async function followActiveTab(tabId: number) {
  const session = await getSession();
  const hostOpen = await tabExists(session.recorderTabId);
  if (!hostOpen || !OVERLAY_STATES.has(session.state)) {
    return;
  }
  if (tabId === session.recorderTabId) {
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isInjectableUrl(tab.url)) {
      return;
    }
  } catch {
    return;
  }

  await moveOverlayToTab(tabId);
}

async function closeLegacyRecorderTabs() {
  const base = chrome.runtime.getURL("recorder.html");
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => tab.id != null && tab.url?.startsWith(base))
      .map((tab) => chrome.tabs.remove(tab.id as number).catch(() => {})),
  );
}

async function closeRecorder() {
  await closeLegacyRecorderTabs();
}

async function activateRecorderTab() {
  const session = await getSession();
  if (session.recorderTabId == null) {
    return;
  }
  await chrome.tabs.update(session.recorderTabId, { active: true }).catch(() => {});
}

async function openRecorder(query: string, openerTabId: number | null) {
  await closeRecorder();
  const tab = await chrome.tabs.create({
    url: chrome.runtime.getURL("recorder.html") + (query ? `?${query}` : ""),
    active: true,
    ...(openerTabId != null ? { openerTabId } : {}),
  });
  return { usingOffscreen: false as const, recorderTabId: tab.id ?? null };
}

async function recorderIsOpen(session: VoomSession) {
  return tabExists(session.recorderTabId);
}

async function chooseDesktopForRecorder(senderTab: chrome.tabs.Tab | undefined) {
  let targetTab: chrome.tabs.Tab | null = senderTab ?? null;
  if (!targetTab) {
    const session = await getSession();
    if (session.recorderTabId != null) {
      try {
        targetTab = await chrome.tabs.get(session.recorderTabId);
      } catch {
        targetTab = null;
      }
    }
  }

  return new Promise<string>((resolve) => {
    const done = (id: string) => resolve(id || "");
    if (!chrome.desktopCapture?.chooseDesktopMedia || !targetTab) {
      done("");
      return;
    }
    chrome.desktopCapture.chooseDesktopMedia(
      ["screen", "window", "tab"],
      targetTab,
      done,
    );
  });
}

async function beginRecording(message: Partial<VoomBeginMessage> = {}) {
  const session = await getSession();

  if (await recorderIsOpen(session)) {
    const live =
      session.state === "recording" ||
      session.state === "paused" ||
      session.state === "stopping";
    if (live) {
      const focusId = session.overlayTabId ?? session.sourceTabId;
      if (focusId != null) {
        await chrome.tabs.update(focusId, { active: true }).catch(() => {});
      }
      return { error: "already_recording" };
    }

    sendToRecorder("start");
    return { ok: true };
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const sourceTabId = activeTab?.id ?? null;

  const params = new URLSearchParams();
  params.set("autostart", "1");
  params.set("camera", message.cameraEnabled === false ? "0" : "1");
  params.set("mic", message.micEnabled === false ? "0" : "1");
  if (message.cameraDeviceId) {
    params.set("cameraDeviceId", String(message.cameraDeviceId));
  }
  if (message.micDeviceId) {
    params.set("micDeviceId", String(message.micDeviceId));
  }

  await removeAllOverlays();

  await setSession({
    recorderTabId: null,
    usingOffscreen: false,
    overlayTabId: null,
    sourceTabId,
    pendingStreamId: null,
    state: "screen_selection",
    elapsedMs: 0,
    videoId: null,
    uploadSettled: false,
  });

  const host = await openRecorder(params.toString(), sourceTabId);

  await setSession({
    recorderTabId: host.recorderTabId,
    usingOffscreen: host.usingOffscreen,
  });

  if (sourceTabId != null) {
    void chrome.scripting
      .executeScript({
        target: { tabId: sourceTabId },
        files: [bridgePath],
      })
      .catch(() => {});
  }

  return { ok: true };
}

async function ensureOverlay() {
  const session = await getSession();
  if (!OVERLAY_STATES.has(session.state)) {
    return session;
  }

  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  let tabId = active?.id ?? null;
  if (tabId == null || tabId === session.recorderTabId) {
    tabId = session.sourceTabId;
  }
  if (tabId == null) {
    return session;
  }
  if (session.overlayTabId === tabId) {
    return session;
  }

  await moveOverlayToTab(tabId);
  return getSession();
}

async function removeAllOverlays() {
  const session = await getSession();
  await detachOverlay(session.overlayTabId);
  await detachOverlay(session.sourceTabId);
}

function sendToRecorder(action: RecorderControlAction) {
  const message: VoomRuntimeMessage = { type: "voom-recorder-control", action };
  let posted = false;

  for (const port of recorderPorts) {
    try {
      port.postMessage(message);
      posted = true;
    } catch {
      recorderPorts.delete(port);
    }
  }

  if (posted) {
    return;
  }

  void sendVoomMessage(message).catch((error: unknown) => {
    console.warn(
      "[voom] recorder control did not arrive",
      action,
      errorMessage(error, String(error)),
    );
  });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== RECORDER_PORT_NAME) {
    return;
  }

  recorderPorts.add(port);
  port.onDisconnect.addListener(() => {
    recorderPorts.delete(port);
  });

  // Re-deliver Stop if the SW restarted after the overlay already asked to stop.
  void getSession().then((session) => {
    if (session.state === "stopping") {
      try {
        port.postMessage({ type: "voom-recorder-control", action: "stop" });
      } catch {
        recorderPorts.delete(port);
      }
    }
  });
});

function handleRuntimeMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
): boolean | void {
  if (!isVoomRuntimeMessage(message)) {
    return;
  }

  switch (message.type) {
    case "voom-get-config":
      sendResponse({ appUrl: VOOM_APP_URL });
      return;

    case "voom-query-session":
      void getSession().then(sendResponse);
      return true;

    case "voom-begin":
      void beginRecording(message)
        .then(sendResponse)
        .catch((caught: unknown) => {
          sendResponse({ error: errorMessage(caught, "Could not start") });
        });
      return true;

    case "voom-upload-start":
      void startUpload(message.contentType)
        .then(sendResponse)
        .catch((caught: unknown) => {
          sendResponse({
            error: errorMessage(caught, "Could not start upload"),
          });
        });
      return true;

    case "voom-upload-multipart":
      void beginMultipart(message.videoId)
        .then(sendResponse)
        .catch((caught: unknown) => {
          sendResponse({
            error: errorMessage(caught, "Could not start multipart upload"),
          });
        });
      return true;

    case "voom-upload-object":
      void signObjectUpload(message.videoId)
        .then(sendResponse)
        .catch((caught: unknown) => {
          sendResponse({
            error: errorMessage(caught, "Could not start upload"),
          });
        });
      return true;

    case "voom-upload-part":
      void signUploadPart(message.videoId, message.partNumber)
        .then(sendResponse)
        .catch((caught: unknown) => {
          sendResponse({
            error: errorMessage(caught, "Could not sign upload part"),
          });
        });
      return true;

    case "voom-upload-finish":
      void finishUpload(message)
        .then(sendResponse)
        .catch((caught: unknown) => {
          sendResponse({
            error: errorMessage(caught, "Could not finalize video"),
            finalized: false,
          });
        });
      return true;

    case "voom-upload-abort":
      void abortUpload(message)
        .then(sendResponse)
        .catch((caught: unknown) => {
          sendResponse({
            error: errorMessage(caught, "Could not abort upload"),
          });
        });
      return true;

    case "voom-presign":
      void presignUpload(message.contentType)
        .then(sendResponse)
        .catch((caught: unknown) => {
          sendResponse({
            error: errorMessage(caught, "Could not start upload"),
          });
        });
      return true;

    case "voom-complete":
      void completeUpload(message)
        .then(sendResponse)
        .catch((caught: unknown) => {
          sendResponse({
            error: errorMessage(caught, "Could not finalize video"),
          });
        });
      return true;

    case "voom-upload":
      void uploadRecording(message)
        .then(sendResponse)
        .catch((caught: unknown) => {
          sendResponse({ error: errorMessage(caught, "Upload failed") });
        });
      return true;

    case "voom-broadcast": {
      const payload: VoomUiState = message.payload;
      void (async () => {
        await setSession({
          state: payload.state as RecorderState,
          elapsedMs: payload.elapsedMs ?? 0,
          ...(sender.tab?.id != null ? { recorderTabId: sender.tab.id } : {}),
        });
        void sendVoomMessage(payload).catch(() => {});
        if (!OVERLAY_STATES.has(payload.state as RecorderState)) {
          return;
        }
        const session = await ensureOverlay();
        if (session.overlayTabId != null) {
          chrome.tabs.sendMessage(session.overlayTabId, payload).catch(() => {});
        }
      })();
      return;
    }

    case "voom-overlay-ready":
      sendToRecorder("sync");
      return;

    case "voom-overlay-control":
      void (async () => {
        if (message.action === "stop") {
          const session = await setSession({ state: "stopping" });
          if (session.overlayTabId != null) {
            chrome.tabs
              .sendMessage(session.overlayTabId, {
                type: "voom-ui-state",
                state: "stopping",
                elapsedMs: session.elapsedMs,
              } satisfies VoomUiState)
              .catch(() => {});
          }
        }
        sendToRecorder(message.action);
      })();
      return;

    case "voom-choose-desktop":
      void (async () => {
        const streamId = await chooseDesktopForRecorder(sender.tab);
        sendResponse({
          streamId,
          unsupported: !chrome.desktopCapture?.chooseDesktopMedia,
        });
      })().catch(() => sendResponse({ streamId: "", unsupported: true }));
      return true;

    case "voom-activate-recorder":
      void activateRecorderTab().then(() => sendResponse({ ok: true }));
      return true;

    case "voom-prepare-overlay":
      void (async () => {
        const session = await getSession();
        const tabId = session.sourceTabId ?? session.overlayTabId;
        if (tabId != null) {
          await chrome.tabs.update(tabId, { active: true }).catch(() => {});
          await moveOverlayToTab(tabId);
        }
      })();
      return;

    case "voom-focus-page":
      void (async () => {
        const session = await getSession();
        const focusId = session.sourceTabId ?? session.overlayTabId;
        if (focusId != null) {
          await chrome.tabs.update(focusId, { active: true }).catch(() => {});
          await moveOverlayToTab(focusId);
        }
        sendToRecorder("sync");
      })();
      return;

    case "voom-capture-cancelled":
      void (async () => {
        await removeAllOverlays();
        await closeRecorder();
        await clearSession();
      })();
      return;

    case "voom-remove-overlay":
      void (async () => {
        await removeAllOverlays();
        const session = await getSession();
        await setSession({ overlayTabId: null, state: session.state });
      })();
      return;

    default:
      return;
  }
}

chrome.runtime.onMessage.addListener(handleRuntimeMessage);

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (!isVoomRuntimeMessage(message)) {
    return;
  }
  if (message.type === "voom-begin") {
    void beginRecording(message)
      .then(sendResponse)
      .catch((caught: unknown) => {
        sendResponse({ error: errorMessage(caught, "Could not start") });
      });
    return true;
  }
  if (message.type === "voom-query-session") {
    void getSession().then(sendResponse);
    return true;
  }
});

chrome.tabs.onActivated.addListener((info) => {
  void followActiveTab(info.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== "complete" && !info.url) {
    return;
  }
  void (async () => {
    const [active] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (active?.id !== tabId) {
      return;
    }
    await followActiveTab(tabId);
  })();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const session = await getSession();
    if (tabId === session.recorderTabId) {
      if (session.videoId && !session.uploadSettled) {
        await abortUpload({ videoId: session.videoId }).catch(() => {});
      }
      await removeAllOverlays();
      await clearSession();
      return;
    }
    if (tabId === session.overlayTabId) {
      await setSession({ overlayTabId: null });
    }
  })();
});

async function getClerkSessionToken() {
  try {
    const cookie = await chrome.cookies.get({
      url: VOOM_APP_URL,
      name: "__session",
    });
    return cookie?.value ?? null;
  } catch {
    return null;
  }
}

function isSignedOutResponse(response: Response) {
  if (response.status === 401) {
    return true;
  }

  if (response.status >= 300 && response.status < 400) {
    return true;
  }

  return response.headers.get("x-clerk-auth-status") === "signed-out";
}

async function voomApi<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = await getClerkSessionToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${VOOM_APP_URL}${path}`, {
    method: "POST",
    credentials: "include",
    redirect: "manual",
    headers,
    body: JSON.stringify(body ?? {}),
  });

  if (isSignedOutResponse(response)) {
    await chrome.tabs.create({ url: `${VOOM_APP_URL}/sign-in` });
    throw new Error("Sign in to Voom in the browser first");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === "string" && payload.error) {
        message = payload.error;
      }
    } catch {
      // Keep the status-aware message.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function startUpload(contentType: string | undefined) {
  const type = contentType?.startsWith("video/mp4") ? "video/mp4" : "video/webm";
  const result = await voomApi<StartUploadResult>("/api/uploads/start", {
    contentType: type,
  });
  await setSession({
    videoId: result.video?.id ?? null,
    uploadSettled: false,
  });
  return result;
}

async function beginMultipart(videoId: string) {
  if (!videoId) {
    throw new Error("Invalid upload");
  }

  return voomApi(`/api/uploads/${videoId}/multipart`);
}

async function signObjectUpload(videoId: string) {
  if (!videoId) {
    throw new Error("Invalid upload");
  }

  return voomApi(`/api/uploads/${videoId}/object`);
}

async function signUploadPart(videoId: string, partNumber: number) {
  if (!videoId || !Number.isInteger(partNumber)) {
    throw new Error("Invalid upload part");
  }

  return voomApi(`/api/uploads/${videoId}/part`, { partNumber });
}

async function finishUpload(
  message: Extract<VoomRuntimeMessage, { type: "voom-upload-finish" }>,
) {
  const videoId = message.videoId;
  if (!videoId || !Array.isArray(message.parts)) {
    throw new Error("Invalid upload finish request");
  }

  await voomApi(`/api/uploads/${videoId}/finish`, { parts: message.parts });
  await setSession({ videoId, uploadSettled: true });

  try {
    return await completeUpload({
      videoId,
      duration: message.duration ?? 0,
    });
  } catch (caught) {
    return {
      error: errorMessage(caught, "Could not finalize video"),
      finalized: true,
    };
  }
}

async function abortUpload(message: AbortUploadInput) {
  const session = await getSession();
  const videoId = message.videoId ?? session.videoId;

  if (!videoId || session.uploadSettled) {
    return { ok: true };
  }

  await setSession({ uploadSettled: true });
  return voomApi(`/api/uploads/${videoId}/abort`);
}

async function presignUpload(contentType: string | undefined) {
  const type = contentType?.startsWith("video/mp4") ? "video/mp4" : "video/webm";
  return voomApi<PresignResult>("/api/uploads/presign", { contentType: type });
}

async function showReadyVideo(videoId: string) {
  const watchUrl = `${VOOM_APP_URL}/voom/${videoId}`;
  const session = await getSession();
  const targetId = session.sourceTabId ?? session.overlayTabId;

  if (targetId != null && (await tabExists(targetId))) {
    await chrome.tabs.update(targetId, { url: watchUrl, active: true }).catch(() => {});
    return;
  }

  await chrome.tabs.create({ url: watchUrl, active: true });
}

function cleanupAfterComplete() {
  setTimeout(() => {
    void (async () => {
      await removeAllOverlays();
      await closeRecorder();
      await clearSession();
    })();
  }, 0);
}

async function completeUpload(message: CompleteUploadInput) {
  const videoId = message.videoId;
  const failed = message.failed === true;

  console.log("[voom] POST /api/videos/:id/complete", videoId, { failed });

  const payload = await voomApi<unknown>(
    `/api/videos/${videoId}/complete`,
    failed ? { failed: true } : { duration: message.duration ?? 0 },
  );

  if (!failed) {
    await setSession({ videoId, uploadSettled: true });
    console.log("[voom] status = ready, navigate/show video", videoId);
    await showReadyVideo(videoId);
    cleanupAfterComplete();
  }

  return payload;
}

async function uploadRecording(
  message: Extract<VoomRuntimeMessage, { type: "voom-upload" }>,
) {
  const blob = new Blob([message.buffer], {
    type: message.contentType || "video/webm",
  });
  const contentType = blob.type.startsWith("video/mp4")
    ? "video/mp4"
    : "video/webm";

  const presign = await presignUpload(contentType);

  const putResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": presign.contentType },
  });

  if (!putResponse.ok) {
    await completeUpload({ videoId: presign.video.id, failed: true });
    throw new Error("Upload to storage failed");
  }

  return completeUpload({
    videoId: presign.video.id,
    duration: message.duration ?? 0,
  });
}

async function reloadAppTabs() {
  const tabs = await chrome.tabs.query({
    url: [`${VOOM_APP_URL}/*`],
  });
  await Promise.all(
    tabs
      .filter((tab) => tab.id != null)
      .map((tab) => chrome.tabs.reload(tab.id as number).catch(() => {})),
  );
}

chrome.runtime.onInstalled.addListener(() => {
  void closeLegacyRecorderTabs();
  void reloadAppTabs();
});

chrome.runtime.onStartup.addListener(() => {
  void closeLegacyRecorderTabs();
});
