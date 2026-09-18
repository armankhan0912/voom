export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptStatus = "pending" | "processing" | "ready" | "failed";

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
