import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transcripts } from "@/lib/db/schema";
import { startChapters } from "@/lib/chapters/start";
import { startSummary } from "@/lib/summary/start";
import {
  getAssemblyAITranscript,
  getEnglishTranscriptSegments,
} from "@/lib/transcription/assemblyai";
import { ensureEnglishSegments } from "@/lib/transcription/english";
import { looksLikeCombinedTranscript } from "@/lib/transcription/types";

export async function markTranscriptFailedByVideoId(
  videoId: string,
  error: string,
) {
  await db
    .update(transcripts)
    .set({
      status: "failed",
      error,
      updatedAt: new Date(),
    })
    .where(eq(transcripts.videoId, videoId));
}

function scheduleAfterTranscriptReady(videoId: string) {
  after(() => {
    void startSummary(videoId);
    void startChapters(videoId);
  });
}

const refreshingJobs = new Set<string>();

export async function persistAssemblyAIResult(providerJobId: string) {
  if (refreshingJobs.has(providerJobId)) {
    return;
  }

  refreshingJobs.add(providerJobId);
  try {
    await persistAssemblyAIResultInner(providerJobId);
  } finally {
    refreshingJobs.delete(providerJobId);
  }
}

async function persistAssemblyAIResultInner(providerJobId: string) {
  const rows = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.providerJobId, providerJobId))
    .limit(1);

  const transcript = rows[0];
  if (!transcript) {
    return;
  }

  const refreshingCombined =
    transcript.status === "ready" &&
    looksLikeCombinedTranscript(transcript.segments);

  if (transcript.status === "ready" && !refreshingCombined) {
    scheduleAfterTranscriptReady(transcript.videoId);
    return;
  }

  const job = await getAssemblyAITranscript(providerJobId);

  if (job.status === "error") {
    if (refreshingCombined) {
      return;
    }

    await db
      .update(transcripts)
      .set({
        status: "failed",
        error: job.error || "Transcription failed",
        updatedAt: new Date(),
      })
      .where(eq(transcripts.providerJobId, providerJobId));
    return;
  }

  if (job.status !== "completed") {
    return;
  }

  try {
    const segments = await ensureEnglishSegments(
      await getEnglishTranscriptSegments(job),
    );

    await db
      .update(transcripts)
      .set({
        status: "ready",
        error: null,
        language: job.language_code ?? null,
        segments,
        updatedAt: new Date(),
      })
      .where(eq(transcripts.providerJobId, providerJobId));

    scheduleAfterTranscriptReady(transcript.videoId);
  } catch (caught) {
    if (refreshingCombined) {
      return;
    }

    const message =
      caught instanceof Error ? caught.message : "Could not save transcript";
    await db
      .update(transcripts)
      .set({
        status: "failed",
        error: message,
        updatedAt: new Date(),
      })
      .where(eq(transcripts.providerJobId, providerJobId));
  }
}
