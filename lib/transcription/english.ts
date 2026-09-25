import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transcripts } from "@/lib/db/schema";
import { translateLinesToEnglish } from "@/lib/summary/gemini";
import {
  transcriptNeedsEnglish,
  type TranscriptSegment,
} from "@/lib/transcription/types";

const translating = new Set<string>();
const retryAfter = new Map<string, number>();
const RETRY_DELAY_MS = 20_000;

export async function ensureEnglishSegments(
  segments: TranscriptSegment[],
): Promise<TranscriptSegment[]> {
  if (!transcriptNeedsEnglish(segments)) {
    return segments;
  }

  const lines = segments.map((segment) => segment.text);
  const translated = await translateLinesToEnglish(lines);

  return segments.map((segment, index) => {
    const text = translated[index];
    if (!text) {
      return segment;
    }
    return { ...segment, text };
  });
}

export async function translateStoredTranscript(transcriptId: string) {
  if (translating.has(transcriptId)) {
    return;
  }

  const nextRetry = retryAfter.get(transcriptId) ?? 0;
  if (nextRetry > Date.now()) {
    return;
  }

  translating.add(transcriptId);
  try {
    const rows = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.id, transcriptId))
      .limit(1);
    const transcript = rows[0];
    if (!transcript || transcript.status !== "ready") {
      return;
    }

    const segments = transcript.segments ?? [];
    if (!transcriptNeedsEnglish(segments)) {
      return;
    }

    const english = await ensureEnglishSegments(segments);
    if (transcriptNeedsEnglish(english)) {
      retryAfter.set(transcriptId, Date.now() + RETRY_DELAY_MS);
      return;
    }

    retryAfter.delete(transcriptId);
    await db
      .update(transcripts)
      .set({
        segments: english,
        updatedAt: new Date(),
      })
      .where(eq(transcripts.id, transcriptId));
  } catch (caught) {
    retryAfter.set(transcriptId, Date.now() + RETRY_DELAY_MS);
    console.error(
      "Could not translate transcript",
      caught instanceof Error ? caught.message : caught,
    );
  } finally {
    translating.delete(transcriptId);
  }
}
