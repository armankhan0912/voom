"use client";

import { useState } from "react";
import { RecordingCard } from "@/components/recording-card";
import type { RecordingListItem } from "@/lib/recording-display";

export function RecordingGrid({
  recordings,
  onDeleted,
}: {
  recordings: RecordingListItem[];
  onDeleted?: (id: string) => void;
  showOwner?: boolean;
}) {
  const [kept, setKept] = useState(recordings);
  const visible = onDeleted
    ? recordings
    : kept.filter((recording) => recordings.some((item) => item.id === recording.id));

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map((recording) => (
        <RecordingCard
          key={recording.id}
          recording={recording}
          onDeleted={
            onDeleted
              ? () => onDeleted(recording.id)
              : () =>
                  setKept((current) =>
                    current.filter((item) => item.id !== recording.id),
                  )
          }
        />
      ))}
    </div>
  );
}
