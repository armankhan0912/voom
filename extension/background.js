const APP_URL = "http://localhost:3000";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "voom-upload") {
    return;
  }

  uploadRecording(message)
    .then((result) => sendResponse(result))
    .catch((caught) =>
      sendResponse({
        error: caught instanceof Error ? caught.message : "Upload failed",
      }),
    );

  return true;
});

async function uploadRecording(message) {
  const blob = new Blob([message.buffer], {
    type: message.contentType || "video/webm",
  });
  const contentType = blob.type.startsWith("video/mp4")
    ? "video/mp4"
    : "video/webm";

  const presignResponse = await fetch(`${APP_URL}/api/uploads/presign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType }),
  });

  if (presignResponse.status === 401) {
    await chrome.tabs.create({ url: `${APP_URL}/sign-in` });
    throw new Error("Sign in to Voom in the browser first");
  }

  if (!presignResponse.ok) {
    throw new Error("Could not start upload");
  }

  const presign = await presignResponse.json();

  const putResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": presign.contentType },
  });

  if (!putResponse.ok) {
    await fetch(`${APP_URL}/api/videos/${presign.video.id}/complete`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ failed: true }),
    });
    throw new Error("Upload to storage failed");
  }

  const completeResponse = await fetch(
    `${APP_URL}/api/videos/${presign.video.id}/complete`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration: message.duration ?? 0 }),
    },
  );

  if (!completeResponse.ok) {
    throw new Error("Could not finalize video");
  }

  await chrome.tabs.create({ url: `${APP_URL}/v/${presign.video.id}` });
  return { ok: true, id: presign.video.id };
}
