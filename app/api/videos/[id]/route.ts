import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/current-user";
import { createPlaybackUrl } from "@/lib/r2/presign";
import { serializeVideo, VIDEO_ID_PATTERN } from "@/lib/videos";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!VIDEO_ID_PATTERN.test(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  const video = rows[0];

  if (!video) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getCurrentDbUser();
  const isOwner = user?.id === video.userId;

  if (video.status !== "ready" && !isOwner) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const playbackUrl =
    video.status === "ready" ? await createPlaybackUrl(video.s3Key) : undefined;

  return Response.json(serializeVideo(video, { playbackUrl }));
}
