import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { DeleteRecordingButton } from "@/components/delete-recording-button";
import { DownloadRecordingButton } from "@/components/download-recording-button";
import { RecordingTitle } from "@/components/recording-title";
import { ShareButton } from "@/components/share-button";
import { VideoPlayer } from "@/components/video-player";
import { WatchHeader } from "@/components/watch-header";
import { WatchPlayerProvider } from "@/components/watch-player-context";
import { WatchTabs } from "@/components/watch-tabs";
import { getCurrentDbUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { users, videos } from "@/lib/db/schema";
import { createPlaybackUrl } from "@/lib/r2/presign";
import { formatDate, formatDuration } from "@/lib/recording-display";
import { shareUrl, VIDEO_ID_PATTERN } from "@/lib/videos";

async function loadWatchVideo(id: string) {
  if (!VIDEO_ID_PATTERN.test(id)) {
    return null;
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

  return rows[0] ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const video = await loadWatchVideo(id);

  if (!video) {
    return { title: "Voom" };
  }

  const description = `Watch “${video.title}” on Voom`;

  return {
    title: video.title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: video.title,
      description,
    },
  };
}

export default async function VoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const video = await loadWatchVideo(id);

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
    <WatchPlayerProvider>
      <div className="flex min-h-svh flex-col bg-voom-paper md:h-svh md:overflow-hidden">
      <WatchHeader
        user={viewer ? { name: viewer.name, email: viewer.email } : null}
        videoId={video.status === "ready" ? video.id : undefined}
        shareUrl={video.status === "ready" ? url : undefined}
      />
      <main className="mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 flex-col px-5 py-4">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="flex min-w-0 flex-col">
            {playbackUrl ? (
              <VideoPlayer src={playbackUrl} title={video.title} />
            ) : (
              <div className="rounded-[16px] border border-voom-line bg-voom-surface p-8 text-voom-muted">
                {video.status === "failed"
                  ? "This recording failed to upload."
                  : "This recording is still processing."}
              </div>
            )}

            {isOwner ? (
              <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2">
                <DeleteRecordingButton
                  id={video.id}
                  redirectTo="/"
                  className="voom-btn-secondary px-3 py-1.5"
                />
                {video.status === "ready" ? (
                  <>
                    <DownloadRecordingButton id={video.id} />
                    <ShareButton
                      videoId={video.id}
                      url={url}
                      label="Share"
                      variant="chip"
                    />
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 shrink-0">
              {isOwner ? (
                <RecordingTitle
                  id={video.id}
                  title={video.title}
                  className="w-full min-w-0 bg-transparent text-lg font-semibold tracking-tight outline-none"
                />
              ) : (
                <h2 className="text-lg font-semibold tracking-tight">{video.title}</h2>
              )}
              <p className="mt-2 text-sm text-voom-muted">
                {formatDate(video.createdAt)}
                <span className="mx-2 text-voom-line">·</span>
                {formatDuration(video.duration)}
              </p>
            </div>
          </section>

          <section className="voom-card flex min-h-0 flex-col overflow-hidden p-5 max-md:max-h-[min(32rem,60vh)] md:h-full">
            <WatchTabs videoId={video.id} />
          </section>
        </div>
      </main>
      </div>
    </WatchPlayerProvider>
  );
}
