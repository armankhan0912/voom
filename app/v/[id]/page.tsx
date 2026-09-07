import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { createPlaybackUrl } from "@/lib/r2/presign";
import { VIDEO_ID_PATTERN } from "@/lib/videos";

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
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{video.title}</h1>
          <p className="text-sm text-zinc-500">{video.status}</p>
        </div>

        {video.status === "ready" && playbackUrl ? (
          <video
            className="w-full rounded-xl bg-black"
            src={playbackUrl}
            controls
            playsInline
          />
        ) : video.status === "uploading" ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            This recording is still uploading.
          </p>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-400">
            This recording failed to process.
          </p>
        )}
      </main>
    </div>
  );
}
