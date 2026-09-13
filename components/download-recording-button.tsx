"use client";

import { useState } from "react";

export function DownloadRecordingButton({
  id,
  className = "voom-btn-secondary px-3 py-1.5",
}: {
  id: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function download() {
    if (state === "loading") {
      return;
    }

    setState("loading");
    try {
      const response = await fetch(`/api/videos/${id}/download`, {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as {
        url?: unknown;
        error?: unknown;
      } | null;

      if (!response.ok || typeof payload?.url !== "string") {
        setState("error");
        return;
      }

      const link = document.createElement("a");
      link.href = payload.url;
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      disabled={state === "loading"}
      onClick={() => void download()}
      className={`${className} disabled:opacity-50`}
    >
      {state === "loading"
        ? "Downloading…"
        : state === "error"
          ? "Retry download"
          : "Download"}
    </button>
  );
}
