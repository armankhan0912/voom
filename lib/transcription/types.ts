export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptStatus = "pending" | "processing" | "ready" | "failed";
