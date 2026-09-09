import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { DeleteRecordingButton } from "@/components/delete-recording-button";
import { RecordingTitle } from "@/components/recording-title";
import { ShareButton } from "@/components/share-button";
import { VideoPlayer } from "@/components/video-player";
import { WatchHeader } from "@/components/watch-header";
import { WatchTabs } from "@/components/watch-tabs";
import { getCurrentDbUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { users, videos } from "@/lib/db/schema";
import { createPlaybackUrl } from "@/lib/r2/presign";
import { formatDate, formatDuration } from "@/lib/recording-display";
import { shareUrl, VIDEO_ID_PATTERN } from "@/lib/videos";

export default async function VoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!VIDEO_ID_PATTERN.test(id)) {
    notFound();
  }

  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      status: videos.status,
      duration: videos.duration,
      createdAt: videos.createdAt,
      s3Key: videos.s3Key,
      userId: videos.userId,
      ownerName: users.name,
    })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.userId))
    .where(eq(videos.id, id))
    .limit(1);

  const video = rows[0];

  if (!video) {
    notFound();
  }

  const viewer = await getCurrentDbUser();
  const isOwner = viewer?.id === video.userId;

  if (video.status !== "ready" && !isOwner) {
    notFound();
  }

  const playbackUrl =
    video.status === "ready" ? await createPlaybackUrl(video.s3Key) : null;
  const url = shareUrl(video.id);

  return (
    <div className="min-h-screen bg-voom-paper">
      <WatchHeader
        user={viewer ? { name: viewer.name, email: viewer.email } : null}
      />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-6 lg:grid-cols-2 lg:items-start">
        <section>
          {playbackUrl ? (
            <VideoPlayer src={playbackUrl} title={video.title} />
          ) : (
            <div className="rounded-3xl bg-voom-surface p-8 text-voom-muted">
              {video.status === "failed"
                ? "This recording failed to upload."
                : "This recording is still processing."}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {video.status === "ready" ? (
              <ShareButton url={url} label="Copy link" variant="chip" />
            ) : null}
            {isOwner ? (
              <DeleteRecordingButton
                id={video.id}
                redirectTo="/"
                className="rounded-full border border-voom-line bg-voom-surface px-3 py-1.5 text-sm hover:bg-voom-paper"
              />
            ) : null}
          </div>

          <div className="mt-6 rounded-3xl bg-voom-surface p-5">
            <h2 className="text-sm font-medium">Video details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-voom-muted">Title</dt>
                <dd className="mt-1">
                  {isOwner ? (
                    <RecordingTitle
                      id={video.id}
                      title={video.title}
                      className="w-full min-w-0 bg-transparent font-medium outline-none"
                    />
                  ) : (
                    video.title
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-voom-muted">Created</dt>
                <dd className="mt-1">{formatDate(video.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-voom-muted">Duration</dt>
                <dd className="mt-1">{formatDuration(video.duration)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="rounded-3xl bg-voom-surface p-5 lg:min-h-[28rem]">
          <WatchTabs />
        </section>
      </main>
    </div>
  );
}
