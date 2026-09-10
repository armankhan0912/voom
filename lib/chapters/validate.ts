import type { Chapter } from "@/lib/chapters/types";
import type { TranscriptSegment } from "@/lib/transcription/types";

const MAX_CHAPTERS = 8;
const MAX_TITLE_LENGTH = 80;

function startKey(start: number) {
  return Math.round(start * 1000);
}

function transcriptStartMap(segments: TranscriptSegment[]) {
  const starts = new Map<number, number>();
  for (const segment of segments) {
    const key = startKey(segment.start);
    if (!starts.has(key)) {
      starts.set(key, segment.start);
    }
  }
  return starts;
}

export function validateGeneratedChapters(
  value: unknown,
  segments: TranscriptSegment[],
): Chapter[] {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini returned an invalid chapters payload");
  }

  const payload = value as { chapters?: unknown };
  if (!Array.isArray(payload.chapters)) {
    throw new Error("Gemini returned a payload without chapters");
  }

  const allowedStarts = transcriptStartMap(segments);
  const seen = new Set<number>();
  const validated: Chapter[] = [];

  for (const item of payload.chapters) {
    if (!item || typeof item !== "object") {
      throw new Error("Gemini returned an invalid chapter");
    }

    const chapter = item as { start?: unknown; title?: unknown };
    if (typeof chapter.start !== "number" || !Number.isFinite(chapter.start)) {
      throw new Error("Gemini returned a chapter with an invalid timestamp");
    }

    if (typeof chapter.title !== "string" || !chapter.title.trim()) {
      throw new Error("Gemini returned a chapter without a title");
    }

    const canonicalStart = allowedStarts.get(startKey(chapter.start));
    if (canonicalStart == null) {
      throw new Error("Gemini returned a chapter timestamp that is not in the transcript");
    }

    if (seen.has(startKey(canonicalStart))) {
      continue;
    }

    seen.add(startKey(canonicalStart));
    validated.push({
      start: canonicalStart,
      title: chapter.title.trim().slice(0, MAX_TITLE_LENGTH),
    });
  }

  validated.sort((left, right) => left.start - right.start);
  return validated.slice(0, MAX_CHAPTERS);
}
