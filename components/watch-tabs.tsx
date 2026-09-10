"use client";

import { useState } from "react";
import { Chapters } from "@/components/chapters";
import { Summary } from "@/components/summary";
import { Transcript } from "@/components/transcript";

type WatchTab = "summary" | "transcript" | "chapters";

export function WatchTabs({ videoId }: { videoId: string }) {
  const [tab, setTab] = useState<WatchTab>("transcript");

  return (
    <div>
      <div className="flex gap-6 border-b border-voom-line text-sm">
        {(["summary", "transcript", "chapters"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`-mb-px border-b-2 pb-2 ${
              tab === id
                ? "border-voom-ink font-medium"
                : "border-transparent text-voom-muted"
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
      <div className={tab === "summary" ? undefined : "hidden"}>
        <Summary videoId={videoId} />
      </div>
      <div className={tab === "transcript" ? undefined : "hidden"}>
        <Transcript videoId={videoId} />
      </div>
      <div className={tab === "chapters" ? undefined : "hidden"}>
        <Chapters videoId={videoId} />
      </div>
    </div>
  );
}
