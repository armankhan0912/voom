import { summaries } from "@/lib/db/schema";

export function serializeSummary(summary: typeof summaries.$inferSelect) {
  return {
    videoId: summary.videoId,
    status: summary.status,
    error: summary.error,
    overview: summary.status === "ready" ? summary.overview : null,
    keyPoints: summary.status === "ready" ? (summary.keyPoints ?? []) : null,
  };
}
