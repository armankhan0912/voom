import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { summaries, transcripts, videos } from "@/lib/db/schema";
import {
  GEMINI_MODEL,
  generateSummaryFromTranscript,
} from "@/lib/summary/gemini";
import type { TranscriptSegment } from "@/lib/transcription/types";

const EMPTY_OVERVIEW = "No speech was detected.";

function transcriptText(segments: TranscriptSegment[]) {
  return segments
    .map((segment) => segment.text.trim())
    .filter((text) => text.length > 0)
    .join("\n");
}

export async function startSummary(videoId: string) {
  try {
    await enqueueSummary(videoId);
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Summary generation failed";
    await db
      .update(summaries)
      .set({
        status: "failed",
        error: message,
        updatedAt: new Date(),
      })
      .where(eq(summaries.videoId, videoId));
  }
}

async function enqueueSummary(videoId: string) {
  const videoRows = await db
    .select({ id: videos.id, status: videos.status })
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);
  const video = videoRows[0];
  if (!video || video.status !== "ready") {
    return;
  }

  const transcriptRows = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.videoId, videoId))
    .limit(1);
  const transcript = transcriptRows[0];
  if (!transcript || transcript.status !== "ready") {
    return;
  }

  const existingRows = await db
    .select()
    .from(summaries)
    .where(eq(summaries.videoId, videoId))
    .limit(1);
  const existing = existingRows[0];

  if (existing?.status === "processing" || existing?.status === "ready") {
    return;
  }

  if (!existing) {
    try {
      await db.insert(summaries).values({
        videoId,
        status: "pending",
        provider: "gemini",
        model: GEMINI_MODEL,
      });
    } catch {
      const raced = await db
        .select()
        .from(summaries)
        .where(eq(summaries.videoId, videoId))
        .limit(1);
      if (raced[0]?.status === "processing" || raced[0]?.status === "ready") {
        return;
      }
    }
  }

  const claimed = await db
    .update(summaries)
    .set({
      status: "processing",
      error: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(summaries.videoId, videoId),
        inArray(summaries.status, ["pending", "failed"]),
      ),
    )
    .returning();

  if (!claimed[0]) {
    return;
  }

  const segments = transcript.segments ?? [];
  if (segments.length === 0) {
    await db
      .update(summaries)
      .set({
        status: "ready",
        error: null,
        overview: EMPTY_OVERVIEW,
        keyPoints: [],
        provider: "gemini",
        model: GEMINI_MODEL,
        updatedAt: new Date(),
      })
      .where(eq(summaries.id, claimed[0].id));
    return;
  }

  const generated = await generateSummaryFromTranscript(transcriptText(segments));

  await db
    .update(summaries)
    .set({
      status: "ready",
      error: null,
      overview: generated.overview,
      keyPoints: generated.keyPoints,
      provider: "gemini",
      model: GEMINI_MODEL,
      updatedAt: new Date(),
    })
    .where(eq(summaries.id, claimed[0].id));
}
