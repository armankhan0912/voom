import { S3Client } from "@aws-sdk/client-s3";
import { getS3Config } from "./config";

let client: S3Client | undefined;

export function getS3Client() {
  if (!client) {
    const { region, accessKeyId, secretAccessKey } = getS3Config();

    client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return client;
}
