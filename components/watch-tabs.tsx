"use client";

import { useState } from "react";

export function WatchTabs() {
  const [tab, setTab] = useState<"summary" | "chapters">("summary");

  return (
    <div>
      <div className="flex gap-6 border-b border-voom-line text-sm">
        {(["summary", "chapters"] as const).map((id) => (
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
            {id === "summary" ? "Summary" : "Chapters"}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-voom-muted">
        {tab === "summary"
          ? "Summary is coming soon. This recording does not have a generated recap yet."
          : "Chapters are coming soon. You will be able to jump through this Voom here."}
      </p>
    </div>
  );
}
