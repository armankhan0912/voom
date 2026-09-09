document.getElementById("home")?.setAttribute("href", `${VOOM_APP_URL}/`);

document.getElementById("record")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "voom-begin", source: "popup", autostart: true });
  window.close();
});
