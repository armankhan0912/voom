import type { OverlayWindowMessage } from "./messages";

(() => {
  const frames = [
    ...Array.from(document.querySelectorAll(".voom-overlay-frame")),
    document.getElementById("voom-overlay-frame"),
    document.getElementById("voom-overlay-bubble"),
    document.getElementById("voom-overlay-toolbar"),
  ].filter((frame): frame is HTMLElement => frame instanceof HTMLElement);

  const unique = [...new Set(frames)];
  unique.forEach((frame) => {
    try {
      (frame as HTMLIFrameElement).contentWindow?.postMessage(
        { type: "voom-stop-camera" } satisfies OverlayWindowMessage,
        "*",
      );
    } catch {
      // Iframe already detached.
    }
  });
  unique.forEach((frame) => frame.remove());
})();
