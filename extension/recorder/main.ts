import { RECORDER_PORT_NAME, type RecorderState, type VoomRuntimeMessage } from "../messages";
import { sendVoomMessage } from "../runtime";
import {
  createVoomUploadQueue,
  type MultipartStartResult,
  type SignedUploadUrl,
  type UploadStartResult,
  type VoomUploadQueue,
} from "../upload-queue";

const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const permissionPanel = document.getElementById("permission-panel");
const setupPanel = document.getElementById("setup-panel");
const livePanel = document.getElementById("live-panel");
const allowButton = document.getElementById("allow");
const startButton = document.getElementById("start");
const cameraEnabledInput = document.getElementById("camera-enabled") as HTMLInputElement | null;
const micEnabledInput = document.getElementById("mic-enabled") as HTMLInputElement | null;
const cameraDeviceSelect = document.getElementById("camera-device") as HTMLSelectElement | null;
const micDeviceSelect = document.getElementById("mic-device") as HTMLSelectElement | null;

type DesktopChoiceResult = {
  streamId?: string;
  unsupported?: boolean;
};

type UploadApiResult = {
  error?: string;
  finalized?: boolean;
};

type FinalizeError = Error & { finalized?: boolean };

type ChromeDesktopVideoConstraint = {
  chromeMediaSource: "desktop";
  chromeMediaSourceId: string;
};

let state: RecorderState = "idle";

let cameraStream: MediaStream | null = null;
let micStream: MediaStream | null = null;
let displayStream: MediaStream | null = null;
let recordStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let micSource: MediaStreamAudioSourceNode | null = null;
let micGain: GainNode | null = null;
let audioDest: MediaStreamAudioDestinationNode | null = null;
let keepAliveOsc: OscillatorNode | null = null;
let recorder: MediaRecorder | null = null;
let followMicTimer = 0;
let uploadQueue: VoomUploadQueue | null = null;
let pausedByUpload = false;
let bytesOnR2 = false;
let recordedMs = 0;
let segmentStartedAt = 0;
let tickId = 0;

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function setError(message: string) {
  if (errorEl) errorEl.textContent = message ?? "";
}

function setStatus(message: string) {
  if (statusEl) statusEl.textContent = message;
}

function stopTracks(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForAudioUnmute(stream: MediaStream) {
  const track = stream.getAudioTracks()[0];
  if (!track?.muted) {
    return;
  }

  await Promise.race([
    new Promise<void>((resolve) => {
      track.addEventListener("unmute", () => resolve(), { once: true });
    }),
    delay(1000),
  ]);
}

function closeAudioGraph() {
  micSource?.disconnect();
  micGain?.disconnect();
  micSource = null;
  micGain = null;
  try {
    keepAliveOsc?.stop();
  } catch {
    // Already stopped.
  }
  keepAliveOsc = null;
  if (audioContext && audioContext.state !== "closed") {
    void audioContext.close().catch(() => {});
  }
  audioContext = null;
  audioDest = null;
}

function closeMicCapture() {
  stopTracks(micStream);
  micStream = null;
  closeAudioGraph();
}

async function ensureAudioGraph() {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
    audioDest = audioContext.createMediaStreamDestination();
    const silent = audioContext.createGain();
    silent.gain.value = 0;
    keepAliveOsc = audioContext.createOscillator();
    keepAliveOsc.frequency.value = 20;
    keepAliveOsc.connect(silent);
    silent.connect(audioContext.destination);
    keepAliveOsc.start();
    audioContext.addEventListener("statechange", () => {
      if (audioContext?.state === "suspended") {
        void audioContext.resume();
      }
    });
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

function attachMicToGraph(stream: MediaStream) {
  if (!audioContext || !audioDest) {
    return;
  }

  micSource?.disconnect();
  micGain?.disconnect();
  micSource = audioContext.createMediaStreamSource(stream);
  micGain = audioContext.createGain();
  micGain.gain.value = 1;
  micSource.connect(micGain);
  micGain.connect(audioDest);
}

function rememberMicDevice(stream: MediaStream) {
  const track = stream.getAudioTracks()[0];
  const usedId = track?.getSettings().deviceId || "";
  if (!usedId || !micDeviceSelect) {
    return;
  }

  if (!Array.from(micDeviceSelect.options).some((option) => option.value === usedId)) {
    const option = document.createElement("option");
    option.value = usedId;
    option.textContent = track?.label || "Microphone";
    micDeviceSelect.append(option);
  }

  micDeviceSelect.value = usedId;
}

function watchMicTrack(stream: MediaStream) {
  stream.getAudioTracks().forEach((track) => {
    track.enabled = true;
    track.addEventListener("ended", () => {
      if (micStream !== stream) {
        return;
      }
      void followDefaultMic();
    });
  });
}

async function acquireDefaultMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { ideal: "default" },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
      video: false,
    });
    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    await waitForAudioUnmute(stream);
    if (stream.getAudioTracks().some((track) => track.readyState === "live")) {
      return stream;
    }
    stopTracks(stream);
  } catch {
    // Fall through to unconstrained capture.
  }

  const fallback = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });
  fallback.getAudioTracks().forEach((track) => {
    track.enabled = true;
  });
  await waitForAudioUnmute(fallback);
  if (!fallback.getAudioTracks().length) {
    stopTracks(fallback);
    throw new Error("Microphone is on, but Chrome did not provide an audio track.");
  }
  return fallback;
}

function broadcast() {
  void sendVoomMessage({
    type: "voom-broadcast",
    payload: {
      type: "voom-ui-state",
      state,
      elapsedMs: currentElapsed(),
      cameraEnabled: Boolean(cameraEnabledInput?.checked),
      cameraDeviceId: cameraDeviceSelect?.value || "",
      micEnabled: Boolean(micEnabledInput?.checked),
    },
  }).catch(() => {});
}

function currentElapsed() {
  if (state === "recording") {
    return recordedMs + (Date.now() - segmentStartedAt);
  }

  return recordedMs;
}

function setState(next: RecorderState) {
  state = next;
  permissionPanel?.classList.toggle(
    "hidden",
    next !== "idle" && next !== "permission_request" && next !== "error",
  );
  setupPanel?.classList.toggle("hidden", next !== "setup" && next !== "screen_selection");
  livePanel?.classList.toggle(
    "hidden",
    next !== "recording" && next !== "paused" && next !== "stopping",
  );

  if (next === "idle") {
    setStatus("Click Allow so Chrome can ask for camera and microphone.");
  } else if (next === "permission_request") {
    setStatus("Waiting for Chrome permission…");
  } else if (next === "setup") {
    setStatus("Choose devices, then start recording.");
  } else if (next === "screen_selection") {
    setStatus("Choose what to share in the Chrome dialog.");
  } else if (next === "recording") {
    setStatus("Recording. Keep this tab open.");
  } else if (next === "paused") {
    setStatus("Paused. Keep this tab open.");
  } else if (next === "stopping") {
    setStatus("Uploading…");
  } else if (next === "completed") {
    setStatus("Uploaded.");
  }

  broadcast();
}

function fillSelect(
  select: HTMLSelectElement | null,
  devices: MediaDeviceInfo[],
  fallbackLabel: string,
) {
  if (!select) {
    return;
  }

  const previous = select.value;
  select.replaceChildren();

  for (const device of devices) {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || fallbackLabel;
    select.append(option);
  }

  if (previous && devices.some((device) => device.deviceId === previous)) {
    select.value = previous;
  }
}

async function openMicIfNeeded() {
  if (!micEnabledInput?.checked) {
    closeMicCapture();
    return;
  }

  const previous = micStream;
  micStream = null;
  stopTracks(previous);
  await delay(80);

  const stream = await acquireDefaultMic();
  micStream = stream;
  rememberMicDevice(stream);
  watchMicTrack(stream);
  if (audioContext && audioDest) {
    attachMicToGraph(stream);
  }
}

async function followDefaultMic() {
  if (!micEnabledInput?.checked) {
    return;
  }

  if (
    state !== "screen_selection" &&
    state !== "recording" &&
    state !== "paused"
  ) {
    return;
  }

  try {
    await openMicIfNeeded();
  } catch {
    // Keep the current capture if the new default mic is unavailable.
  }
}

function scheduleFollowDefaultMic() {
  window.clearTimeout(followMicTimer);
  followMicTimer = window.setTimeout(() => {
    void followDefaultMic();
  }, 400);
}

function buildRecordStream() {
  const mixed = new MediaStream();
  displayStream?.getVideoTracks().forEach((track) => mixed.addTrack(track));

  if (micEnabledInput?.checked) {
    const mixedAudio = audioDest?.stream.getAudioTracks() ?? [];
    if (mixedAudio.length) {
      mixedAudio.forEach((track) => mixed.addTrack(track));
    } else {
      micStream?.getAudioTracks().forEach((track) => {
        track.enabled = true;
        mixed.addTrack(track);
      });
    }
  }

  return mixed;
}

function startTicker() {
  window.clearInterval(tickId);
  tickId = window.setInterval(() => {
    if (state === "recording") {
      broadcast();
    }
  }, 250);
}

function cancelError() {
  const error = new Error("cancelled");
  error.name = "CancelError";
  return error;
}

function isCancelled(error: unknown) {
  return errorName(error) === "CancelError" || errorMessage(error, "") === "cancelled";
}

function isCameraTrack(track: MediaStreamTrack | undefined) {
  if (!track || track.kind !== "video") {
    return false;
  }
  const settings = track.getSettings ? track.getSettings() : {};
  if (settings.facingMode) {
    return true;
  }
  const label = (track.label || "").toLowerCase();
  return /camera|webcam/.test(label);
}

function isDisplayTrack(track: MediaStreamTrack | undefined) {
  if (!track || track.kind !== "video" || isCameraTrack(track)) {
    return false;
  }
  const settings = track.getSettings ? track.getSettings() : {};
  if (settings.displaySurface) {
    return true;
  }
  const label = (track.label || "").toLowerCase();
  if (/screen|window|tab|display|desktop|monitor|web-contents-media-stream/.test(label)) {
    return true;
  }
  return !settings.deviceId;
}

function assertDisplayStream(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (!isDisplayTrack(track)) {
    stream.getTracks().forEach((item) => item.stop());
    throw new Error("not-display");
  }
  return stream;
}

async function captureWithDisplayMedia() {
  return assertDisplayStream(
    await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    }),
  );
}

function waitUntilVisible(timeoutMs = 4000) {
  if (document.visibilityState === "visible") {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) {
        return;
      }
      settled = true;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    function onChange() {
      if (document.visibilityState === "visible") {
        done();
      }
    }
    document.addEventListener("visibilitychange", onChange);
    window.setTimeout(done, timeoutMs);
  });
}

async function captureDisplay() {
  const fromBackground = await sendVoomMessage<DesktopChoiceResult>({
    type: "voom-choose-desktop",
  }).catch(() => null);

  if (fromBackground?.unsupported) {
    try {
      return await captureWithDisplayMedia();
    } catch (error) {
      if (errorName(error) === "NotAllowedError") {
        throw cancelError();
      }
      throw error;
    }
  }

  const streamId =
    typeof fromBackground?.streamId === "string" ? fromBackground.streamId : "";
  if (!streamId) {
    throw cancelError();
  }

  await sendVoomMessage({ type: "voom-activate-recorder" }).catch(() => null);
  await waitUntilVisible();

  try {
    return assertDisplayStream(await getDesktopStream(streamId));
  } catch {
    throw new Error("Could not capture the selected screen.");
  }
}

function getDesktopStream(streamId: string) {
  const video: ChromeDesktopVideoConstraint = {
    chromeMediaSource: "desktop",
    chromeMediaSourceId: streamId,
  };

  if (typeof navigator.webkitGetUserMedia === "function") {
    return new Promise<MediaStream>((resolve, reject) => {
      navigator.webkitGetUserMedia?.(
        { audio: false, video: { mandatory: video } },
        resolve,
        (error) => {
          navigator.mediaDevices
            .getUserMedia({ audio: false, video })
            .then(resolve)
            .catch(() => reject(error));
        },
      );
    });
  }

  return navigator.mediaDevices.getUserMedia({ audio: false, video });
}

function handleUploadBackpressure(active: boolean) {
  if (!recorder || state !== "recording") {
    return;
  }

  if (active && recorder.state === "recording") {
    recorder.pause();
    recordedMs += Date.now() - segmentStartedAt;
    window.clearInterval(tickId);
    pausedByUpload = true;
    return;
  }

  if (!active && pausedByUpload && recorder.state === "paused") {
    recorder.resume();
    segmentStartedAt = Date.now();
    startTicker();
    pausedByUpload = false;
  }
}

function createUploadQueue() {
  return createVoomUploadQueue({
    requestStart() {
      return sendVoomMessage<UploadStartResult>({
        type: "voom-upload-start",
        contentType: "video/webm",
      });
    },
    requestBeginMultipart(videoId) {
      return sendVoomMessage<MultipartStartResult>({
        type: "voom-upload-multipart",
        videoId,
      });
    },
    requestPartUrl(videoId, partNumber) {
      return sendVoomMessage<SignedUploadUrl>({
        type: "voom-upload-part",
        videoId,
        partNumber,
      });
    },
    requestPutUrl(videoId) {
      return sendVoomMessage<SignedUploadUrl>({
        type: "voom-upload-object",
        videoId,
      });
    },
    onBackpressure: handleUploadBackpressure,
  });
}

async function abortUploadSession() {
  const videoId = uploadQueue?.getState().videoId;
  if (!videoId) {
    return;
  }

  await sendVoomMessage({ type: "voom-upload-abort", videoId }).catch(() => {});
}

export async function startRecording() {
  if (state === "recording" || state === "paused" || state === "screen_selection") {
    return;
  }

  setError("");
  setState("screen_selection");

  try {
    await openMicIfNeeded();
    displayStream = await captureDisplay();
  } catch (error) {
    if (!isCancelled(error)) {
      console.error("[voom] recording failed", error);
    }
    stopTracks(displayStream);
    closeMicCapture();
    displayStream = null;
    void sendVoomMessage({ type: "voom-capture-cancelled" }).catch(() => {});
    return;
  }

  const displayTrack = displayStream?.getVideoTracks()[0];
  if (!displayStream?.getVideoTracks().length || !isDisplayTrack(displayTrack)) {
    displayStream?.getTracks().forEach((track) => track.stop());
    closeMicCapture();
    displayStream = null;
    void sendVoomMessage({ type: "voom-capture-cancelled" }).catch(() => {});
    return;
  }

  if (micEnabledInput?.checked && micStream) {
    try {
      await ensureAudioGraph();
      attachMicToGraph(micStream);
    } catch (error) {
      console.error("[voom] audio graph failed", error);
    }
  }

  recordStream = buildRecordStream();

  const audioTracks = recordStream.getAudioTracks();
  console.log(
    "[voom] micStream",
    Boolean(micStream),
    "micAudioTracks",
    micStream?.getAudioTracks().length ?? 0,
    "recordAudioTracks",
    audioTracks.length,
    "audioContext",
    audioContext?.state ?? "none",
  );

  if (micEnabledInput?.checked && audioTracks.length === 0) {
    console.error("[voom] microphone is on, but the combined recording stream has no audio track");
    stopTracks(displayStream);
    stopTracks(recordStream);
    closeMicCapture();
    void sendVoomMessage({ type: "voom-capture-cancelled" }).catch(() => {});
    return;
  }

  recordedMs = 0;
  segmentStartedAt = Date.now();
  pausedByUpload = false;
  bytesOnR2 = false;
  uploadQueue = createUploadQueue();

  recorder = new MediaRecorder(recordStream, {
    mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm",
  });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      if (state === "stopping") {
        console.log("[voom] final dataavailable", event.data.size);
      }
      uploadQueue?.enqueue(event.data);
    }
  };

  recorder.onerror = () => {
    setState("error");
    setError("Recording failed.");
    void stopRecording();
  };

  recorder.onstop = () => {
    // Let the final dataavailable from stop()/requestData land before flush.
    window.setTimeout(() => {
      void finalizeUpload();
    }, 100);
  };

  displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (recorder && recorder.state !== "inactive") {
      void stopRecording();
    }
  });

  try {
    await uploadQueue.begin();
  } catch (error) {
    console.error("[voom] upload session failed", error);
    stopTracks(displayStream);
    stopTracks(recordStream);
    closeMicCapture();
    displayStream = null;
    recordStream = null;
    recorder = null;
    uploadQueue = null;
    setState("error");
    setError(errorMessage(error, "Could not start upload"));
    void sendVoomMessage({ type: "voom-capture-cancelled" }).catch(() => {});
    return;
  }

  if (audioContext?.state === "suspended") {
    await audioContext.resume().catch(() => {});
  }

  recorder.start(1000);
  setState("recording");
  startTicker();
  void sendVoomMessage({ type: "voom-focus-page" }).catch(() => {});
}

export function pauseRecording() {
  if (state !== "recording") {
    return;
  }

  if (recorder?.state === "recording") {
    recorder.pause();
    recordedMs += Date.now() - segmentStartedAt;
    window.clearInterval(tickId);
  }

  pausedByUpload = false;
  setState("paused");
}

export function resumeRecording() {
  if (state !== "paused") {
    return;
  }

  if (recorder?.state === "paused") {
    recorder.resume();
    segmentStartedAt = Date.now();
    startTicker();
  }

  pausedByUpload = false;
  setState("recording");
}

export async function stopRecording() {
  if (state === "stopping" || state === "completed") {
    return;
  }

  console.log("[voom] STOP received");

  if (recorder?.state === "recording") {
    recordedMs += Date.now() - segmentStartedAt;
  }

  setState("stopping");
  window.clearInterval(tickId);

  if (recorder && recorder.state !== "inactive") {
    try {
      recorder.requestData();
    } catch {
      // Some engines do not implement requestData.
    }
    console.log("[voom] MediaRecorder.stop()");
    recorder.stop();
    return;
  }

  await finalizeUpload();
}

async function finalizeUpload() {
  window.clearInterval(tickId);

  const duration = Math.max(1, Math.round(recordedMs / 1000));
  recordedMs = 0;

  stopTracks(displayStream);
  stopTracks(recordStream);
  closeMicCapture();
  displayStream = null;
  recordStream = null;
  recorder = null;
  pausedByUpload = false;

  try {
    if (!uploadQueue) {
      throw new Error("Nothing was recorded.");
    }

    console.log("[voom] assembler flush + upload remaining data");
    const result = await uploadQueue.finish();
    bytesOnR2 = true;
    console.log("[voom] finish/complete R2", result.mode, result.videoId);

    const completed =
      result.mode === "put"
        ? await sendVoomMessage<UploadApiResult>({
            type: "voom-complete",
            videoId: result.videoId,
            duration,
          })
        : await sendVoomMessage<UploadApiResult>({
            type: "voom-upload-finish",
            videoId: result.videoId,
            parts: result.parts,
            duration,
          });

    if (completed?.error) {
      const error: FinalizeError = new Error(completed.error);
      error.finalized = completed.finalized === true || bytesOnR2;
      throw error;
    }

    setState("completed");
    console.log("[voom] video ready", result.videoId);
  } catch (caught) {
    const finalized = Boolean((caught as FinalizeError | undefined)?.finalized);
    if (!finalized) {
      await abortUploadSession();
    }
    void sendVoomMessage({ type: "voom-remove-overlay" }).catch(() => {});
    setState("error");
    setError(errorMessage(caught, "Upload failed."));
  }
}

allowButton?.addEventListener("click", () => {
  void startRecording();
});

startButton?.addEventListener("click", () => {
  void startRecording();
});

cameraEnabledInput?.addEventListener("change", () => {
  if (cameraDeviceSelect) {
    cameraDeviceSelect.disabled = !cameraEnabledInput.checked;
  }
  broadcast();
});

cameraDeviceSelect?.addEventListener("change", () => {
  broadcast();
});

micEnabledInput?.addEventListener("change", () => {
  if (micDeviceSelect) {
    micDeviceSelect.disabled = !micEnabledInput.checked;
  }
});

function isRecorderControl(
  message: unknown,
): message is Extract<VoomRuntimeMessage, { type: "voom-recorder-control" }> {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as { type: unknown }).type === "voom-recorder-control"
  );
}

function handleRecorderControl(message: unknown) {
  if (!isRecorderControl(message)) {
    return;
  }

  if (message.action === "sync") {
    broadcast();
    return;
  }

  if (message.action === "start") {
    void startRecording();
  }

  if (message.action === "pause") {
    pauseRecording();
  }

  if (message.action === "resume") {
    resumeRecording();
  }

  if (message.action === "stop") {
    void stopRecording();
  }
}

chrome.runtime.onMessage.addListener(handleRecorderControl);

function connectRecorderPort() {
  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connect({ name: RECORDER_PORT_NAME });
  } catch {
    return;
  }

  port.onMessage.addListener(handleRecorderControl);
  port.onDisconnect.addListener(() => {
    if (state === "completed" || state === "error") {
      return;
    }
    window.setTimeout(connectRecorderPort, 250);
  });
}

connectRecorderPort();

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener("devicechange", scheduleFollowDefaultMic);
}

window.addEventListener("beforeunload", () => {
  window.clearTimeout(followMicTimer);
  stopTracks(cameraStream);
  stopTracks(displayStream);
  stopTracks(recordStream);
  closeMicCapture();
  const videoId = uploadQueue?.getState().videoId;
  // Stopping means finish() is in flight — do not abort that upload.
  if (videoId && state !== "completed" && state !== "stopping" && !bytesOnR2) {
    void sendVoomMessage({ type: "voom-upload-abort", videoId }).catch(() => {});
  }
  if (state !== "stopping") {
    void sendVoomMessage({ type: "voom-remove-overlay" }).catch(() => {});
  }
});

async function boot() {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id != null) {
      await chrome.tabs.update(tab.id, { autoDiscardable: false });
    }
  } catch {
    // Recorder can still capture without this hint.
  }

  const params = new URLSearchParams(location.search);
  if (params.get("camera") === "0" && cameraEnabledInput) {
    cameraEnabledInput.checked = false;
    if (cameraDeviceSelect) cameraDeviceSelect.disabled = true;
  }
  if (params.get("mic") === "0" && micEnabledInput) {
    micEnabledInput.checked = false;
    if (micDeviceSelect) micDeviceSelect.disabled = true;
  }

  const cameraDeviceId = params.get("cameraDeviceId");
  const micDeviceId = params.get("micDeviceId");
  if (cameraDeviceId && cameraDeviceSelect) {
    const option = document.createElement("option");
    option.value = cameraDeviceId;
    option.textContent = "Camera";
    cameraDeviceSelect.replaceChildren(option);
    cameraDeviceSelect.value = cameraDeviceId;
  }
  if (micDeviceId && micDeviceSelect) {
    const option = document.createElement("option");
    option.value = micDeviceId;
    option.textContent = "Microphone";
    micDeviceSelect.replaceChildren(option);
    micDeviceSelect.value = micDeviceId;
  }

  broadcast();
  if (params.get("autostart") !== "0") {
    await startRecording();
  }
}

void boot();
