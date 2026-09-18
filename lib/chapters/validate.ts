import type { Chapter } from "@/lib/chapters/types";
import type { TranscriptSegment } from "@/lib/transcription/types";

const MAX_CHAPTERS = 8;
const MAX_TITLE_LENGTH = 80;

function startKey(start: number) {
  return Math.round(start * 1000);
}

function nearestTranscriptStart(start: number, segments: TranscriptSegment[]) {
  if (segments.length === 0) {
    return null;
  }

  let best = segments[0].start;
  let bestDistance = Math.abs(start - best);

  for (const segment of segments) {
    const distance = Math.abs(start - segment.start);
    if (distance < bestDistance) {
      best = segment.start;
      bestDistance = distance;
    }
  }

  return best;
}

export function validateGeneratedChapters(
  value: unknown,
  segments: TranscriptSegment[],
): Chapter[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const payload = value as { chapters?: unknown };
  if (!Array.isArray(payload.chapters)) {
    return [];
  }

  const seen = new Set<number>();
  const validated: Chapter[] = [];

  for (const item of payload.chapters) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const chapter = item as { start?: unknown; title?: unknown };
    if (typeof chapter.start !== "number" || !Number.isFinite(chapter.start)) {
      continue;
    }

    if (typeof chapter.title !== "string" || !chapter.title.trim()) {
      continue;
    }

    const canonicalStart = nearestTranscriptStart(chapter.start, segments);
    if (canonicalStart == null) {
      continue;
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
