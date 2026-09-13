import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/current-user";
import { createDownloadUrl } from "@/lib/r2/presign";
import { VIDEO_ID_PATTERN, videoDownloadFilename } from "@/lib/videos";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  if (!VIDEO_ID_PATTERN.test(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: videos.id,
      userId: videos.userId,
      title: videos.title,
      status: videos.status,
      s3Key: videos.s3Key,
    })
    .from(videos)
    .where(eq(videos.id, id))
    .limit(1);

  const video = rows[0];

  if (!video || video.userId !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (video.status !== "ready") {
    return Response.json({ error: "Video is not ready" }, { status: 400 });
  }

  try {
    const filename = videoDownloadFilename(video.title);
    const url = await createDownloadUrl(video.s3Key, filename);
    return Response.json({ url, filename });
  } catch {
    return Response.json({ error: "Could not start download" }, { status: 500 });
  }
}
