import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { CopyLinkButton } from "@/components/copy-link-button";
import { SiteHeader } from "@/components/site-header";
import { requireDbUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { shareUrl } from "@/lib/videos";

function formatDuration(seconds: number | null) {
  if (seconds == null) {
    return "—";
  }

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const user = await requireDbUser();
  const rows = await db
    .select()
    .from(videos)
    .where(eq(videos.userId, user.id))
    .orderBy(desc(videos.createdAt));

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Your videos</h1>
          <Link
            href="/record"
            className="flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
          >
            New recording
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            No recordings yet.{" "}
            <Link href="/record" className="underline">
              Record one
            </Link>{" "}
            or use the Voom Chrome extension.
          </p>
        ) : (
          <ul className="divide-y divide-black/[.06] dark:divide-white/[.08]">
            {rows.map((video) => {
              const url = shareUrl(video.id);

              return (
                <li
                  key={video.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <Link href={`/v/${video.id}`} className="font-medium hover:underline">
                      {video.title}
                    </Link>
                    <p className="text-sm text-zinc-500">
                      {video.status} · {formatDuration(video.duration)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <CopyLinkButton url={url} />
                    <Link
                      href={`/v/${video.id}`}
                      className="rounded-full border border-black/[.08] px-3 py-1.5 text-sm dark:border-white/[.145]"
                    >
                      Watch
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
