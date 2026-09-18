import { timingSafeEqual } from "crypto";
import type { TranscriptSegment } from "@/lib/transcription/types";

const ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2";
export const ASSEMBLYAI_WEBHOOK_HEADER = "X-Voom-Transcript-Secret";

type AssemblyAIUtterance = {
  start: number;
  end: number;
  text: string;
  translated_texts?: Record<string, string | null> | null;
};

type AssemblyAITranscript = {
  id: string;
  status: string;
  error?: string | null;
  language_code?: string | null;
  utterances?: AssemblyAIUtterance[] | null;
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

export function mapUtterancesToEnglishSegments(
  utterances: AssemblyAIUtterance[],
): TranscriptSegment[] {
  return utterances
    .map((utterance) => {
      const translated = utterance.translated_texts?.en?.trim();
      const text = translated || utterance.text.trim();
      if (!text) {
        return null;
      }

      return {
        start: millisecondsToSeconds(utterance.start),
        end: millisecondsToSeconds(utterance.end),
        text,
      };
    })
    .filter((segment): segment is TranscriptSegment => segment != null);
}

function splitTextByWeights(text: string, weights: number[]): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return weights.map(() => "");
  }

  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const parts: string[] = [];
  let cursor = 0;

  for (let index = 0; index < weights.length; index += 1) {
    if (index === weights.length - 1 || cursor >= words.length) {
      parts.push(words.slice(cursor).join(" "));
      cursor = words.length;
      continue;
    }

    const remainingSlots = weights.length - index;
    const remainingWords = words.length - cursor;
    const share = Math.max(
      1,
      Math.min(
        remainingWords - remainingSlots + 1,
        Math.round((words.length * weights[index]) / total),
      ),
    );
    const next = Math.min(words.length, cursor + share);
    parts.push(words.slice(cursor, next).join(" "));
    cursor = next;
  }

  return parts;
}

function splitTranslatedText(translated: string, originalTexts: string[]): string[] {
  if (originalTexts.length <= 1) {
    return [translated];
  }

  const punctuated = translated
    .split(/(?<=[.?!।])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (punctuated.length === originalTexts.length) {
    return punctuated;
  }

  return splitTextByWeights(
    translated,
    originalTexts.map((text) => Math.max(text.trim().length, 1)),
  );
}

export function applyEnglishTranslationsToSentences(
  sentences: TranscriptSegment[],
  utterances: AssemblyAIUtterance[],
): TranscriptSegment[] {
  if (sentences.length === 0 || utterances.length === 0) {
    return sentences;
  }

  const mapped = sentences.map((sentence) => ({ ...sentence }));

  for (const utterance of utterances) {
    const translated = utterance.translated_texts?.en?.trim();
    if (!translated) {
      continue;
    }

    const start = millisecondsToSeconds(utterance.start);
    const end = millisecondsToSeconds(utterance.end);
    const indexes: number[] = [];

    for (let index = 0; index < mapped.length; index += 1) {
      const sentence = mapped[index];
      if (sentence.start >= start - 0.05 && sentence.start < end + 0.05) {
        indexes.push(index);
      }
    }

    if (indexes.length === 0) {
      continue;
    }

    const parts = splitTranslatedText(
      translated,
      indexes.map((index) => mapped[index].text),
    );

    indexes.forEach((index, offset) => {
      const part = parts[offset]?.trim();
      if (part) {
        mapped[index] = { ...mapped[index], text: part };
      }
    });
  }

  return mapped;
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
    speaker_labels: true,
    speech_understanding: {
      request: {
        translation: {
          target_languages: ["en"],
          match_original_utterance: true,
        },
      },
    },
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

export async function getEnglishTranscriptSegments(job: AssemblyAITranscript) {
  const sentences = await getAssemblyAISentenceSegments(job.id);
  const utterances = job.utterances ?? [];

  if (sentences.length === 0) {
    return mapUtterancesToEnglishSegments(utterances);
  }

  return applyEnglishTranslationsToSentences(sentences, utterances);
}
