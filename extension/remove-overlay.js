(() => {
  const frames = [
    ...document.querySelectorAll(".voom-overlay-frame"),
    document.getElementById("voom-overlay-frame"),
    document.getElementById("voom-overlay-bubble"),
    document.getElementById("voom-overlay-toolbar"),
  ].filter(Boolean);

  const unique = [...new Set(frames)];
  unique.forEach((frame) => {
    try {
      frame.contentWindow?.postMessage({ type: "voom-stop-camera" }, "*");
    } catch {
      // Iframe already detached.
    }
  });
  unique.forEach((frame) => frame.remove());
})();
