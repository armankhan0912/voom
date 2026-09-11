const part = new URLSearchParams(location.search).get("part");
const bubble = document.getElementById("bubble");
const camera = document.getElementById("camera");
const toolbar = document.getElementById("toolbar");
const timerEl = document.getElementById("timer");
const pauseButton = document.getElementById("pause");
const stopButton = document.getElementById("stop");

if (part === "bubble") {
  toolbar?.remove();
}

if (part === "toolbar") {
  bubble?.remove();
}

let cameraStream = null;
let lastDeviceId = "";
let cameraFailedFor = null;
let cameraSyncId = 0;

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setParentVisibility(patch) {
  window.parent.postMessage({ type: "voom-overlay-visibility", ...patch }, "*");
}

function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  lastDeviceId = "";
  if (camera) {
    camera.pause();
    camera.srcObject = null;
  }
}

async function primeMic(needed) {
  if (!needed || part === "toolbar") {
    return { ok: true };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (error) {
    const denied = error?.name === "NotAllowedError";
    return { ok: !denied, denied };
  }
}

function waitUntilBubbleShown() {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      resolve();
    };

    function onMessage(event) {
      if (event.data?.type === "voom-overlay-shown") {
        done();
      }
    }

    window.addEventListener("message", onMessage);
    setTimeout(done, 300);
  });
}

async function acquireCamera(deviceId) {
  const attempts = [];
  if (deviceId) {
    attempts.push({ video: { deviceId: { ideal: deviceId } }, audio: false });
  }
  attempts.push({ video: { facingMode: "user" }, audio: false });
  attempts.push({ video: true, audio: false });

  let lastError;
  for (let round = 0; round < 3; round++) {
    if (round > 0) {
      await delay(180 * round);
    }
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw lastError;
}

function playCamera() {
  if (!camera || !camera.paused) {
    return;
  }
  void camera.play().catch((error) => {
    if (error?.name === "AbortError") {
      return;
    }
  });
}

async function attachCamera(stream) {
  if (!camera) return;
  const track = stream.getVideoTracks()[0];
  if (track?.muted) {
    await Promise.race([
      new Promise((resolve) => track.addEventListener("unmute", resolve, { once: true })),
      delay(400),
    ]);
  }
  if (camera.srcObject !== stream) {
    camera.srcObject = stream;
  }
  await new Promise((resolve) => {
    if (camera.readyState >= 1) {
      resolve();
      return;
    }
    camera.addEventListener("loadedmetadata", () => resolve(), { once: true });
    setTimeout(resolve, 800);
  });
  try {
    await camera.play();
  } catch (error) {
    if (error?.name !== "AbortError") {
      // Autoplay can still fail; muted + playsinline usually allows it.
    }
  }
}

async function syncCamera(enabled, deviceId) {
  if (part === "toolbar") {
    return;
  }

  if (!enabled) {
    cameraSyncId += 1;
    cameraFailedFor = null;
    stopCamera();
    bubble?.classList.add("hidden");
    setParentVisibility({ bubble: false });
    return;
  }

  if (cameraStream && lastDeviceId === deviceId) {
    playCamera();
    bubble?.classList.remove("hidden");
    setParentVisibility({ bubble: true });
    return;
  }

  if (cameraFailedFor === deviceId) {
    bubble?.classList.add("hidden");
    setParentVisibility({ bubble: false });
    return;
  }

  const syncId = ++cameraSyncId;
  stopCamera();
  bubble?.classList.add("hidden");
  setParentVisibility({ bubble: false });

  try {
    const stream = await acquireCamera(deviceId);
    if (syncId !== cameraSyncId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    cameraStream = stream;
    lastDeviceId = deviceId || "";
    cameraFailedFor = null;
    await attachCamera(stream);
    if (syncId !== cameraSyncId) {
      return;
    }
    bubble?.classList.remove("hidden");
    setParentVisibility({ bubble: true });
  } catch {
    if (syncId !== cameraSyncId) {
      return;
    }
    cameraFailedFor = deviceId;
    bubble?.classList.add("hidden");
    setParentVisibility({ bubble: false });
  }
}

function applyState(payload) {
  const live =
    payload.state === "recording" ||
    payload.state === "paused" ||
    payload.state === "stopping";
  toolbar?.classList.toggle("hidden", !live);
  if (part === "toolbar") {
    setParentVisibility({ toolbar: live });
  }

  if (timerEl) {
    timerEl.textContent = formatElapsed(payload.elapsedMs || 0);
  }

  if (pauseButton) {
    const paused = payload.state === "paused";
    pauseButton.classList.toggle("is-resume", paused);
    pauseButton.title = paused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-label", paused ? "Resume" : "Pause");
    pauseButton.disabled = payload.state === "stopping";
  }

  if (stopButton) {
    stopButton.title =
      payload.state === "stopping" ? "Uploading…" : "Stop recording";
    stopButton.setAttribute(
      "aria-label",
      payload.state === "stopping" ? "Uploading…" : "Stop recording",
    );
    stopButton.disabled = payload.state === "stopping";
  }

  toolbar?.classList.toggle("is-paused", payload.state === "paused");

  const showCamera =
    payload.cameraEnabled &&
    (payload.state === "setup" ||
      payload.state === "screen_selection" ||
      payload.state === "recording" ||
      payload.state === "paused");

  void syncCamera(showCamera, payload.cameraDeviceId || "");
}

function chooseDesktop(recorderTabId) {
  return new Promise((resolve) => {
    const finish = (payload) => resolve(payload);

    void (async () => {
      try {
        if (!chrome.desktopCapture?.chooseDesktopMedia) {
          finish({ streamId: "", unsupported: true });
          return;
        }

        let targetTab = null;
        if (recorderTabId != null) {
          try {
            targetTab = await chrome.tabs.get(recorderTabId);
          } catch {
            targetTab = null;
          }
        }

        const sources = ["screen", "window", "tab"];
        const done = (id) => finish({ streamId: id || "", unsupported: false });
        if (targetTab) {
          chrome.desktopCapture.chooseDesktopMedia(sources, targetTab, done);
        } else {
          chrome.desktopCapture.chooseDesktopMedia(sources, done);
        }
      } catch {
        finish({ streamId: "", unsupported: true });
      }
    })();
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "voom-release-camera") {
    cameraSyncId += 1;
    stopCamera();
    return;
  }

  if (message?.type === "voom-ui-state") {
    applyState(message);
    return;
  }

  if (message?.type === "voom-overlay-choose-desktop") {
    if (part === "toolbar") {
      return;
    }
    void chooseDesktop(message.recorderTabId).then(sendResponse);
    return true;
  }
});

window.addEventListener("message", (event) => {
  if (event.data?.type === "voom-ui-state") {
    applyState(event.data);
    return;
  }
  if (event.data?.type === "voom-stop-camera") {
    cameraSyncId += 1;
    stopCamera();
    return;
  }
  if (event.data?.type === "voom-prime-media") {
    void primeMic(event.data.mic !== false).then((result) => {
      window.parent.postMessage({ type: "voom-prime-media-result", ...result }, "*");
    });
    return;
  }
  if (event.data?.type === "voom-choose-desktop") {
    if (part === "toolbar") {
      return;
    }
    void chooseDesktop(event.data.recorderTabId).then((result) => {
      window.parent.postMessage({ type: "voom-choose-desktop-result", ...result }, "*");
    });
  }
});

window.addEventListener("pagehide", () => {
  cameraSyncId += 1;
  stopCamera();
});

const DRAG_THRESHOLD = 4;
let ignoreClick = false;

function enableDrag(root) {
  if (!root) {
    return;
  }

  let active = null;

  root.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    if (event.target.closest("button")) {
      return;
    }

    active = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
      started: false,
    };

    if (part === "bubble") {
      event.preventDefault();
    }
  });

  window.addEventListener("pointermove", (event) => {
    if (!active || event.pointerId !== active.pointerId) {
      return;
    }

    if (!active.started) {
      const distance = Math.hypot(event.clientX - active.startX, event.clientY - active.startY);
      if (distance < DRAG_THRESHOLD) {
        return;
      }

      active.started = true;
      ignoreClick = true;
      root.classList.add("dragging");
      try {
        root.setPointerCapture(event.pointerId);
      } catch {
        // Capture can fail in some embedders; parent listeners still move the frame.
      }
      window.parent.postMessage(
        {
          type: "voom-overlay-drag-start",
          part,
          screenX: active.screenX,
          screenY: active.screenY,
        },
        "*",
      );
    }

    window.parent.postMessage(
      {
        type: "voom-overlay-drag-move",
        part,
        screenX: event.screenX,
        screenY: event.screenY,
      },
      "*",
    );
  });

  function endDrag(event) {
    if (!active || event.pointerId !== active.pointerId) {
      return;
    }

    if (active.started) {
      ignoreClick = true;
      window.parent.postMessage({ type: "voom-overlay-drag-end", part }, "*");
      setTimeout(() => {
        ignoreClick = false;
      }, 0);
    }

    try {
      root.releasePointerCapture(event.pointerId);
    } catch {
      // Not captured.
    }

    root.classList.remove("dragging");
    active = null;
  }

  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
}

enableDrag(part === "bubble" ? bubble : toolbar);

window.addEventListener(
  "click",
  (event) => {
    if (!ignoreClick) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    ignoreClick = false;
  },
  true,
);

pauseButton?.addEventListener("click", (event) => {
  if (ignoreClick) {
    event.preventDefault();
    ignoreClick = false;
    return;
  }

  const resume = pauseButton.classList.contains("is-resume");
  chrome.runtime.sendMessage({
    type: "voom-overlay-control",
    action: resume ? "resume" : "pause",
  });
});

stopButton?.addEventListener("click", (event) => {
  if (ignoreClick) {
    event.preventDefault();
    ignoreClick = false;
    return;
  }

  chrome.runtime.sendMessage({
    type: "voom-overlay-control",
    action: "stop",
  });
});

chrome.runtime.sendMessage({ type: "voom-overlay-ready" });
