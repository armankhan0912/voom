"use client";

import { useState } from "react";
import { Chapters } from "@/components/chapters";
import { Summary } from "@/components/summary";
import { Transcript } from "@/components/transcript";

type WatchTab = "summary" | "transcript" | "chapters";

export function WatchTabs({ videoId }: { videoId: string }) {
  const [tab, setTab] = useState<WatchTab>("transcript");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-6 border-b border-voom-line text-sm">
        {(["summary", "transcript", "chapters"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`-mb-px border-b-2 pb-2.5 capitalize transition-colors duration-200 ${
              tab === id
                ? "border-voom-accent font-medium text-voom-ink"
                : "border-transparent text-voom-muted hover:text-voom-accent"
            }`}
            onClick={() => setTab(id)}
          >
            {id === "summary"
              ? "Summary"
              : id === "transcript"
                ? "Transcript"
                : "Chapters"}
          </button>
        ))}
      </div>
      <div
        className={
          tab === "summary" ? "min-h-0 flex-1 overflow-y-auto" : "hidden"
        }
      >
        <Summary videoId={videoId} />
      </div>
      <div
        className={
          tab === "transcript" ? "min-h-0 flex-1 overflow-y-auto" : "hidden"
        }
      >
        <Transcript videoId={videoId} />
      </div>
      <div
        className={
          tab === "chapters" ? "min-h-0 flex-1 overflow-y-auto" : "hidden"
        }
      >
        <Chapters videoId={videoId} />
      </div>
    </div>
  );
}
