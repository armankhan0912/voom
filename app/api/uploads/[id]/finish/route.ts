import { getCurrentDbUser } from "@/lib/current-user";
import { objectExists } from "@/lib/r2/client";
import { completeMultipartUpload } from "@/lib/r2/multipart";
import { loadOwnedVideo, parseCompletedParts } from "@/lib/uploads";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const video = await loadOwnedVideo(id, user.id);

  if (!video || video.status !== "uploading" || !video.r2UploadId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (await objectExists(video.s3Key)) {
    return Response.json({ ok: true, videoId: video.id });
  }

  let parts: { partNumber: number; etag: string }[] | null = null;

  try {
    const body = (await request.json()) as { parts?: unknown };
    parts = parseCompletedParts(body.parts);
  } catch {
    parts = null;
  }

  if (!parts) {
    return Response.json({ error: "Upload parts are required" }, { status: 400 });
  }

  try {
    await completeMultipartUpload(video.s3Key, video.r2UploadId, parts);
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Could not finalize upload";
    console.error("[voom] multipart finalize failed", video.id, message);
    return Response.json({ error: "Could not finalize upload" }, { status: 500 });
  }

  if (!(await objectExists(video.s3Key))) {
    return Response.json(
      { error: "Upload not found in storage" },
      { status: 400 },
    );
  }

  console.log("[voom] multipart finalized", video.id);

  return Response.json({ ok: true, videoId: video.id });
}
