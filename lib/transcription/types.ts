export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptStatus = "pending" | "processing" | "ready" | "failed";

const NON_LATIN_LETTER = /[^\p{Script=Latin}\p{N}\p{P}\p{Z}\p{S}\p{M}]/u;

export function transcriptNeedsEnglish(
  segments: TranscriptSegment[] | null | undefined,
) {
  return (segments ?? []).some((segment) => NON_LATIN_LETTER.test(segment.text));
}

export function looksLikeCombinedTranscript(
  segments: TranscriptSegment[] | null | undefined,
) {
  if (!segments || segments.length !== 1) {
    return false;
  }

  const text = segments[0]?.text?.trim() ?? "";
  if (text.length >= 280) {
    return true;
  }

  return (text.match(/[.?!।]/g)?.length ?? 0) >= 3;
}
