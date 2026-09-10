import { timingSafeEqual } from "crypto";
import type { TranscriptSegment } from "@/lib/transcription/types";

const ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2";
export const ASSEMBLYAI_WEBHOOK_HEADER = "X-Voom-Transcript-Secret";

type AssemblyAITranscript = {
  id: string;
  status: string;
  error?: string | null;
  language_code?: string | null;
};

type AssemblyAISentence = {
  start: number;
  end: number;
  text: string;
};

function getApiKey() {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    throw new Error("ASSEMBLYAI_API_KEY is not set");
  }
  return key;
}

export function getWebhookSecret() {
  return process.env.ASSEMBLYAI_WEBHOOK_SECRET ?? "";
}

export function isWebhookAuthorized(request: Request) {
  const expected = getWebhookSecret();
  const received = request.headers.get(ASSEMBLYAI_WEBHOOK_HEADER);

  if (!expected || !received) {
    return false;
  }

  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function millisecondsToSeconds(ms: number) {
  return Math.round(ms) / 1000;
}

export function mapSentencesToSegments(
  sentences: AssemblyAISentence[],
): TranscriptSegment[] {
  return sentences.map((sentence) => ({
    start: millisecondsToSeconds(sentence.start),
    end: millisecondsToSeconds(sentence.end),
    text: sentence.text,
  }));
}

async function assemblyaiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ASSEMBLYAI_BASE_URL}${path}`, {
    ...init,
    headers: {
      authorization: getApiKey(),
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || "AssemblyAI request failed");
  }

  if (!payload) {
    throw new Error("AssemblyAI returned an empty response");
  }

  return payload;
}

export async function submitAssemblyAITranscript(options: {
  audioUrl: string;
  webhookUrl?: string;
  webhookSecret?: string;
}) {
  const body: Record<string, unknown> = {
    audio_url: options.audioUrl,
    speech_models: ["universal-3-5-pro", "universal-2"],
    language_detection: true,
  };

  if (options.webhookUrl && options.webhookSecret) {
    body.webhook_url = options.webhookUrl;
    body.webhook_auth_header_name = ASSEMBLYAI_WEBHOOK_HEADER;
    body.webhook_auth_header_value = options.webhookSecret;
  }

  return assemblyaiRequest<AssemblyAITranscript>("/transcript", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getAssemblyAITranscript(id: string) {
  return assemblyaiRequest<AssemblyAITranscript>(`/transcript/${id}`);
}

export async function getAssemblyAISentenceSegments(id: string) {
  const payload = await assemblyaiRequest<{ sentences?: AssemblyAISentence[] }>(
    `/transcript/${id}/sentences`,
  );

  return mapSentencesToSegments(payload.sentences ?? []);
}
