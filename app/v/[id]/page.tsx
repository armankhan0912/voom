import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/copy-link-button";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { createPlaybackUrl } from "@/lib/r2/presign";
import { shareUrl, VIDEO_ID_PATTERN } from "@/lib/videos";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!VIDEO_ID_PATTERN.test(id)) {
    notFound();
  }

  const rows = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  const video = rows[0];

  if (!video) {
    notFound();
  }

  const playbackUrl =
    video.status === "ready" ? await createPlaybackUrl(video.s3Key) : null;

  return (
    <div>
      <SiteHeader />
      <main>
        <h1>{video.title}</h1>
        <p>{video.status}</p>
        {video.status === "ready" && playbackUrl ? (
          <video src={playbackUrl} controls playsInline />
        ) : (
          <p>This recording is not ready.</p>
        )}
        {video.status === "ready" ? (
          <p>
            <CopyLinkButton url={shareUrl(video.id)} />
          </p>
        ) : null}
      </main>
    </div>
  );
}
