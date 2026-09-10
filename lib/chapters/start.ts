import { and, eq, inArray } from "drizzle-orm";
import { validateGeneratedChapters } from "@/lib/chapters/validate";
import { db } from "@/lib/db";
import { chapters, transcripts, videos } from "@/lib/db/schema";
import {
  GEMINI_MODEL,
  formatTimestampedTranscript,
  generateChaptersJsonFromTranscript,
} from "@/lib/summary/gemini";
import type { TranscriptSegment } from "@/lib/transcription/types";

function usableSegments(segments: TranscriptSegment[]) {
  return segments.filter((segment) => segment.text.trim().length > 0);
}

export async function startChapters(videoId: string) {
  try {
    await enqueueChapters(videoId);
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Chapter generation failed";
    await db
      .update(chapters)
      .set({
        status: "failed",
        error: message,
        updatedAt: new Date(),
      })
      .where(eq(chapters.videoId, videoId));
  }
}

async function enqueueChapters(videoId: string) {
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
    .from(chapters)
    .where(eq(chapters.videoId, videoId))
    .limit(1);
  const existing = existingRows[0];

  if (existing?.status === "processing" || existing?.status === "ready") {
    return;
  }

  if (!existing) {
    try {
      await db.insert(chapters).values({
        videoId,
        status: "pending",
        provider: "gemini",
        model: GEMINI_MODEL,
      });
    } catch {
      const raced = await db
        .select()
        .from(chapters)
        .where(eq(chapters.videoId, videoId))
        .limit(1);
      if (raced[0]?.status === "processing" || raced[0]?.status === "ready") {
        return;
      }
    }
  }

  const claimed = await db
    .update(chapters)
    .set({
      status: "processing",
      error: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(chapters.videoId, videoId),
        inArray(chapters.status, ["pending", "failed"]),
      ),
    )
    .returning();

  if (!claimed[0]) {
    return;
  }

  const segments = usableSegments(transcript.segments ?? []);
  if (segments.length === 0) {
    await db
      .update(chapters)
      .set({
        status: "ready",
        error: null,
        chapters: [],
        provider: "gemini",
        model: GEMINI_MODEL,
        updatedAt: new Date(),
      })
      .where(eq(chapters.id, claimed[0].id));
    return;
  }

  const generated = await generateChaptersJsonFromTranscript(
    formatTimestampedTranscript(segments),
  );
  const validated = validateGeneratedChapters(generated, segments);

  await db
    .update(chapters)
    .set({
      status: "ready",
      error: null,
      chapters: validated,
      provider: "gemini",
      model: GEMINI_MODEL,
      updatedAt: new Date(),
    })
    .where(eq(chapters.id, claimed[0].id));
}
