import type { GeneratedSummary } from "@/lib/summary/types";

export const GEMINI_MODEL = "gemini-3.6-flash";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You summarize a screen recording from its transcript only.

Write only in English. If the transcript is Hindi, Hinglish, or mixed, translate the meaning into English. Do not copy non-English wording.
Describe only what the speaker actually said. Do not invent details.
Do not include chapters, timestamps, speaker labels, quotes, action items, or titles.

Return JSON with:
- overview: 2–4 sentence recap
- keyPoints: 3–6 short bullet points of what was discussed`;

const SUMMARY_SCHEMA = {
  type: "OBJECT",
  properties: {
    overview: { type: "STRING" },
    keyPoints: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
  },
  required: ["overview", "keyPoints"],
};

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return key;
}

function parseGeneratedSummary(value: unknown): GeneratedSummary {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini returned an invalid summary payload");
  }

  const payload = value as { overview?: unknown; keyPoints?: unknown };
  if (typeof payload.overview !== "string" || !payload.overview.trim()) {
    throw new Error("Gemini summary is missing an overview");
  }

  if (!Array.isArray(payload.keyPoints)) {
    return {
      overview: payload.overview.trim(),
      keyPoints: [],
    };
  }

  const keyPoints = payload.keyPoints
    .filter((point): point is string => typeof point === "string")
    .map((point) => point.trim())
    .filter((point) => point.length > 0)
    .slice(0, 6);

  return {
    overview: payload.overview.trim(),
    keyPoints,
  };
}

function isRetryableGeminiError(error: Error, status?: number) {
  if (status === 429 || (status != null && status >= 500)) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("empty") ||
    message.includes("could not be parsed") ||
    message.includes("429") ||
    message.includes("unavailable")
  );
}

async function requestGeminiJson(options: {
  systemPrompt: string;
  userText: string;
  schema: unknown;
  emptyMessage: string;
  parseMessage: string;
}): Promise<unknown> {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getApiKey(),
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: options.systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: options.userText }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: options.schema,
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  } | null;

  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Gemini request failed");
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(options.emptyMessage);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(options.parseMessage);
  }
}

async function requestGeminiJsonWithRetry(options: {
  systemPrompt: string;
  userText: string;
  schema: unknown;
  emptyMessage: string;
  parseMessage: string;
}): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await requestGeminiJson(options);
    } catch (caught) {
      lastError = caught instanceof Error ? caught : new Error("Gemini request failed");
      const status = (caught as { status?: number }).status;
      if (!isRetryableGeminiError(lastError, status) || attempt === 1) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Gemini request failed");
}

export async function generateSummaryFromTranscript(
  transcriptText: string,
): Promise<GeneratedSummary> {
  const parsed = await requestGeminiJsonWithRetry({
    systemPrompt: SYSTEM_PROMPT,
    userText: `Transcript:\n${transcriptText}`,
    schema: SUMMARY_SCHEMA,
    emptyMessage: "Gemini returned an empty summary",
    parseMessage: "Gemini returned summary JSON that could not be parsed",
  });

  return parseGeneratedSummary(parsed);
}

const CHAPTERS_PROMPT = `You create video chapters from a timestamped transcript only.

Identify meaningful topic changes. Do not make a chapter for every sentence.
Create about 3–8 chapters, or fewer for a short recording.
Write concise titles only in English. If the transcript is Hindi, Hinglish, or mixed, translate the meaning into English. Do not copy non-English wording.
Describe only what the speaker actually said. Do not invent details.

Each chapter start must be copied from a transcript timestamp in the input.
Use the numeric start value after the pipe, not a rounded or invented time.

Return JSON with:
- chapters: array of { start, title }`;

const CHAPTERS_SCHEMA = {
  type: "OBJECT",
  properties: {
    chapters: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          start: { type: "NUMBER" },
          title: { type: "STRING" },
        },
        required: ["start", "title"],
      },
    },
  },
  required: ["chapters"],
};

function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatTimestampedTranscript(
  segments: Array<{ start: number; text: string }>,
) {
  return segments
    .map((segment) => {
      const text = segment.text.trim();
      if (!text) {
        return null;
      }
      return `[${formatClock(segment.start)} | ${segment.start}] ${text}`;
    })
    .filter((line): line is string => line != null)
    .join("\n");
}

export async function generateChaptersJsonFromTranscript(
  transcriptText: string,
): Promise<unknown> {
  return requestGeminiJsonWithRetry({
    systemPrompt: CHAPTERS_PROMPT,
    userText: `Timestamped transcript:\n${transcriptText}`,
    schema: CHAPTERS_SCHEMA,
    emptyMessage: "Gemini returned empty chapters",
    parseMessage: "Gemini returned chapter JSON that could not be parsed",
  });
}
