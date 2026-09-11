"use client";

import { useEffect, useState } from "react";
import type { SummaryStatus } from "@/lib/summary/types";

const POLL_INTERVAL_MS = 2500;

type SummaryResponse = {
  videoId?: string;
  status?: SummaryStatus;
  error?: string | null;
  overview?: string | null;
  keyPoints?: string[] | null;
};

function isPollable(status: SummaryStatus | null) {
  return status == null || status === "pending" || status === "processing";
}

export function Summary({ videoId }: { videoId: string }) {
  const [status, setStatus] = useState<SummaryStatus | null>(null);
  const [overview, setOverview] = useState<string | null>(null);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    async function load() {
      try {
        const response = await fetch(`/api/videos/${videoId}/summary`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Could not load summary");
        }

        const payload = (await response.json()) as SummaryResponse;
        if (cancelled) {
          return;
        }

        const nextStatus = payload.status ?? "pending";
        setLoadError(false);
        setStatus(nextStatus);
        setOverview(typeof payload.overview === "string" ? payload.overview : null);
        setKeyPoints(Array.isArray(payload.keyPoints) ? payload.keyPoints : []);

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
        Couldn&apos;t load summary. Retrying…
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
      <p className="mt-4 text-sm text-voom-muted">Generating summary...</p>
    );
  }

  if (status === "failed") {
    return (
      <p className="mt-4 text-sm text-voom-muted">
        Summary generation failed.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-6 pr-1 text-sm">
      {overview ? (
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-voom-muted uppercase">
            Overview
          </h3>
          <p className="mt-2 rounded-[10px] bg-voom-soft px-3 py-3 leading-7 text-voom-ink">
            {overview}
          </p>
        </section>
      ) : null}
      {keyPoints.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-voom-muted uppercase">
            Key points
          </h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 leading-7 text-voom-ink">
            {keyPoints.map((point, index) => (
              <li key={`${index}-${point.slice(0, 24)}`}>{point}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
