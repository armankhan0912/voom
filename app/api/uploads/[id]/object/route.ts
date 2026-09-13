import { getCurrentDbUser } from "@/lib/current-user";
import { createUploadUrl } from "@/lib/r2/presign";
import { contentTypeFromKey, loadOwnedVideo } from "@/lib/uploads";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const video = await loadOwnedVideo(id, user.id);

  if (!video || video.status !== "uploading") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (video.r2UploadId) {
    return Response.json(
      { error: "Recording already uses multipart upload" },
      { status: 400 },
    );
  }

  const contentType = contentTypeFromKey(video.s3Key);
  const { uploadUrl, expiresIn } = await createUploadUrl(video.s3Key, contentType);

  return Response.json({
    uploadUrl,
    contentType,
    expiresIn,
    key: video.s3Key,
  });
}
