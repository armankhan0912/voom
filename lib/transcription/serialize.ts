import { transcripts } from "@/lib/db/schema";

export function serializeTranscript(transcript: typeof transcripts.$inferSelect) {
  return {
    videoId: transcript.videoId,
    status: transcript.status,
    error: transcript.error,
    language: transcript.language,
    segments: transcript.status === "ready" ? (transcript.segments ?? []) : null,
  };
}
