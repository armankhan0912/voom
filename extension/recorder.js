const toggle = document.getElementById("toggle");
const status = document.getElementById("status");
const error = document.getElementById("error");

let recorder = null;
let stream = null;
const chunks = [];
let startedAt = 0;

async function start() {
  if (error) error.textContent = "";
  stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });
  chunks.length = 0;
  startedAt = Date.now();
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };
  recorder.onstop = () => {
    void finish();
  };
  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  });
  recorder.start();
  if (toggle) toggle.textContent = "Stop";
  if (status) status.textContent = "Recording…";
}

async function finish() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  recorder = null;
  if (toggle) toggle.textContent = "Start recording";
  if (status) status.textContent = "Uploading…";

  const blob = new Blob(chunks, { type: "video/webm" });
  chunks.length = 0;

  if (blob.size === 0) {
    if (error) error.textContent = "Nothing was recorded.";
    if (status) status.textContent = "";
    return;
  }

  const buffer = await blob.arrayBuffer();
  const duration = Math.round((Date.now() - startedAt) / 1000);
  const result = await chrome.runtime.sendMessage({
    type: "voom-upload",
    buffer,
    contentType: "video/webm",
    duration,
  });

  if (result?.error) {
    if (error) error.textContent = result.error;
    if (status) status.textContent = "";
    return;
  }

  if (status) status.textContent = "Uploaded.";
}

toggle?.addEventListener("click", () => {
  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
    return;
  }

  void start().catch((caught) => {
    if (error) {
      error.textContent =
        caught instanceof Error ? caught.message : "Could not record.";
    }
  });
});
