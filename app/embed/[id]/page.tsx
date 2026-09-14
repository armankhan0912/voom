import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { VideoPlayer } from "@/components/video-player";
import { WatchPlayerProvider } from "@/components/watch-player-context";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { createPlaybackUrl } from "@/lib/r2/presign";
import { VIDEO_ID_PATTERN } from "@/lib/videos";

export const dynamic = "force-dynamic";

function EmbedMessage({ children }: { children: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center bg-black px-6 text-center text-sm text-white/80">
      {children}
    </div>
  );
}

export default async function EmbedPage({
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
      s3Key: videos.s3Key,
    })
    .from(videos)
    .where(eq(videos.id, id))
    .limit(1);

  const video = rows[0];

  if (!video) {
    notFound();
  }

  if (video.status === "uploading") {
    return <EmbedMessage>Video is still processing/uploading.</EmbedMessage>;
  }

  if (video.status !== "ready") {
    return <EmbedMessage>This video is unavailable.</EmbedMessage>;
  }

  let playbackUrl: string;
  try {
    playbackUrl = await createPlaybackUrl(video.s3Key);
  } catch {
    return <EmbedMessage>This video is unavailable.</EmbedMessage>;
  }

  return (
    <WatchPlayerProvider>
      <div className="h-full w-full">
        <VideoPlayer
          src={playbackUrl}
          title={video.title}
          duration={video.duration}
          variant="embed"
        />
      </div>
    </WatchPlayerProvider>
  );
}
