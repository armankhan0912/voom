import { videos } from "@/lib/db/schema";
import { shareUrl } from "@/lib/videos";

export function serializeVideo(
  video: typeof videos.$inferSelect,
  extras?: { playbackUrl?: string },
) {
  return {
    id: video.id,
    title: video.title,
    status: video.status,
    duration: video.duration,
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
    shareUrl: shareUrl(video.id),
    ...extras,
  };
}
