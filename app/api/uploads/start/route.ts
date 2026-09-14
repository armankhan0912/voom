import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/current-user";
import {
  CONTENT_TYPE_EXTENSIONS,
  isAllowedContentType,
} from "@/lib/uploads";
import { serializeVideo } from "@/lib/serialize-video";

export async function POST(request: Request) {
  const user = await getCurrentDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let contentType: string = "video/webm";
  let title = "Untitled recording";

  try {
    const body = (await request.json()) as {
      contentType?: unknown;
      title?: unknown;
    };

    if (typeof body.contentType === "string") {
      contentType = body.contentType;
    }

    if (typeof body.title === "string" && body.title.trim()) {
      title = body.title.trim().slice(0, 120);
    }
  } catch {
    // Empty or invalid JSON uses defaults.
  }

  if (!isAllowedContentType(contentType)) {
    return Response.json({ error: "Unsupported content type" }, { status: 400 });
  }

  const key = `videos/${user.id}/${crypto.randomUUID()}.${CONTENT_TYPE_EXTENSIONS[contentType]}`;

  const created = await db
    .insert(videos)
    .values({
      userId: user.id,
      title,
      s3Key: key,
      status: "uploading",
    })
    .returning();

  const video = created[0];

  console.log("[voom] upload session created", video.id);

  return Response.json({
    key,
    contentType,
    video: serializeVideo(video),
  });
}
