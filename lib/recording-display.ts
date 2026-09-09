export type RecordingListItem = {
  id: string;
  title: string;
  status: "uploading" | "ready" | "failed";
  duration: number | null;
  createdAt: Date | string;
  ownerName: string | null;
  playbackUrl?: string;
};

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) {
    return "—";
  }

  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatDate(value: Date | string) {
  const date = new Date(value);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}
