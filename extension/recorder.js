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
let uploadQueue = null;
let pausedByUpload = false;
let bytesOnR2 = false;
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

  const selectedDeviceId = micDeviceSelect?.value || "";
  const audio = selectedDeviceId
    ? { deviceId: { ideal: selectedDeviceId } }
    : true;

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio,
      video: false,
    });
  } catch {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch {
      throw new Error("Microphone is on, but Chrome did not provide an audio track.");
    }
  }

  if (!micStream?.getAudioTracks().length) {
    throw new Error("Microphone is on, but Chrome did not provide an audio track.");
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

function waitUntilVisible(timeoutMs = 4000) {
  if (document.visibilityState === "visible") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
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

  await chrome.runtime.sendMessage({ type: "voom-activate-recorder" }).catch(() => null);
  await waitUntilVisible();

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

function handleUploadBackpressure(active) {
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
      return chrome.runtime.sendMessage({
        type: "voom-upload-start",
        contentType: "video/webm",
      });
    },
    requestBeginMultipart(videoId) {
      return chrome.runtime.sendMessage({
        type: "voom-upload-multipart",
        videoId,
      });
    },
    requestPartUrl(videoId, partNumber) {
      return chrome.runtime.sendMessage({
        type: "voom-upload-part",
        videoId,
        partNumber,
      });
    },
    requestPutUrl(videoId) {
      return chrome.runtime.sendMessage({
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

  await chrome.runtime
    .sendMessage({ type: "voom-upload-abort", videoId })
    .catch(() => {});
}

async function startRecording() {
  if (state === "recording" || state === "paused" || state === "screen_selection") {
    return;
  }

  setError("");
  setState("screen_selection");

  try {
    displayStream = await captureDisplay();
    await openMicIfNeeded();
  } catch (error) {
    const cancelled = error?.name === "CancelError" || error?.message === "cancelled";
    if (!cancelled) {
      console.error("[voom] recording failed", error);
    }
    stopTracks(displayStream);
    stopTracks(micStream);
    displayStream = null;
    micStream = null;
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

  const audioTracks = recordStream.getAudioTracks();
  console.log("[voom] micStream", Boolean(micStream), "micAudioTracks", micStream?.getAudioTracks().length ?? 0, "recordAudioTracks", audioTracks.length);

  if (micEnabledInput?.checked && audioTracks.length === 0) {
    console.error("[voom] microphone is on, but the combined recording stream has no audio track");
    stopTracks(displayStream);
    stopTracks(micStream);
    stopTracks(recordStream);
    chrome.runtime.sendMessage({ type: "voom-capture-cancelled" }).catch(() => {});
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
      uploadQueue.enqueue(event.data);
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
    stopTracks(micStream);
    stopTracks(recordStream);
    displayStream = null;
    micStream = null;
    recordStream = null;
    recorder = null;
    uploadQueue = null;
    setState("error");
    setError(error instanceof Error ? error.message : "Could not start upload");
    chrome.runtime.sendMessage({ type: "voom-capture-cancelled" }).catch(() => {});
    return;
  }

  recorder.start(1000);
  setState("recording");
  startTicker();
  chrome.runtime.sendMessage({ type: "voom-focus-page" }).catch(() => {});
}

function pauseRecording() {
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

function resumeRecording() {
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

async function stopRecording() {
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
  stopTracks(micStream);
  stopTracks(recordStream);
  displayStream = null;
  micStream = null;
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
        ? await chrome.runtime.sendMessage({
            type: "voom-complete",
            videoId: result.videoId,
            duration,
          })
        : await chrome.runtime.sendMessage({
            type: "voom-upload-finish",
            videoId: result.videoId,
            parts: result.parts,
            duration,
          });

    if (completed?.error) {
      const error = new Error(completed.error);
      error.finalized = completed.finalized === true || bytesOnR2;
      throw error;
    }

    setState("completed");
    console.log("[voom] video ready", result.videoId);
  } catch (caught) {
    if (!caught?.finalized) {
      await abortUploadSession();
    }
    chrome.runtime.sendMessage({ type: "voom-remove-overlay" }).catch(() => {});
    setState("error");
    setError(caught instanceof Error ? caught.message : "Upload failed.");
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

function handleRecorderControl(message) {
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
}

chrome.runtime.onMessage.addListener(handleRecorderControl);

function connectRecorderPort() {
  let port;
  try {
    port = chrome.runtime.connect({ name: "voom-recorder" });
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

window.addEventListener("beforeunload", () => {
  stopTracks(cameraStream);
  stopTracks(micStream);
  stopTracks(displayStream);
  stopTracks(recordStream);
  const videoId = uploadQueue?.getState().videoId;
  // Stopping means finish() is in flight — do not abort that upload.
  if (videoId && state !== "completed" && state !== "stopping" && !bytesOnR2) {
    chrome.runtime.sendMessage({ type: "voom-upload-abort", videoId }).catch(() => {});
  }
  if (state !== "stopping") {
    chrome.runtime.sendMessage({ type: "voom-remove-overlay" }).catch(() => {});
  }
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
