import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

const accountId = requiredEnv("R2_ACCOUNT_ID");
const bucket = requiredEnv("R2_BUCKET");

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

async function main() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log("Bucket is reachable.");
  } catch (error) {
    console.log(
      `HeadBucket skipped: ${error instanceof Error ? error.name : "Error"}`,
    );
  }

  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ["http://localhost:3000"],
              AllowedMethods: ["GET", "PUT", "HEAD"],
              AllowedHeaders: ["content-type"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    console.log("CORS set for http://localhost:3000");
  } catch (error) {
    console.log(
      `CORS not set automatically: ${error instanceof Error ? error.name : "Error"}`,
    );
    console.log(
      "Set CORS in Cloudflare: R2 → bucket → Settings → CORS policy.",
    );
  }

  const key = `voom-setup-check/${Date.now()}.txt`;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: "text/plain",
    }),
    { expiresIn: 60 },
  );

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: "ok",
    headers: { "Content-Type": "text/plain" },
  });

  if (!putResponse.ok) {
    throw new Error(`Presigned PUT failed: ${putResponse.status}`);
  }

  await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

  const playbackUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 },
  );
  const getResponse = await fetch(playbackUrl);

  if (!getResponse.ok) {
    throw new Error(`Presigned GET failed: ${getResponse.status}`);
  }

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log("Presigned upload and playback succeeded.");
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
  process.exit(1);
});
