import { getAppUrl } from "@/lib/videos";

export function embedPath(videoId: string) {
  return `/embed/${videoId}`;
}

export function embedUrl(videoId: string) {
  return `${getAppUrl()}${embedPath(videoId)}`;
}

export function embedIframeCode(videoId: string) {
  return `<div style="position: relative; padding-bottom: 56.25%; height: 0;">
  <iframe
    src="${embedUrl(videoId)}"
    frameborder="0"
    allow="autoplay; fullscreen; picture-in-picture"
    allowfullscreen
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
  </iframe>
</div>`;
}
