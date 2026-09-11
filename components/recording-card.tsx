import Link from "next/link";
import { DeleteRecordingButton } from "@/components/delete-recording-button";
import { RecordingTitle } from "@/components/recording-title";
import { ShareButton } from "@/components/share-button";
import {
  formatDate,
  formatDuration,
  type RecordingListItem,
} from "@/lib/recording-display";
import { shareUrl, watchPath } from "@/lib/videos";

export function RecordingCard({
  recording,
}: {
  recording: RecordingListItem;
  showOwner?: boolean;
}) {
  return (
    <article className="voom-card hover:-translate-y-0.5 hover:border-voom-accent/30 hover:shadow-[0_8px_24px_rgba(43,33,24,0.06)]">
      <Link href={watchPath(recording.id)} className="block">
        <div className="relative aspect-video bg-voom-ink">
          {recording.playbackUrl ? (
            <video
              className="h-full w-full object-cover"
              src={recording.playbackUrl}
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/70">
              {recording.status === "failed" ? "Failed" : "Processing"}
            </div>
          )}
          <span className="absolute right-2.5 bottom-2.5 rounded-md bg-black/70 px-1.5 py-0.5 text-xs text-white">
            {formatDuration(recording.duration)}
          </span>
        </div>
      </Link>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="font-medium">
            <RecordingTitle id={recording.id} title={recording.title} />
          </h3>
          <p className="mt-1 text-sm text-voom-muted">
            {formatDate(recording.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ShareButton url={shareUrl(recording.id)} />
          <DeleteRecordingButton id={recording.id} />
        </div>
      </div>
    </article>
  );
}
