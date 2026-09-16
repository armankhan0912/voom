import { useEffect, useRef, useState } from "react";
import type { OverlayWindowMessage, VoomUiState } from "../messages";
import { sendVoomMessage } from "../runtime";
import { CameraBubble } from "./CameraBubble";
import { RecordingToolbar } from "./RecordingToolbar";
import { chooseDesktop, postParent, primeMic } from "./media";
import { useCamera } from "./useCamera";
import { useOverlayDrag } from "./useOverlayDrag";

const EMPTY_UI: VoomUiState = {
  type: "voom-ui-state",
  state: "idle",
  elapsedMs: 0,
};

function getOverlayPart() {
  return new URLSearchParams(location.search).get("part");
}

function isVoomUiState(message: unknown): message is VoomUiState {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as { type: unknown }).type === "voom-ui-state"
  );
}

function windowMessageType(event: MessageEvent<unknown>) {
  const data = event.data;
  if (typeof data !== "object" || data === null || !("type" in data)) {
    return null;
  }
  return data as OverlayWindowMessage;
}

export function Overlay() {
  const part = getOverlayPart();
  const [ui, setUi] = useState<VoomUiState>(EMPTY_UI);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const ignoreClickRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const { syncCamera, release } = useCamera(part, videoRef, setBubbleVisible);
  const dragRef = part === "bubble" ? bubbleRef : toolbarRef;

  useOverlayDrag(dragRef, part, ignoreClickRef);

  const applyStateRef = useRef<(payload: VoomUiState) => void>(() => {});
  const releaseRef = useRef(release);
  applyStateRef.current = (payload) => {
    setUi(payload);
    const live =
      payload.state === "recording" ||
      payload.state === "paused" ||
      payload.state === "stopping";
    if (part === "toolbar") {
      postParent({ type: "voom-overlay-visibility", toolbar: live });
    }

    const showCamera = Boolean(
      payload.cameraEnabled &&
        (payload.state === "setup" ||
          payload.state === "screen_selection" ||
          payload.state === "recording" ||
          payload.state === "paused"),
    );
    void syncCamera(showCamera, payload.cameraDeviceId || "");
  };
  releaseRef.current = release;

  useEffect(() => {
    function onRuntimeMessage(
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message as { type: unknown }).type === "voom-release-camera"
      ) {
        releaseRef.current();
        return;
      }

      if (isVoomUiState(message)) {
        applyStateRef.current(message);
        return;
      }

      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message as { type: unknown }).type === "voom-overlay-choose-desktop"
      ) {
        if (part === "toolbar") {
          return;
        }
        const recorderTabId = (message as { recorderTabId?: number | null })
          .recorderTabId;
        void chooseDesktop(recorderTabId).then(sendResponse);
        return true;
      }
    }

    function onWindowMessage(event: MessageEvent<unknown>) {
      const data = windowMessageType(event);
      if (!data) {
        return;
      }

      if (data.type === "voom-ui-state") {
        applyStateRef.current(data);
        return;
      }
      if (data.type === "voom-stop-camera") {
        releaseRef.current();
        return;
      }
      if (data.type === "voom-prime-media") {
        void primeMic(part !== "toolbar" && data.mic !== false).then((result) => {
          postParent({ type: "voom-prime-media-result", ...result });
        });
        return;
      }
      if (data.type === "voom-choose-desktop") {
        if (part === "toolbar") {
          return;
        }
        void chooseDesktop(data.recorderTabId).then((result) => {
          postParent({ type: "voom-choose-desktop-result", ...result });
        });
      }
    }

    chrome.runtime.onMessage.addListener(onRuntimeMessage);
    window.addEventListener("message", onWindowMessage);
    void sendVoomMessage({ type: "voom-overlay-ready" });

    return () => {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
      window.removeEventListener("message", onWindowMessage);
    };
  }, [part]);

  const live =
    ui.state === "recording" || ui.state === "paused" || ui.state === "stopping";
  const paused = ui.state === "paused";
  const stopping = ui.state === "stopping";

  function sendControl(action: "pause" | "resume" | "stop") {
    void sendVoomMessage({ type: "voom-overlay-control", action });
  }

  return (
    <>
      {part !== "toolbar" ? (
        <CameraBubble rootRef={bubbleRef} videoRef={videoRef} visible={bubbleVisible} />
      ) : null}
      {part !== "bubble" ? (
        <RecordingToolbar
          rootRef={toolbarRef}
          ignoreClickRef={ignoreClickRef}
          live={live}
          paused={paused}
          stopping={stopping}
          elapsedMs={ui.elapsedMs || 0}
          onPause={() => sendControl(paused ? "resume" : "pause")}
          onStop={() => sendControl("stop")}
        />
      ) : null}
    </>
  );
}
