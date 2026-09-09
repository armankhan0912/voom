import { DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getR2Config } from "./config";

let client: S3Client | undefined;

export function getR2Client() {
  if (!client) {
    const { endpoint, accessKeyId, secretAccessKey } = getR2Config();

    client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  return client;
}

export async function objectExists(key: string) {
  const { bucket } = getR2Config();

  try {
    await getR2Client().send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteObject(key: string) {
  const { bucket } = getR2Config();

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}
