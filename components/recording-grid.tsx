import { RecordingCard } from "@/components/recording-card";
import type { RecordingListItem } from "@/lib/recording-display";

export function RecordingGrid({
  recordings,
}: {
  recordings: RecordingListItem[];
  showOwner?: boolean;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {recordings.map((recording) => (
        <RecordingCard key={recording.id} recording={recording} />
      ))}
    </div>
  );
}
