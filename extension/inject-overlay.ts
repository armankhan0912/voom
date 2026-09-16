import type {
  OverlayPart,
  OverlayWindowMessage,
  VoomRuntimeMessage,
  VoomUiState,
} from "./messages";

(() => {
  const existingBubble = document.getElementById("voom-overlay-bubble");
  const existingToolbar = document.getElementById("voom-overlay-toolbar");
  if (existingBubble && existingToolbar) {
    existingToolbar.style.width = "144px";
    existingToolbar.style.height = "32px";
    existingToolbar.style.border = "0";
    existingToolbar.style.borderRadius = "999px";
    existingToolbar.style.background = "transparent";
    existingToolbar.style.backgroundColor = "transparent";
    existingToolbar.style.colorScheme = "none";
    existingToolbar.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.35)";
    existingToolbar.style.overflow = "hidden";
    existingToolbar.style.display = "block";
    return;
  }

  existingBubble?.remove();
  existingToolbar?.remove();
  document.getElementById("voom-overlay-frame")?.remove();

  const overlayUrl = chrome.runtime.getURL("overlay.html");
  const POS_KEY = "voom-overlay-pos";

  type SavedPos = { left: number; top: number };
  type SavedPositions = Partial<Record<OverlayPart, SavedPos>>;
  type DragState = {
    part: OverlayPart;
    frame: HTMLIFrameElement;
    shield: HTMLDivElement;
    originLeft: number;
    originTop: number;
    screenX: number;
    screenY: number;
  };

  const toolbarFrameStyle = [
    "position:fixed",
    "left:50%",
    "bottom:24px",
    "width:144px",
    "height:32px",
    "border:0",
    "border-radius:999px",
    "z-index:2147483647",
    "pointer-events:none",
    "background:transparent",
    "background-color:transparent",
    "color-scheme:none",
    "box-shadow:0 8px 24px rgba(0, 0, 0, 0.35)",
    "overflow:hidden",
    "transform:translateX(-50%)",
    "display:block",
    "visibility:hidden",
    "opacity:0",
  ].join(";");

  function mountFrame(id: string, part: OverlayPart, style: string) {
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

  const frames: Record<OverlayPart, HTMLIFrameElement> = {
    bubble: bubbleFrame,
    toolbar: toolbarFrame,
  };

  let drag: DragState | null = null;

  function isOverlayPart(part: unknown): part is OverlayPart {
    return part === "bubble" || part === "toolbar";
  }

  function isOverlayWindowMessage(data: unknown): data is OverlayWindowMessage {
    return (
      typeof data === "object" &&
      data !== null &&
      "type" in data &&
      typeof (data as { type: unknown }).type === "string"
    );
  }

  function isVoomUiState(message: unknown): message is VoomUiState {
    return (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      (message as { type: unknown }).type === "voom-ui-state"
    );
  }

  function messageType(message: unknown) {
    if (typeof message !== "object" || message === null || !("type" in message)) {
      return null;
    }
    return (message as { type: unknown }).type;
  }

  function frameSize(frame: HTMLIFrameElement) {
    const rect = frame.getBoundingClientRect();
    const width = rect.width || parseFloat(frame.style.width) || 0;
    const height = rect.height || parseFloat(frame.style.height) || 0;
    return { width, height };
  }

  function clampPos(left: number, top: number, width: number, height: number) {
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - height);
    return {
      left: Math.max(0, Math.min(maxLeft, left)),
      top: Math.max(0, Math.min(maxTop, top)),
    };
  }

  function placeFrame(frame: HTMLIFrameElement, left: number, top: number) {
    const { width, height } = frameSize(frame);
    const pos = clampPos(left, top, width, height);
    frame.style.left = `${pos.left}px`;
    frame.style.top = `${pos.top}px`;
    frame.style.right = "auto";
    frame.style.bottom = "auto";
    frame.style.transform = "none";
    return pos;
  }

  function applySavedPos(frame: HTMLIFrameElement, pos: SavedPos | undefined) {
    if (!pos || typeof pos.left !== "number" || typeof pos.top !== "number") {
      return;
    }
    placeFrame(frame, pos.left, pos.top);
  }

  void chrome.storage.session.get(POS_KEY).then((stored) => {
    const pos = (stored[POS_KEY] ?? {}) as SavedPositions;
    applySavedPos(bubbleFrame, pos.bubble);
    applySavedPos(toolbarFrame, pos.toolbar);
  });

  function savePos(part: OverlayPart, left: number, top: number) {
    void chrome.storage.session.get(POS_KEY).then((stored) => {
      const current = (stored[POS_KEY] ?? {}) as SavedPositions;
      void chrome.storage.session.set({
        [POS_KEY]: { ...current, [part]: { left, top } },
      });
    });
  }

  function applyDrag(screenX: number, screenY: number) {
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
    drag.shield.remove();
    drag = null;
  }

  function startDrag(part: unknown, screenX: unknown, screenY: unknown) {
    if (!isOverlayPart(part) || typeof screenX !== "number" || typeof screenY !== "number") {
      return;
    }
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

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (!isOverlayWindowMessage(data)) {
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
              bubbleFrame.contentWindow?.postMessage(
                { type: "voom-overlay-shown" } satisfies OverlayWindowMessage,
                "*",
              );
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

  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse) => {
      if (!bubbleFrame.isConnected) {
        return;
      }

      if (isVoomUiState(message)) {
        try {
          bubbleFrame.contentWindow?.postMessage(message, "*");
          toolbarFrame.contentWindow?.postMessage(message, "*");
        } catch {
          // Iframe not ready.
        }
        return;
      }

      const type = messageType(message);
      const request =
        type === "voom-prime-media"
          ? {
              payload: {
                type: "voom-prime-media" as const,
                mic: (message as Extract<VoomRuntimeMessage, { type: "voom-prime-media" }>)
                  .mic !== false,
              },
              resultType: "voom-prime-media-result" as const,
              timeoutMs: 60_000,
              showBubble: true,
            }
          : type === "voom-choose-desktop"
            ? {
                payload: {
                  type: "voom-choose-desktop" as const,
                  recorderTabId: (
                    message as Extract<
                      VoomRuntimeMessage,
                      { type: "voom-choose-desktop" }
                    >
                  ).recorderTabId,
                },
                resultType: "voom-choose-desktop-result" as const,
                timeoutMs: 180_000,
                showBubble: false,
              }
            : null;

      if (!request) {
        return;
      }

      const activeRequest = request;
      let settled = false;
      const finish = (payload: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        window.removeEventListener("message", onResult);
        if (activeRequest.showBubble && bubbleFrame.style.opacity === "0.01") {
          bubbleFrame.style.visibility = "hidden";
          bubbleFrame.style.opacity = "0";
        }
        sendResponse(payload);
      };

      function onResult(event: MessageEvent<unknown>) {
        if (event.source !== bubbleFrame.contentWindow) {
          return;
        }
        if (
          !isOverlayWindowMessage(event.data) ||
          event.data.type !== activeRequest.resultType
        ) {
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
          if (activeRequest.showBubble) {
            bubbleFrame.style.visibility = "visible";
            bubbleFrame.style.opacity = "0.01";
          }
          bubbleFrame.contentWindow?.postMessage(activeRequest.payload, "*");
        } catch {
          finish({ ok: false, streamId: "", unsupported: true });
        }
      };

      if (bubbleLoaded) {
        sendRequest();
      } else {
        bubbleFrame.addEventListener("load", sendRequest, { once: true });
      }
      window.setTimeout(
        () => finish({ ok: false, streamId: "", unsupported: true }),
        activeRequest.timeoutMs,
      );
      return true;
    },
  );

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
