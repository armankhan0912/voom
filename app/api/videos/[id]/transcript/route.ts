import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transcripts, videos } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/current-user";
import { serializeTranscript } from "@/lib/transcription/serialize";
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

  const transcriptRows = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.videoId, id))
    .limit(1);
  const transcript = transcriptRows[0];

  if (!transcript) {
    return Response.json({
      videoId: id,
      status: "pending",
      error: null,
      language: null,
      segments: null,
    });
  }

  return Response.json(serializeTranscript(transcript));
}
