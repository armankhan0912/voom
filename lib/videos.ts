export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://voom-video.vercel.app").replace(
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

export const VIDEO_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeTitle(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const title = value.trim().slice(0, 120);
  return title.length > 0 ? title : null;
}

export function videoDownloadFilename(title: string) {
  const safe = title
    .replace(/["\\]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  const base = safe || "voom";
  return base.toLowerCase().endsWith(".webm") ? base : `${base}.webm`;
}
