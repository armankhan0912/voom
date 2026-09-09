(() => {
  const STALE = "Refresh this page to reconnect the Voom extension.";

  function getSendMessage() {
    try {
      const runtime = globalThis.chrome && globalThis.chrome.runtime;
      if (!runtime || typeof runtime.sendMessage !== "function") {
        return null;
      }
      return runtime.sendMessage.bind(runtime);
    } catch {
      return null;
    }
  }

  function markStale() {
    window.postMessage({ type: "voom-extension-stale" }, "*");
  }

  function send(message, callback) {
    const sendMessage = getSendMessage();
    if (!sendMessage) {
      markStale();
      if (callback) callback({ error: STALE });
      return;
    }

    try {
      sendMessage(message, (response) => {
        try {
          void (globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.lastError);
        } catch {
          // Runtime went away during the round-trip.
        }
        if (callback) callback(response);
      });
    } catch {
      markStale();
      if (callback) callback({ error: STALE });
    }
  }

  if (typeof window.__voomBridgeHandler === "function") {
    window.removeEventListener("message", window.__voomBridgeHandler);
  }

  function onMessage(event) {
    try {
      if (event.source !== window || !event.data || typeof event.data !== "object") {
        return;
      }

      const { type } = event.data;
      const sendMessage = getSendMessage();

      if (type === "voom-ping-extension") {
        if (!sendMessage) {
          markStale();
          return;
        }
        window.postMessage({ type: "voom-extension-ready" }, "*");
        return;
      }

      if (type === "voom-begin") {
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
            window.postMessage({ type: "voom-begin-result", payload: response ?? {} }, "*");
          },
        );
        return;
      }

      if (type === "voom-query-session") {
        send({ type: "voom-query-session" }, (response) => {
          window.postMessage({ type: "voom-session", payload: response ?? {} }, "*");
        });
      }
    } catch {
      markStale();
    }
  }

  window.__voomBridgeHandler = onMessage;
  window.addEventListener("message", onMessage);

  if (getSendMessage()) {
    window.postMessage({ type: "voom-extension-ready" }, "*");
  }
})();
