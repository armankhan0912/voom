import { getCurrentDbUser } from "@/lib/current-user";
import { createPartUploadUrl } from "@/lib/r2/multipart";
import { loadOwnedVideo, parsePartNumber } from "@/lib/uploads";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const video = await loadOwnedVideo(id, user.id);

  if (!video || video.status !== "uploading" || !video.r2UploadId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let partNumber: number | null = null;

  try {
    const body = (await request.json()) as { partNumber?: unknown };
    partNumber = parsePartNumber(body.partNumber);
  } catch {
    partNumber = null;
  }

  if (partNumber == null) {
    return Response.json({ error: "Invalid part number" }, { status: 400 });
  }

  const { uploadUrl, expiresIn } = await createPartUploadUrl(
    video.s3Key,
    video.r2UploadId,
    partNumber,
  );

  return Response.json({ uploadUrl, expiresIn, partNumber });
}
