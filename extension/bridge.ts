import type {
  VoomRuntimeMessage,
  VoomSession,
  WebsiteWindowMessage,
} from "./messages";

const STALE = "Refresh this page to reconnect the Voom extension.";

type RuntimeSendMessage = (
  message: VoomRuntimeMessage,
  callback: (response: unknown) => void,
) => void;

function isWebsiteWindowMessage(data: unknown): data is WebsiteWindowMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof (data as { type: unknown }).type === "string"
  );
}

function getSendMessage(): RuntimeSendMessage | null {
  try {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime || typeof runtime.sendMessage !== "function") {
      return null;
    }
    return runtime.sendMessage.bind(runtime) as RuntimeSendMessage;
  } catch {
    return null;
  }
}

function postPage(message: WebsiteWindowMessage) {
  window.postMessage(message, "*");
}

function markStale() {
  postPage({ type: "voom-extension-stale" });
}

function send(
  message: Extract<VoomRuntimeMessage, { type: "voom-begin" | "voom-query-session" }>,
  callback?: (response: unknown) => void,
) {
  const sendMessage = getSendMessage();
  if (!sendMessage) {
    markStale();
    callback?.({ error: STALE });
    return;
  }

  try {
    sendMessage(message, (response) => {
      try {
        void globalThis.chrome?.runtime?.lastError;
      } catch {
        // Runtime went away during the round-trip.
      }
      callback?.(response);
    });
  } catch {
    markStale();
    callback?.({ error: STALE });
  }
}

(() => {
  if (typeof window.__voomBridgeHandler === "function") {
    window.removeEventListener("message", window.__voomBridgeHandler);
  }

  function onMessage(event: MessageEvent<unknown>) {
    try {
      if (event.source !== window || !isWebsiteWindowMessage(event.data)) {
        return;
      }

      const sendMessage = getSendMessage();

      if (event.data.type === "voom-ping-extension") {
        if (!sendMessage) {
          markStale();
          return;
        }
        postPage({ type: "voom-extension-ready" });
        return;
      }

      if (event.data.type === "voom-begin") {
        send(
          {
            type: "voom-begin",
            source: "website",
            cameraEnabled: event.data.cameraEnabled,
            cameraDeviceId: event.data.cameraDeviceId,
            micEnabled: event.data.micEnabled,
            micDeviceId: event.data.micDeviceId,
          },
          (response) => {
            postPage({
              type: "voom-begin-result",
              payload: (response ?? {}) as { error?: string; ok?: boolean },
            });
          },
        );
        return;
      }

      if (event.data.type === "voom-query-session") {
        send({ type: "voom-query-session" }, (response) => {
          postPage({
            type: "voom-session",
            payload: (response ?? {}) as VoomSession | Record<string, unknown>,
          });
        });
      }
    } catch {
      markStale();
    }
  }

  window.__voomBridgeHandler = onMessage;
  window.addEventListener("message", onMessage);

  if (getSendMessage()) {
    postPage({ type: "voom-extension-ready" });
  }
})();
