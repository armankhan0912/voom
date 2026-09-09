"use client";

import { useMemo, useState } from "react";
import { RecordingGrid } from "@/components/recording-grid";
import type { RecordingListItem } from "@/lib/recording-display";

type Range = "all" | "today" | "week" | "month";
type Sort = "newest" | "oldest";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function VoomsLibrary({ recordings }: { recordings: RecordingListItem[] }) {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [sort, setSort] = useState<Sort>("newest");

  const filtered = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const week = today - 6 * 24 * 60 * 60 * 1000;
    const month = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const needle = query.trim().toLowerCase();

    const next = recordings.filter((recording) => {
      const created = new Date(recording.createdAt).getTime();
      if (needle && !recording.title.toLowerCase().includes(needle)) {
        return false;
      }
      if (range === "today" && created < today) return false;
      if (range === "week" && created < week) return false;
      if (range === "month" && created < month) return false;
      return true;
    });

    next.sort((a, b) => {
      const delta =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === "newest" ? -delta : delta;
    });

    return next;
  }, [query, range, recordings, sort]);

  const tabs: { id: Range; label: string }[] = [
    { id: "all", label: "All" },
    { id: "today", label: "Today" },
    { id: "week", label: "This week" },
    { id: "month", label: "This month" },
  ];

  return (
    <main className="px-6 py-10 md:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">My Vooms</h1>
      <p className="mt-2 text-voom-muted">All your recordings in one place.</p>

      <label className="mt-8 flex items-center rounded-full bg-voom-surface px-4 py-2.5">
        <input
          className="w-full bg-transparent outline-none"
          placeholder="Search vooms..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search vooms"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${
                range === tab.id
                  ? "bg-voom-ink text-white"
                  : "bg-voom-surface text-voom-muted"
              }`}
              onClick={() => setRange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <label className="text-sm text-voom-muted">
          Sort by:{" "}
          <select
            className="rounded-full bg-voom-surface px-2 py-1 text-voom-ink"
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </label>
      </div>

      <div className="mt-8">
        {filtered.length === 0 ? (
          <p className="text-voom-muted">No recordings match these filters.</p>
        ) : (
          <RecordingGrid recordings={filtered} />
        )}
      </div>
    </main>
  );
}
