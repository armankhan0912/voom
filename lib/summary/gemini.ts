import type { GeneratedSummary } from "@/lib/summary/types";

export const GEMINI_MODEL = "gemini-3.6-flash";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You summarize a screen recording from its transcript only.

Write in the same language as the transcript (English, Hindi, Hinglish, or mixed).
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
    throw new Error("Gemini summary is missing key points");
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

export async function generateSummaryFromTranscript(
  transcriptText: string,
): Promise<GeneratedSummary> {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getApiKey(),
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `Transcript:\n${transcriptText}` }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SUMMARY_SCHEMA,
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
    throw new Error(payload?.error?.message || "Gemini request failed");
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned an empty summary");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Gemini returned summary JSON that could not be parsed");
  }

  return parseGeneratedSummary(parsed);
}
