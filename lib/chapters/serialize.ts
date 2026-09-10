import { chapters } from "@/lib/db/schema";

export function serializeChapters(record: typeof chapters.$inferSelect) {
  return {
    videoId: record.videoId,
    status: record.status,
    error: record.error,
    chapters: record.status === "ready" ? (record.chapters ?? []) : null,
  };
}
