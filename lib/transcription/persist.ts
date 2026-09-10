import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transcripts } from "@/lib/db/schema";
import {
  getAssemblyAISentenceSegments,
  getAssemblyAITranscript,
} from "@/lib/transcription/assemblyai";

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

export async function persistAssemblyAIResult(providerJobId: string) {
  const rows = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.providerJobId, providerJobId))
    .limit(1);

  const transcript = rows[0];
  if (!transcript || transcript.status === "ready") {
    return;
  }

  const job = await getAssemblyAITranscript(providerJobId);

  if (job.status === "error") {
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
    const segments = await getAssemblyAISentenceSegments(providerJobId);

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
  } catch (caught) {
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
