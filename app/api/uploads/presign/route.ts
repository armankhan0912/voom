import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCurrentDbUser } from "@/lib/current-user";
import { getS3Client } from "@/lib/s3/client";
import { getS3Config } from "@/lib/s3/config";

const UPLOAD_URL_EXPIRES_IN = 15 * 60;

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

  try {
    const body = (await request.json()) as { contentType?: unknown };

    if (typeof body.contentType === "string") {
      contentType = body.contentType;
    }
  } catch {
    // Empty or invalid JSON is treated as the default video/webm upload.
  }

  if (!isAllowedContentType(contentType)) {
    return Response.json({ error: "Unsupported content type" }, { status: 400 });
  }

  const { bucket } = getS3Config();
  const key = `videos/${user.id}/${crypto.randomUUID()}.${CONTENT_TYPE_EXTENSIONS[contentType]}`;

  const uploadUrl = await getSignedUrl(
    getS3Client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: UPLOAD_URL_EXPIRES_IN },
  );

  return Response.json({
    uploadUrl,
    key,
    contentType,
    expiresIn: UPLOAD_URL_EXPIRES_IN,
  });
}
