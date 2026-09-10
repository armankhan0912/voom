import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { summaries, videos } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/current-user";
import { serializeSummary } from "@/lib/summary/serialize";
import { startSummary } from "@/lib/summary/start";
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

  const summaryRows = await db
    .select()
    .from(summaries)
    .where(eq(summaries.videoId, id))
    .limit(1);
  const summary = summaryRows[0];

  if (!summary) {
    return Response.json({
      videoId: id,
      status: "pending",
      error: null,
      overview: null,
      keyPoints: null,
    });
  }

  if (summary.status === "failed") {
    after(() => {
      void startSummary(id);
    });
  }

  return Response.json(serializeSummary(summary));
}
