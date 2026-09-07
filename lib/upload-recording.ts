export async function uploadRecording(
  blob: Blob,
  duration: number,
  title?: string,
) {
  const contentType = blob.type.startsWith("video/mp4")
    ? "video/mp4"
    : "video/webm";

  const presignResponse = await fetch("/api/uploads/presign", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, title }),
  });

  if (!presignResponse.ok) {
    throw new Error("Could not start upload");
  }

  const presign = (await presignResponse.json()) as {
    uploadUrl: string;
    contentType: string;
    video: { id: string };
  };

  const putResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": presign.contentType },
  });

  if (!putResponse.ok) {
    await fetch(`/api/videos/${presign.video.id}/complete`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ failed: true }),
    });
    throw new Error("Upload to storage failed");
  }

  const completeResponse = await fetch(
    `/api/videos/${presign.video.id}/complete`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration }),
    },
  );

  if (!completeResponse.ok) {
    throw new Error("Could not finalize video");
  }

  return completeResponse.json() as Promise<{ video: { id: string } }>;
}
