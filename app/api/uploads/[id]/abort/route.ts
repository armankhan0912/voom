import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/current-user";
import { objectExists } from "@/lib/r2/client";
import { abortMultipartUpload } from "@/lib/r2/multipart";
import { loadOwnedVideo } from "@/lib/uploads";
import { serializeVideo } from "@/lib/videos";

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

  if (!video) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (video.status === "ready") {
    return Response.json({ video: serializeVideo(video) });
  }

  if (video.status === "uploading" && (await objectExists(video.s3Key))) {
    return Response.json({ video: serializeVideo(video) });
  }

  if (video.r2UploadId && video.status === "uploading") {
    try {
      await abortMultipartUpload(video.s3Key, video.r2UploadId);
    } catch {
      // Already aborted or never received parts.
    }
  }

  if (video.status === "failed") {
    return Response.json({ video: serializeVideo(video) });
  }

  const updated = await db
    .update(videos)
    .set({
      status: "failed",
      updatedAt: new Date(),
    })
    .where(eq(videos.id, video.id))
    .returning();

  console.log("[voom] upload aborted", video.id);

  return Response.json({ video: serializeVideo(updated[0]) });
}
