import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { CopyLinkButton } from "@/components/copy-link-button";
import { SiteHeader } from "@/components/site-header";
import { requireDbUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { shareUrl } from "@/lib/videos";

export default async function DashboardPage() {
  const user = await requireDbUser();
  const rows = await db
    .select()
    .from(videos)
    .where(eq(videos.userId, user.id))
    .orderBy(desc(videos.createdAt));

  return (
    <div>
      <SiteHeader />
      <main>
        <h1>Videos</h1>
        <p>
          <Link href="/record">New recording</Link>
        </p>
        {rows.length === 0 ? (
          <p>No recordings yet.</p>
        ) : (
          <ul>
            {rows.map((video) => (
              <li key={video.id}>
                <Link href={`/v/${video.id}`}>{video.title}</Link>{" "}
                {video.status}{" "}
                <CopyLinkButton url={shareUrl(video.id)} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
