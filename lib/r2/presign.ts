import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "./client";
import { getR2Config } from "./config";

const UPLOAD_URL_EXPIRES_IN = 15 * 60;
const PLAYBACK_URL_EXPIRES_IN = 60 * 60;
const TRANSCRIPTION_URL_EXPIRES_IN = 6 * 60 * 60;

export async function createUploadUrl(key: string, contentType: string) {
  const { bucket } = getR2Config();

  const uploadUrl = await getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: UPLOAD_URL_EXPIRES_IN },
  );

  return { uploadUrl, expiresIn: UPLOAD_URL_EXPIRES_IN };
}

export async function createPlaybackUrl(key: string) {
  const { bucket } = getR2Config();

  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: PLAYBACK_URL_EXPIRES_IN },
  );
}

export async function createTranscriptionUrl(key: string) {
  const { bucket } = getR2Config();

  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: TRANSCRIPTION_URL_EXPIRES_IN },
  );
}

export {
  PLAYBACK_URL_EXPIRES_IN,
  TRANSCRIPTION_URL_EXPIRES_IN,
  UPLOAD_URL_EXPIRES_IN,
};
