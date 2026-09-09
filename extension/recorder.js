const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const permissionPanel = document.getElementById("permission-panel");
const setupPanel = document.getElementById("setup-panel");
const livePanel = document.getElementById("live-panel");
const allowButton = document.getElementById("allow");
const startButton = document.getElementById("start");
const cameraEnabledInput = document.getElementById("camera-enabled");
const micEnabledInput = document.getElementById("mic-enabled");
const cameraDeviceSelect = document.getElementById("camera-device");
const micDeviceSelect = document.getElementById("mic-device");

/** @type {'idle' | 'permission_request' | 'setup' | 'screen_selection' | 'recording' | 'paused' | 'stopping' | 'completed' | 'error'} */
let state = "idle";

let cameraStream = null;
let micStream = null;
let displayStream = null;
let recordStream = null;
let recorder = null;
let pendingPresign = null;
const chunks = [];
let recordedMs = 0;
let segmentStartedAt = 0;
let tickId = 0;

function setError(message) {
  if (errorEl) errorEl.textContent = message ?? "";
}

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function stopTracks(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function broadcast() {
  chrome.runtime
    .sendMessage({
      type: "voom-broadcast",
      payload: {
        type: "voom-ui-state",
        state,
        elapsedMs: currentElapsed(),
        cameraEnabled: Boolean(cameraEnabledInput?.checked),
        cameraDeviceId: cameraDeviceSelect?.value || "",
        micEnabled: Boolean(micEnabledInput?.checked),
      },
    })
    .catch(() => {});
}

function currentElapsed() {
  if (state === "recording") {
    return recordedMs + (Date.now() - segmentStartedAt);
  }

  return recordedMs;
}

function setState(next) {
  state = next;
  permissionPanel?.classList.toggle("hidden", next !== "idle" && next !== "permission_request" && next !== "error");
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

function fillSelect(select, devices, fallbackLabel) {
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
  stopTracks(micStream);
  micStream = null;

  if (!micEnabledInput?.checked) {
    return;
  }

  try {
    micStream = await Promise.race([
      voomGetLocalMic(),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("timeout")), 1500);
      }),
    ]);
  } catch {
    micStream = null;
  }

  micStream?.getAudioTracks().forEach((track) => {
    track.enabled = true;
  });

  if (!micStream?.getAudioTracks().length && micEnabledInput) {
    micEnabledInput.checked = false;
  }
}

function buildRecordStream() {
  const mixed = new MediaStream();
  displayStream?.getVideoTracks().forEach((track) => mixed.addTrack(track));

  if (micEnabledInput?.checked && micStream) {
    micStream.getAudioTracks().forEach((track) => mixed.addTrack(track));
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

function isCameraTrack(track) {
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

function isDisplayTrack(track) {
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

function assertDisplayStream(stream) {
  const track = stream?.getVideoTracks()?.[0];
  if (!isDisplayTrack(track)) {
    stream?.getTracks().forEach((item) => item.stop());
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

async function captureDisplay() {
  const fromBackground = await chrome.runtime
    .sendMessage({ type: "voom-choose-desktop" })
    .catch(() => null);

  if (fromBackground?.unsupported) {
    try {
      return await captureWithDisplayMedia();
    } catch (error) {
      if (error?.name === "NotAllowedError") {
        throw cancelError();
      }
      throw error;
    }
  }

  const streamId = typeof fromBackground?.streamId === "string" ? fromBackground.streamId : "";
  if (!streamId) {
    throw cancelError();
  }

  try {
    return assertDisplayStream(await getDesktopStream(streamId));
  } catch {
    throw new Error("Could not capture the selected screen.");
  }
}

function getDesktopStream(streamId) {
  const video = {
    chromeMediaSource: "desktop",
    chromeMediaSourceId: streamId,
  };

  if (typeof navigator.webkitGetUserMedia === "function") {
    return new Promise((resolve, reject) => {
      navigator.webkitGetUserMedia({ audio: false, video: { mandatory: video } }, resolve, (error) => {
        navigator.mediaDevices
          .getUserMedia({ audio: false, video })
          .then(resolve)
          .catch(() => reject(error));
      });
    });
  }

  return navigator.mediaDevices.getUserMedia({ audio: false, video });
}

function prefetchPresign() {
  pendingPresign = chrome.runtime
    .sendMessage({ type: "voom-presign", contentType: "video/webm" })
    .catch(() => null);
}

async function startRecording() {
  if (state === "recording" || state === "paused" || state === "screen_selection") {
    return;
  }

  setError("");
  setState("screen_selection");

  try {
    const micPromise = openMicIfNeeded();
    displayStream = await captureDisplay();
    await micPromise;
  } catch (error) {
    if (error?.name === "CancelError" || error?.message === "cancelled") {
      chrome.runtime.sendMessage({ type: "voom-capture-cancelled" }).catch(() => {});
      return;
    }
    chrome.runtime.sendMessage({ type: "voom-capture-cancelled" }).catch(() => {});
    return;
  }

  if (!displayStream?.getVideoTracks().length || !isDisplayTrack(displayStream.getVideoTracks()[0])) {
    displayStream?.getTracks().forEach((track) => track.stop());
    chrome.runtime.sendMessage({ type: "voom-capture-cancelled" }).catch(() => {});
    return;
  }

  recordStream = buildRecordStream();
  chunks.length = 0;
  recordedMs = 0;
  segmentStartedAt = Date.now();

  recorder = new MediaRecorder(recordStream, {
    mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm",
  });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.onerror = () => {
    setState("error");
    setError("Recording failed.");
    void stopRecording();
  };

  recorder.onstop = () => {
    void finalizeUpload();
  };

  displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (recorder && recorder.state !== "inactive") {
      void stopRecording();
    }
  });

  recorder.start(1000);
  setState("recording");
  startTicker();
  prefetchPresign();
  chrome.runtime.sendMessage({ type: "voom-focus-page" }).catch(() => {});
}

function pauseRecording() {
  if (!recorder || recorder.state !== "recording") {
    return;
  }

  recorder.pause();
  recordedMs += Date.now() - segmentStartedAt;
  window.clearInterval(tickId);
  setState("paused");
}

function resumeRecording() {
  if (!recorder || recorder.state !== "paused") {
    return;
  }

  recorder.resume();
  segmentStartedAt = Date.now();
  setState("recording");
  startTicker();
}

async function stopRecording() {
  if (state === "stopping" || state === "completed") {
    return;
  }

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
    recorder.stop();
    return;
  }

  await finalizeUpload();
}

async function finalizeUpload() {
  window.clearInterval(tickId);

  const blob = new Blob(chunks, { type: "video/webm" });
  chunks.length = 0;
  const duration = Math.max(1, Math.round(recordedMs / 1000));
  recordedMs = 0;

  stopTracks(displayStream);
  stopTracks(micStream);
  stopTracks(recordStream);
  displayStream = null;
  micStream = null;
  recordStream = null;
  recorder = null;

  if (blob.size === 0) {
    chrome.runtime.sendMessage({ type: "voom-remove-overlay" }).catch(() => {});
    setState("error");
    setError("Nothing was recorded.");
    return;
  }

  try {
    const result = await uploadFromRecorder(blob, duration);
    if (result?.error) {
      throw new Error(result.error);
    }
    setState("completed");
  } catch (caught) {
    chrome.runtime.sendMessage({ type: "voom-remove-overlay" }).catch(() => {});
    setState("error");
    setError(caught instanceof Error ? caught.message : "Upload failed.");
  }
}

async function uploadFromRecorder(blob, duration) {
  const contentType = "video/webm";
  let presign = await pendingPresign;
  pendingPresign = null;

  if (!presign || presign.error) {
    presign = await chrome.runtime.sendMessage({
      type: "voom-presign",
      contentType,
    });
  }

  if (!presign || presign.error) {
    throw new Error(presign?.error || "Could not start upload");
  }

  const putResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": presign.contentType },
  });

  if (!putResponse.ok) {
    await chrome.runtime.sendMessage({
      type: "voom-complete",
      videoId: presign.video.id,
      failed: true,
    });
    throw new Error("Upload to storage failed");
  }

  return chrome.runtime.sendMessage({
    type: "voom-complete",
    videoId: presign.video.id,
    duration,
  });
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

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "voom-recorder-control") {
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
});

window.addEventListener("beforeunload", () => {
  stopTracks(cameraStream);
  stopTracks(micStream);
  stopTracks(displayStream);
  stopTracks(recordStream);
  chrome.runtime.sendMessage({ type: "voom-remove-overlay" }).catch(() => {});
});

async function boot() {
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
  if (cameraDeviceId && cameraDeviceSelect) {
    const option = document.createElement("option");
    option.value = cameraDeviceId;
    option.textContent = "Camera";
    cameraDeviceSelect.replaceChildren(option);
    cameraDeviceSelect.value = cameraDeviceId;
  }

  broadcast();
  await startRecording();
}

void boot();
