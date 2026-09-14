import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/current-user";
import { createMultipartUpload } from "@/lib/r2/multipart";
import { contentTypeFromKey, loadOwnedVideo } from "@/lib/uploads";
import { serializeVideo } from "@/lib/serialize-video";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const video = await loadOwnedVideo(id, user.id);

  if (!video || video.status !== "uploading") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (video.r2UploadId) {
    return Response.json({
      uploadId: video.r2UploadId,
      video: serializeVideo(video),
    });
  }

  const uploadId = await createMultipartUpload(
    video.s3Key,
    contentTypeFromKey(video.s3Key),
  );

  const updated = await db
    .update(videos)
    .set({
      r2UploadId: uploadId,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, video.id))
    .returning();

  console.log("[voom] multipart started", video.id);

  return Response.json({
    uploadId,
    video: serializeVideo(updated[0]),
  });
}
