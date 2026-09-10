import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapters, videos } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/current-user";
import { serializeChapters } from "@/lib/chapters/serialize";
import { startChapters } from "@/lib/chapters/start";
import { VIDEO_ID_PATTERN } from "@/lib/videos";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!VIDEO_ID_PATTERN.test(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const videoRows = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  const video = videoRows[0];

  if (!video) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getCurrentDbUser();
  const isOwner = user?.id === video.userId;

  if (video.status !== "ready" && !isOwner) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const chapterRows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.videoId, id))
    .limit(1);
  const record = chapterRows[0];

  if (!record) {
    after(() => {
      void startChapters(id);
    });

    return Response.json({
      videoId: id,
      status: "pending",
      error: null,
      chapters: null,
    });
  }

  if (record.status === "failed") {
    after(() => {
      void startChapters(id);
    });
  }

  return Response.json(serializeChapters(record));
}
