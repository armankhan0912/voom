"use client";

import { useEffect, useState } from "react";
import { useWatchPlayer } from "@/components/watch-player-context";
import type {
  TranscriptSegment,
  TranscriptStatus,
} from "@/lib/transcription/types";

const POLL_INTERVAL_MS = 2500;

type TranscriptResponse = {
  videoId?: string;
  status?: TranscriptStatus;
  error?: string | null;
  language?: string | null;
  segments?: TranscriptSegment[] | null;
};

function formatTimestamp(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function isPollable(status: TranscriptStatus | null) {
  return status == null || status === "pending" || status === "processing";
}

export function Transcript({ videoId }: { videoId: string }) {
  const { seekTo } = useWatchPlayer();
  const [status, setStatus] = useState<TranscriptStatus | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    async function load() {
      try {
        const response = await fetch(`/api/videos/${videoId}/transcript`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Could not load transcript");
        }

        const payload = (await response.json()) as TranscriptResponse;
        if (cancelled) {
          return;
        }

        const nextStatus = payload.status ?? "processing";
        setLoadError(false);
        setStatus(nextStatus);
        setSegments(Array.isArray(payload.segments) ? payload.segments : []);

        if (isPollable(nextStatus)) {
          timeoutId = window.setTimeout(load, POLL_INTERVAL_MS);
        }
      } catch {
        if (cancelled) {
          return;
        }

        setLoadError(true);
        timeoutId = window.setTimeout(load, POLL_INTERVAL_MS);
      }
    }

    void load();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [videoId]);

  if (loadError && status == null) {
    return (
      <p className="mt-4 text-sm text-voom-muted">
        Couldn&apos;t load transcript. Retrying…
      </p>
    );
  }

  if (status == null || status === "pending" || status === "processing") {
    return (
      <p className="mt-4 text-sm text-voom-muted">Generating transcript...</p>
    );
  }

  if (status === "failed") {
    return (
      <p className="mt-4 text-sm text-voom-muted">
        Transcript generation failed.
      </p>
    );
  }

  if (segments.length === 0) {
    return (
      <p className="mt-4 text-sm text-voom-muted">
        No speech was detected in this recording.
      </p>
    );
  }

  return (
    <div className="mt-4 max-h-[28rem] overflow-y-auto pr-1">
      <ol className="space-y-4">
        {segments.map((segment, index) => (
          <li key={`${segment.start}-${index}`} className="flex gap-4 text-sm">
            <button
              type="button"
              className="shrink-0 font-medium text-voom-muted hover:text-voom-ink"
              onClick={() => seekTo(segment.start)}
            >
              {formatTimestamp(segment.start)}
            </button>
            <p className="min-w-0 leading-6">{segment.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
