"use client";

import { useEffect, useState } from "react";
import { useWatchPlayer } from "@/components/watch-player-context";
import type { Chapter, ChapterStatus } from "@/lib/chapters/types";

const POLL_INTERVAL_MS = 2500;

type ChaptersResponse = {
  videoId?: string;
  status?: ChapterStatus;
  error?: string | null;
  chapters?: Chapter[] | null;
};

function formatTimestamp(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function isPollable(status: ChapterStatus | null) {
  return status == null || status === "pending" || status === "processing";
}

export function Chapters({ videoId }: { videoId: string }) {
  const { seekTo } = useWatchPlayer();
  const [status, setStatus] = useState<ChapterStatus | null>(null);
  const [items, setItems] = useState<Chapter[]>([]);
  const [activeStart, setActiveStart] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;
    setActiveStart(null);

    async function load() {
      try {
        const response = await fetch(`/api/videos/${videoId}/chapters`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Could not load chapters");
        }

        const payload = (await response.json()) as ChaptersResponse;
        if (cancelled) {
          return;
        }

        const nextStatus = payload.status ?? "pending";
        setLoadError(false);
        setStatus(nextStatus);
        setItems(Array.isArray(payload.chapters) ? payload.chapters : []);

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
        Couldn&apos;t load chapters. Retrying…
      </p>
    );
  }

  if (status == null || status === "pending") {
    return (
      <p className="mt-4 text-sm text-voom-muted">Waiting for transcript...</p>
    );
  }

  if (status === "processing") {
    return (
      <p className="mt-4 text-sm text-voom-muted">Generating chapters...</p>
    );
  }

  if (status === "failed") {
    return (
      <p className="mt-4 text-sm text-voom-muted">
        Chapter generation failed.
      </p>
    );
  }

  return (
    <div className="mt-4 max-h-[28rem] overflow-y-auto pr-1 text-sm">
      {items.length === 0 ? (
        <p className="text-voom-muted">No chapters for this recording.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((chapter) => {
            const isActive = activeStart === chapter.start;

            return (
              <li key={chapter.start}>
                <button
                  type="button"
                  className={`flex w-full items-baseline gap-4 text-left ${
                    isActive
                      ? "text-voom-ink"
                      : "text-voom-muted hover:text-voom-ink"
                  }`}
                  onClick={() => {
                    setActiveStart(chapter.start);
                    seekTo(chapter.start);
                  }}
                >
                  <span className="shrink-0 font-medium">
                    {formatTimestamp(chapter.start)}
                  </span>
                  <span className="min-w-0 leading-6">{chapter.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
