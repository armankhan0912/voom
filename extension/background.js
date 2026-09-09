importScripts("config.js");

const SESSION_KEY = "voom-session";
const OVERLAY_STATES = new Set([
  "recording",
  "paused",
  "stopping",
]);

function emptySession() {
  return {
    recorderTabId: null,
    usingOffscreen: false,
    overlayTabId: null,
    sourceTabId: null,
    state: "idle",
    elapsedMs: 0,
  };
}

async function getSession() {
  const stored = await chrome.storage.session.get(SESSION_KEY);
  return { ...emptySession(), ...(stored[SESSION_KEY] ?? {}) };
}

async function setSession(patch) {
  const session = { ...(await getSession()), ...patch };
  await chrome.storage.session.set({ [SESSION_KEY]: session });
  await updateBadge(session.state);
  return session;
}

async function clearSession() {
  await chrome.storage.session.remove(SESSION_KEY);
  await updateBadge("idle");
}

async function updateBadge(state) {
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

function isInjectableUrl(url) {
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

async function tabExists(tabId) {
  if (tabId == null) return false;
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

async function injectOverlay(tabId) {
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["inject-overlay.js"],
    });
  } catch {
    // chrome://, Web Store, or tab gone.
  }
}

async function detachOverlay(tabId) {
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["remove-overlay.js"],
    });
  } catch {
    // Tab gone or restricted.
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function releaseOverlayCamera() {
  chrome.runtime.sendMessage({ type: "voom-release-camera" }).catch(() => {});
}

async function moveOverlayToTab(tabId) {
  const session = await getSession();
  if (tabId == null || tabId === session.recorderTabId) {
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

async function followActiveTab(tabId) {
  const session = await getSession();
  const hostOpen = session.usingOffscreen || (await tabExists(session.recorderTabId));
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

async function hasOffscreenDocument() {
  if (!chrome.offscreen) {
    return false;
  }
  if (chrome.offscreen.hasDocument) {
    return chrome.offscreen.hasDocument();
  }
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  return contexts.length > 0;
}

async function closeLegacyRecorderTabs() {
  const base = chrome.runtime.getURL("recorder.html");
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => tab.id != null && tab.url && tab.url.startsWith(base))
      .map((tab) => chrome.tabs.remove(tab.id).catch(() => {})),
  );
}

async function closeRecorder() {
  if (chrome.offscreen?.closeDocument) {
    try {
      await chrome.offscreen.closeDocument();
    } catch {
      // No offscreen document.
    }
  }
  await closeLegacyRecorderTabs();
}

async function openRecorder(query) {
  await closeRecorder();
  const tab = await chrome.tabs.create({
    url: chrome.runtime.getURL("recorder.html") + (query ? `?${query}` : ""),
    active: false,
  });
  return { usingOffscreen: false, recorderTabId: tab.id ?? null };
}

async function recorderIsOpen(session) {
  if (session.usingOffscreen) {
    return hasOffscreenDocument();
  }
  return tabExists(session.recorderTabId);
}

async function beginRecording(message = {}) {
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
    state: "screen_selection",
    elapsedMs: 0,
  });

  const host = await openRecorder(params.toString());

  await setSession({
    recorderTabId: host.recorderTabId,
    usingOffscreen: host.usingOffscreen,
  });

  if (sourceTabId != null) {
    void chrome.scripting
      .executeScript({
        target: { tabId: sourceTabId },
        files: ["bridge.js"],
      })
      .catch(() => {});
    void chrome.tabs.update(sourceTabId, { active: true }).catch(() => {});
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

function sendToRecorder(action) {
  chrome.runtime
    .sendMessage({ type: "voom-recorder-control", action })
    .catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "voom-get-config") {
    sendResponse({ appUrl: VOOM_APP_URL });
    return;
  }

  if (message?.type === "voom-query-session") {
    void getSession().then(sendResponse);
    return true;
  }

  if (message?.type === "voom-begin") {
    void beginRecording(message).then(sendResponse).catch((caught) => {
      sendResponse({
        error: caught instanceof Error ? caught.message : "Could not start",
      });
    });
    return true;
  }

  if (message?.type === "voom-presign") {
    void presignUpload(message.contentType)
      .then(sendResponse)
      .catch((caught) => {
        sendResponse({
          error: caught instanceof Error ? caught.message : "Could not start upload",
        });
      });
    return true;
  }

  if (message?.type === "voom-complete") {
    void completeUpload(message)
      .then(sendResponse)
      .catch((caught) => {
        sendResponse({
          error: caught instanceof Error ? caught.message : "Could not finalize video",
        });
      });
    return true;
  }

  if (message?.type === "voom-upload") {
    uploadRecording(message)
      .then(sendResponse)
      .catch((caught) =>
        sendResponse({
          error: caught instanceof Error ? caught.message : "Upload failed",
        }),
      );
    return true;
  }

  if (message?.type === "voom-broadcast") {
    const payload = message.payload ?? {};
    void (async () => {
      await setSession({
        state: payload.state ?? "idle",
        elapsedMs: payload.elapsedMs ?? 0,
        ...(sender.tab?.id ? { recorderTabId: sender.tab.id } : {}),
      });
      chrome.runtime.sendMessage(payload).catch(() => {});
      if (!OVERLAY_STATES.has(payload.state)) {
        return;
      }
      const session = await ensureOverlay();
      if (session.overlayTabId != null) {
        chrome.tabs.sendMessage(session.overlayTabId, payload).catch(() => {});
      }
    })();
    return;
  }

  if (message?.type === "voom-overlay-ready") {
    sendToRecorder("sync");
    return;
  }

  if (message?.type === "voom-overlay-control") {
    sendToRecorder(message.action);
    return;
  }

  if (message?.type === "voom-choose-desktop") {
    void (async () => {
      const started = Date.now();
      let session = await getSession();
      while (session.recorderTabId == null && Date.now() - started < 2000) {
        await delay(50);
        session = await getSession();
      }

      const sources = ["screen", "window", "tab"];

      if (session.sourceTabId != null) {
        await chrome.tabs.update(session.sourceTabId, { active: true }).catch(() => {});
      }

      let targetTab = null;
      if (session.recorderTabId != null) {
        try {
          targetTab = await chrome.tabs.get(session.recorderTabId);
        } catch {
          targetTab = null;
        }
      }

      const streamId = await new Promise((resolve) => {
        const done = (id) => resolve(id || "");
        if (!chrome.desktopCapture?.chooseDesktopMedia) {
          done("");
          return;
        }
        // Bind the stream to the hidden recorder tab so getUserMedia can
        // consume it there. Targeting the website tab makes Chrome ask again.
        if (targetTab) {
          chrome.desktopCapture.chooseDesktopMedia(sources, targetTab, done);
        } else {
          chrome.desktopCapture.chooseDesktopMedia(sources, done);
        }
      });

      sendResponse({ streamId, unsupported: !chrome.desktopCapture?.chooseDesktopMedia });
    })().catch(() => sendResponse({ streamId: "", unsupported: true }));
    return true;
  }

  if (message?.type === "voom-prepare-overlay") {
    void (async () => {
      const session = await getSession();
      const tabId = session.sourceTabId ?? session.overlayTabId;
      if (tabId != null) {
        await chrome.tabs.update(tabId, { active: true }).catch(() => {});
        await moveOverlayToTab(tabId);
      }
    })();
    return;
  }

  if (message?.type === "voom-focus-page") {
    void (async () => {
      const session = await getSession();
      const focusId = session.sourceTabId ?? session.overlayTabId;
      if (focusId != null) {
        await chrome.tabs.update(focusId, { active: true }).catch(() => {});
      }
      await ensureOverlay();
    })();
    return;
  }

  if (message?.type === "voom-capture-cancelled") {
    void (async () => {
      await removeAllOverlays();
      await closeRecorder();
      await clearSession();
    })();
    return;
  }

  if (message?.type === "voom-remove-overlay") {
    void (async () => {
      await removeAllOverlays();
      const session = await getSession();
      await setSession({ overlayTabId: null, state: session.state });
    })();
    return;
  }
});

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === "voom-begin") {
    void beginRecording(message).then(sendResponse).catch((caught) => {
      sendResponse({
        error: caught instanceof Error ? caught.message : "Could not start",
      });
    });
    return true;
  }
  if (message?.type === "voom-query-session") {
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
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
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
      await removeAllOverlays();
      await clearSession();
      return;
    }
    if (tabId === session.overlayTabId) {
      await setSession({ overlayTabId: null });
    }
  })();
});

async function presignUpload(contentType) {
  const type = contentType?.startsWith("video/mp4") ? "video/mp4" : "video/webm";
  const presignResponse = await fetch(`${VOOM_APP_URL}/api/uploads/presign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: type }),
  });

  if (presignResponse.status === 401) {
    await chrome.tabs.create({ url: `${VOOM_APP_URL}/sign-in` });
    throw new Error("Sign in to Voom in the browser first");
  }

  if (!presignResponse.ok) {
    throw new Error("Could not start upload");
  }

  return presignResponse.json();
}

async function completeUpload(message) {
  const videoId = message.videoId;
  const failed = message.failed === true;

  const completeResponse = await fetch(
    `${VOOM_APP_URL}/api/videos/${videoId}/complete`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        failed ? { failed: true } : { duration: message.duration ?? 0 },
      ),
    },
  );

  if (completeResponse.status === 401) {
    await chrome.tabs.create({ url: `${VOOM_APP_URL}/sign-in` });
    throw new Error("Sign in to Voom in the browser first");
  }

  if (!completeResponse.ok) {
    throw new Error("Could not finalize video");
  }

  if (!failed) {
    await chrome.tabs.create({ url: `${VOOM_APP_URL}/voom/${videoId}`, active: true });
    await removeAllOverlays();
    void closeRecorder();
    void clearSession();
  }

  return completeResponse.json();
}

async function uploadRecording(message) {
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

void closeLegacyRecorderTabs();

async function reloadAppTabs() {
  const tabs = await chrome.tabs.query({
    url: ["http://localhost:3000/*", "http://127.0.0.1:3000/*"],
  });
  await Promise.all(
    tabs
      .filter((tab) => tab.id != null)
      .map((tab) => chrome.tabs.reload(tab.id).catch(() => {})),
  );
}

chrome.runtime.onInstalled.addListener(() => {
  void closeLegacyRecorderTabs();
  void reloadAppTabs();
});
