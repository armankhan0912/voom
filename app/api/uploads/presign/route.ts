import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/current-user";
import { createUploadUrl } from "@/lib/r2/presign";
import { serializeVideo } from "@/lib/videos";

const CONTENT_TYPE_EXTENSIONS = {
  "video/webm": "webm",
  "video/mp4": "mp4",
} as const;

type AllowedContentType = keyof typeof CONTENT_TYPE_EXTENSIONS;

function isAllowedContentType(value: string): value is AllowedContentType {
  return value in CONTENT_TYPE_EXTENSIONS;
}

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
  const { uploadUrl, expiresIn } = await createUploadUrl(key, contentType);

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

  return Response.json({
    uploadUrl,
    key,
    contentType,
    expiresIn,
    video: serializeVideo(video),
  });
}
