"use client";

import { useEffect, useState } from "react";
import { useWatchPlayer } from "@/components/watch-player-context";
import {
  looksLikeCombinedTranscript,
  type TranscriptSegment,
  type TranscriptStatus,
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

function activeStartAtTime(items: Array<{ start: number; end?: number }>, time: number) {
  if (items.length === 0) {
    return null;
  }

  for (let index = 0; index < items.length; index += 1) {
    const start = items[index].start;
    const end = items[index].end ?? items[index + 1]?.start ?? Number.POSITIVE_INFINITY;
    if (time >= start && time < end) {
      return start;
    }
  }

  return items[items.length - 1]?.start ?? null;
}

export function Transcript({ videoId }: { videoId: string }) {
  const { seekTo, currentTime } = useWatchPlayer();
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
        const nextSegments = Array.isArray(payload.segments) ? payload.segments : [];
        setLoadError(false);
        setStatus(nextStatus);
        setSegments(nextSegments);

        if (isPollable(nextStatus) || looksLikeCombinedTranscript(nextSegments)) {
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

  const activeStart = activeStartAtTime(segments, currentTime);

  return (
    <div className="mt-4 pr-1">
      <ol className="space-y-1">
        {segments.map((segment, index) => {
          const isActive = activeStart === segment.start;

          return (
            <li key={`${segment.start}-${index}`}>
              <button
                type="button"
                className={`flex w-full gap-4 rounded-[10px] px-2 py-2.5 text-left text-sm transition-colors duration-200 ${
                  isActive ? "bg-voom-active" : "hover:bg-voom-soft"
                }`}
                onClick={() => {
                  seekTo(segment.start);
                }}
              >
                <span className="w-12 shrink-0 text-sm font-semibold text-voom-accent">
                  {formatTimestamp(segment.start)}
                </span>
                <span className="min-w-0 leading-6 text-voom-ink">{segment.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
