(() => {
  const existingBubble = document.getElementById("voom-overlay-bubble");
  const existingToolbar = document.getElementById("voom-overlay-toolbar");
  if (existingBubble && existingToolbar) {
    existingToolbar.style.width = "196px";
    existingToolbar.style.height = "44px";
    existingToolbar.style.border = "0";
    existingToolbar.style.borderRadius = "999px";
    existingToolbar.style.background = "transparent";
    existingToolbar.style.backgroundColor = "transparent";
    existingToolbar.style.colorScheme = "none";
    existingToolbar.style.boxShadow = "0 4px 16px rgba(40, 30, 20, 0.06)";
    existingToolbar.style.overflow = "hidden";
    existingToolbar.style.display = "block";
    return;
  }

  existingBubble?.remove();
  existingToolbar?.remove();
  document.getElementById("voom-overlay-frame")?.remove();

  const overlayUrl = chrome.runtime.getURL("overlay.html");
  const POS_KEY = "voom-overlay-pos";

  const toolbarFrameStyle = [
    "position:fixed",
    "left:50%",
    "bottom:24px",
    "width:196px",
    "height:44px",
    "border:0",
    "border-radius:999px",
    "z-index:2147483647",
    "pointer-events:none",
    "background:transparent",
    "background-color:transparent",
    "color-scheme:none",
    "box-shadow:0 4px 16px rgba(40, 30, 20, 0.06)",
    "overflow:hidden",
    "transform:translateX(-50%)",
    "display:block",
    "visibility:hidden",
    "opacity:0",
  ].join(";");

  function mountFrame(id, part, style) {
    const iframe = document.createElement("iframe");
    iframe.id = id;
    iframe.className = "voom-overlay-frame";
    iframe.src = `${overlayUrl}?part=${part}`;
    iframe.allow = "camera; microphone; autoplay; display-capture";
    iframe.setAttribute("allowtransparency", "true");
    iframe.setAttribute("style", style);
    document.documentElement.appendChild(iframe);
    return iframe;
  }

  const bubbleFrame = mountFrame(
    "voom-overlay-bubble",
    "bubble",
    [
      "position:fixed",
      "left:24px",
      "bottom:24px",
      "width:168px",
      "height:168px",
      "border:0",
      "z-index:2147483647",
      "pointer-events:none",
      "background:transparent",
      "overflow:hidden",
      "border-radius:50%",
      "display:block",
      "visibility:hidden",
      "opacity:0",
    ].join(";"),
  );

  let bubbleLoaded = false;
  bubbleFrame.addEventListener("load", () => {
    bubbleLoaded = true;
  });

  const toolbarFrame = mountFrame(
    "voom-overlay-toolbar",
    "toolbar",
    toolbarFrameStyle,
  );

  const frames = {
    bubble: bubbleFrame,
    toolbar: toolbarFrame,
  };

  let drag = null;

  function frameSize(frame) {
    const rect = frame.getBoundingClientRect();
    const width = rect.width || parseFloat(frame.style.width) || 0;
    const height = rect.height || parseFloat(frame.style.height) || 0;
    return { width, height };
  }

  function clampPos(left, top, width, height) {
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - height);
    return {
      left: Math.max(0, Math.min(maxLeft, left)),
      top: Math.max(0, Math.min(maxTop, top)),
    };
  }

  function placeFrame(frame, left, top) {
    const { width, height } = frameSize(frame);
    const pos = clampPos(left, top, width, height);
    frame.style.left = `${pos.left}px`;
    frame.style.top = `${pos.top}px`;
    frame.style.right = "auto";
    frame.style.bottom = "auto";
    frame.style.transform = "none";
    return pos;
  }

  function applySavedPos(frame, pos) {
    if (!pos || typeof pos.left !== "number" || typeof pos.top !== "number") {
      return;
    }
    placeFrame(frame, pos.left, pos.top);
  }

  void chrome.storage.session.get(POS_KEY).then((stored) => {
    const pos = stored[POS_KEY] ?? {};
    applySavedPos(bubbleFrame, pos.bubble);
    applySavedPos(toolbarFrame, pos.toolbar);
  });

  function savePos(part, left, top) {
    void chrome.storage.session.get(POS_KEY).then((stored) => {
      const current = stored[POS_KEY] ?? {};
      void chrome.storage.session.set({
        [POS_KEY]: { ...current, [part]: { left, top } },
      });
    });
  }

  function applyDrag(screenX, screenY) {
    if (!drag) {
      return;
    }
    const left = drag.originLeft + (screenX - drag.screenX);
    const top = drag.originTop + (screenY - drag.screenY);
    placeFrame(drag.frame, left, top);
  }

  function endDrag() {
    if (!drag) {
      return;
    }
    const rect = drag.frame.getBoundingClientRect();
    savePos(drag.part, rect.left, rect.top);
    drag.shield?.remove();
    drag = null;
  }

  function startDrag(part, screenX, screenY) {
    const frame = frames[part];
    if (!frame || drag) {
      return;
    }

    const rect = frame.getBoundingClientRect();
    const shield = document.createElement("div");
    shield.id = "voom-drag-shield";
    shield.setAttribute(
      "style",
      [
        "position:fixed",
        "inset:0",
        "z-index:2147483647",
        "cursor:grabbing",
        "touch-action:none",
      ].join(";"),
    );
    document.documentElement.appendChild(shield);

    drag = {
      part,
      frame,
      shield,
      originLeft: rect.left,
      originTop: rect.top,
      screenX,
      screenY,
    };
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data.type !== "string") {
      return;
    }

    const fromOverlay =
      event.source === bubbleFrame.contentWindow ||
      event.source === toolbarFrame.contentWindow;
    if (!fromOverlay) {
      return;
    }

    if (data.type === "voom-overlay-visibility") {
      if (typeof data.bubble === "boolean") {
        bubbleFrame.style.display = "block";
        bubbleFrame.style.visibility = data.bubble ? "visible" : "hidden";
        bubbleFrame.style.opacity = data.bubble ? "1" : "0";
        bubbleFrame.style.pointerEvents = data.bubble ? "auto" : "none";
        if (data.bubble) {
          requestAnimationFrame(() => {
            try {
              bubbleFrame.contentWindow?.postMessage({ type: "voom-overlay-shown" }, "*");
            } catch {
              // Cross-origin or iframe already gone.
            }
          });
        }
      }

      if (typeof data.toolbar === "boolean") {
        toolbarFrame.style.display = "block";
        toolbarFrame.style.visibility = data.toolbar ? "visible" : "hidden";
        toolbarFrame.style.opacity = data.toolbar ? "1" : "0";
        toolbarFrame.style.pointerEvents = data.toolbar ? "auto" : "none";
      }
      return;
    }

    if (data.type === "voom-overlay-drag-start") {
      startDrag(data.part, data.screenX, data.screenY);
      return;
    }

    if (data.type === "voom-overlay-drag-move") {
      applyDrag(data.screenX, data.screenY);
      return;
    }

    if (data.type === "voom-overlay-drag-end") {
      endDrag();
    }
  });

  window.addEventListener("pointermove", (event) => {
    if (!drag) {
      return;
    }
    applyDrag(event.screenX, event.screenY);
  });

  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  window.addEventListener("blur", endDrag);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!bubbleFrame.isConnected) {
      return;
    }

    if (message?.type === "voom-ui-state") {
      try {
        bubbleFrame.contentWindow?.postMessage(message, "*");
        toolbarFrame.contentWindow?.postMessage(message, "*");
      } catch {
        // Iframe not ready.
      }
      return;
    }

    const request =
      message?.type === "voom-prime-media"
        ? {
            payload: { type: "voom-prime-media", mic: message.mic !== false },
            resultType: "voom-prime-media-result",
            timeoutMs: 60000,
            showBubble: true,
          }
        : message?.type === "voom-choose-desktop"
          ? {
              payload: {
                type: "voom-choose-desktop",
                recorderTabId: message.recorderTabId,
              },
              resultType: "voom-choose-desktop-result",
              timeoutMs: 180000,
              showBubble: false,
            }
          : null;

    if (!request) {
      return;
    }

    let settled = false;
    const finish = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("message", onResult);
      if (request.showBubble && bubbleFrame.style.opacity === "0.01") {
        bubbleFrame.style.visibility = "hidden";
        bubbleFrame.style.opacity = "0";
      }
      sendResponse(payload);
    };

    function onResult(event) {
      if (event.source !== bubbleFrame.contentWindow) {
        return;
      }
      if (event.data?.type !== request.resultType) {
        return;
      }
      finish(event.data);
    }

    window.addEventListener("message", onResult);

    let sent = false;
    const sendRequest = () => {
      if (sent || settled) {
        return;
      }
      sent = true;
      try {
        if (request.showBubble) {
          bubbleFrame.style.visibility = "visible";
          bubbleFrame.style.opacity = "0.01";
        }
        bubbleFrame.contentWindow?.postMessage(request.payload, "*");
      } catch {
        finish({ ok: false, streamId: "", unsupported: true });
      }
    };

    if (bubbleLoaded) {
      sendRequest();
    } else {
      bubbleFrame.addEventListener("load", sendRequest, { once: true });
    }
    window.setTimeout(() => finish({ ok: false, streamId: "", unsupported: true }), request.timeoutMs);
    return true;
  });

  window.addEventListener("resize", () => {
    for (const frame of Object.values(frames)) {
      const rect = frame.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        continue;
      }
      placeFrame(frame, rect.left, rect.top);
    }
  });
})();
