import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { VIDEO_ID_PATTERN } from "@/lib/videos";

export const CONTENT_TYPE_EXTENSIONS = {
  "video/webm": "webm",
  "video/mp4": "mp4",
} as const;

export type AllowedContentType = keyof typeof CONTENT_TYPE_EXTENSIONS;

export function isAllowedContentType(
  value: string,
): value is AllowedContentType {
  return value in CONTENT_TYPE_EXTENSIONS;
}

export function contentTypeFromKey(key: string): AllowedContentType {
  return key.endsWith(".mp4") ? "video/mp4" : "video/webm";
}

export async function loadOwnedVideo(id: string, userId: string) {
  if (!VIDEO_ID_PATTERN.test(id)) {
    return null;
  }

  const rows = await db
    .select()
    .from(videos)
    .where(and(eq(videos.id, id), eq(videos.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

export function parsePartNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  if (value < 1 || value > 10_000) {
    return null;
  }

  return value;
}

export function parseCompletedParts(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const parts: { partNumber: number; etag: string }[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const record = item as { partNumber?: unknown; etag?: unknown };
    const partNumber = parsePartNumber(record.partNumber);
    const etag = typeof record.etag === "string" ? record.etag.trim() : "";

    if (partNumber == null || !etag) {
      return null;
    }

    parts.push({ partNumber, etag });
  }

  return parts.sort((a, b) => a.partNumber - b.partNumber);
}
