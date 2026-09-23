const MAX_REASON_LENGTH = 180;

function looksUnsafe(value: string) {
  if (value.length > 400 || value.startsWith("{") || value.startsWith("[")) {
    return true;
  }

  return /api[_ -]?key|secret|bearer\s+\S|sk-[a-z0-9]|AIza[0-9A-Za-z_-]{8}/i.test(
    value,
  );
}

export function displayFailureReason(error: string | null | undefined) {
  if (typeof error !== "string") {
    return null;
  }

  const text = error.replace(/\s+/g, " ").trim();
  if (!text || looksUnsafe(text)) {
    return null;
  }

  if (text.length <= MAX_REASON_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_REASON_LENGTH - 1).trimEnd()}…`;
}
