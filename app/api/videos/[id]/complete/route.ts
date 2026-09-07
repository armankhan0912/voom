import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/current-user";
import { objectExists } from "@/lib/r2/client";
import { serializeVideo, VIDEO_ID_PATTERN } from "@/lib/videos";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  if (!VIDEO_ID_PATTERN.test(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(videos)
    .where(and(eq(videos.id, id), eq(videos.userId, user.id)))
    .limit(1);

  const video = rows[0];

  if (!video) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let duration: number | null = video.duration;
  let title = video.title;
  let failed = false;

  try {
    const body = (await request.json()) as {
      duration?: unknown;
      title?: unknown;
      failed?: unknown;
    };

    if (typeof body.duration === "number" && Number.isFinite(body.duration)) {
      duration = Math.max(0, Math.round(body.duration));
    }

    if (typeof body.title === "string" && body.title.trim()) {
      title = body.title.trim().slice(0, 120);
    }

    if (body.failed === true) {
      failed = true;
    }
  } catch {
    // Empty body is allowed.
  }

  if (!failed && !(await objectExists(video.s3Key))) {
    return Response.json(
      { error: "Upload not found in storage" },
      { status: 400 },
    );
  }

  const updated = await db
    .update(videos)
    .set({
      title,
      duration,
      status: failed ? "failed" : "ready",
      updatedAt: new Date(),
    })
    .where(eq(videos.id, video.id))
    .returning();

  return Response.json({ video: serializeVideo(updated[0]) });
}
