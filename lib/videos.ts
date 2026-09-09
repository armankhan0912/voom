import { videos } from "@/lib/db/schema";

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function watchPath(videoId: string) {
  return `/voom/${videoId}`;
}

export function shareUrl(videoId: string) {
  return `${getAppUrl()}${watchPath(videoId)}`;
}

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

export const VIDEO_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeTitle(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const title = value.trim().slice(0, 120);
  return title.length > 0 ? title : null;
}
