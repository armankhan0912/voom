import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/current-user";
import { deleteObject } from "@/lib/r2/client";
import { createPlaybackUrl } from "@/lib/r2/presign";
import {
  normalizeTitle,
  serializeVideo,
  VIDEO_ID_PATTERN,
} from "@/lib/videos";

async function loadVideo(id: string) {
  if (!VIDEO_ID_PATTERN.test(id)) {
    return null;
  }

  const rows = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const video = await loadVideo(id);

  if (!video) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getCurrentDbUser();
  const isOwner = user?.id === video.userId;

  if (video.status !== "ready" && !isOwner) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const playbackUrl =
    video.status === "ready" ? await createPlaybackUrl(video.s3Key) : undefined;

  return Response.json(serializeVideo(video, { playbackUrl }));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const video = await loadVideo(id);

  if (!video || video.userId !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let title: string | null = null;
  try {
    const body = (await request.json()) as { title?: unknown };
    title = normalizeTitle(body.title);
  } catch {
    title = null;
  }

  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  const updated = await db
    .update(videos)
    .set({
      title,
      updatedAt: new Date(),
    })
    .where(and(eq(videos.id, video.id), eq(videos.userId, user.id)))
    .returning();

  return Response.json({ video: serializeVideo(updated[0]) });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const video = await loadVideo(id);

  if (!video || video.userId !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteObject(video.s3Key);
  } catch {
    return Response.json({ error: "Could not delete recording" }, { status: 500 });
  }

  await db
    .delete(videos)
    .where(and(eq(videos.id, video.id), eq(videos.userId, user.id)));

  return Response.json({ ok: true });
}
