import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "./client";
import { getR2Config } from "./config";
import { UPLOAD_URL_EXPIRES_IN } from "./presign";

export async function createMultipartUpload(key: string, contentType: string) {
  const { bucket } = getR2Config();

  const response = await getR2Client().send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
  );

  if (!response.UploadId) {
    throw new Error("R2 did not return an upload id");
  }

  return response.UploadId;
}

export async function createPartUploadUrl(
  key: string,
  uploadId: string,
  partNumber: number,
) {
  const { bucket } = getR2Config();

  const uploadUrl = await getSignedUrl(
    getR2Client(),
    new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: UPLOAD_URL_EXPIRES_IN },
  );

  return { uploadUrl, expiresIn: UPLOAD_URL_EXPIRES_IN };
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
) {
  const { bucket } = getR2Config();

  await getR2Client().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        })),
      },
    }),
  );
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  const { bucket } = getR2Config();

  await getR2Client().send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    }),
  );
}
