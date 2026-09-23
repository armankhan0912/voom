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
    if (isOwner) {
      after(() => {
        void startChapters(id);
      });
    }

    return Response.json({
      videoId: id,
      status: "pending",
      error: null,
      chapters: null,
    });
  }

  return Response.json(serializeChapters(record));
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!VIDEO_ID_PATTERN.test(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getCurrentDbUser();
  if (!user) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const videoRows = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  const video = videoRows[0];

  if (!video || video.userId !== user.id || video.status !== "ready") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const chapterRows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.videoId, id))
    .limit(1);
  const record = chapterRows[0];

  if (!record || record.status !== "failed") {
    return Response.json(
      record
        ? serializeChapters(record)
        : {
            videoId: id,
            status: "pending",
            error: null,
            chapters: null,
          },
    );
  }

  after(() => {
    void startChapters(id);
  });

  return Response.json({ status: "processing" });
}
