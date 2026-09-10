import { persistAssemblyAIResult } from "@/lib/transcription/persist";
import { isWebhookAuthorized } from "@/lib/transcription/assemblyai";

export async function POST(request: Request) {
  if (!isWebhookAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { transcript_id?: unknown; id?: unknown };
  try {
    body = (await request.json()) as { transcript_id?: unknown; id?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const providerJobId =
    typeof body.transcript_id === "string"
      ? body.transcript_id
      : typeof body.id === "string"
        ? body.id
        : null;

  if (!providerJobId) {
    return Response.json({ ok: true });
  }

  await persistAssemblyAIResult(providerJobId);

  return Response.json({ ok: true });
}
