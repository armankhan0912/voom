import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { transcripts, videos } from "@/lib/db/schema";
import { createTranscriptionUrl } from "@/lib/r2/presign";
import {
  getAssemblyAITranscript,
  getWebhookSecret,
  submitAssemblyAITranscript,
} from "@/lib/transcription/assemblyai";
import {
  markTranscriptFailedByVideoId,
  persistAssemblyAIResult,
} from "@/lib/transcription/persist";
import { getAppUrl } from "@/lib/videos";

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 120;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLocalAppUrl(appUrl: string) {
  try {
    const { hostname } = new URL(appUrl);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return true;
  }
}

export async function startTranscription(videoId: string) {
  try {
    await enqueueTranscription(videoId);
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Transcription failed";
    await markTranscriptFailedByVideoId(videoId, message);
  }
}

async function enqueueTranscription(videoId: string) {
  const videoRows = await db
    .select()
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);
  const video = videoRows[0];

  if (!video || video.status !== "ready") {
    return;
  }

  const existingRows = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.videoId, videoId))
    .limit(1);
  const existing = existingRows[0];

  if (existing?.status === "processing" || existing?.status === "ready") {
    return;
  }

  if (!existing) {
    try {
      await db.insert(transcripts).values({
        videoId,
        status: "pending",
      });
    } catch {
      const raced = await db
        .select()
        .from(transcripts)
        .where(eq(transcripts.videoId, videoId))
        .limit(1);
      if (raced[0]?.status === "processing" || raced[0]?.status === "ready") {
        return;
      }
    }
  }

  const claimed = await db
    .update(transcripts)
    .set({
      status: "processing",
      error: null,
      providerJobId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transcripts.videoId, videoId),
        inArray(transcripts.status, ["pending", "failed"]),
      ),
    )
    .returning();

  if (!claimed[0]) {
    return;
  }

  const audioUrl = await createTranscriptionUrl(video.s3Key);
  const appUrl = getAppUrl();
  const webhookSecret = getWebhookSecret();
  const useWebhook = Boolean(webhookSecret) && !isLocalAppUrl(appUrl);

  const submitted = await submitAssemblyAITranscript({
    audioUrl,
    webhookUrl: useWebhook ? `${appUrl}/api/webhooks/assemblyai` : undefined,
    webhookSecret: useWebhook ? webhookSecret : undefined,
  });

  await db
    .update(transcripts)
    .set({
      providerJobId: submitted.id,
      updatedAt: new Date(),
    })
    .where(eq(transcripts.id, claimed[0].id));

  if (submitted.status === "error") {
    await markTranscriptFailedByVideoId(
      videoId,
      "AssemblyAI rejected the transcription request",
    );
    return;
  }

  if (!useWebhook) {
    await pollAssemblyAI(submitted.id);
  }
}

async function pollAssemblyAI(providerJobId: string) {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    const job = await getAssemblyAITranscript(providerJobId);
    if (job.status === "completed" || job.status === "error") {
      await persistAssemblyAIResult(providerJobId);
      return;
    }

    await delay(POLL_INTERVAL_MS);
  }

  await db
    .update(transcripts)
    .set({
      status: "failed",
      error: "Transcription timed out while waiting for AssemblyAI",
      updatedAt: new Date(),
    })
    .where(eq(transcripts.providerJobId, providerJobId));
}
