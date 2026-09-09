import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, videos } from "@/lib/db/schema";
import { createPlaybackUrl } from "@/lib/r2/presign";
import type { RecordingListItem } from "@/lib/recording-display";

export type { RecordingListItem } from "@/lib/recording-display";
export { formatDate, formatDuration } from "@/lib/recording-display";

export async function listUserRecordings(
  userId: string,
  options?: { limit?: number },
): Promise<RecordingListItem[]> {
  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      status: videos.status,
      duration: videos.duration,
      createdAt: videos.createdAt,
      s3Key: videos.s3Key,
      ownerName: users.name,
    })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.userId))
    .where(eq(videos.userId, userId))
    .orderBy(desc(videos.createdAt))
    .limit(options?.limit ?? 500);

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      duration: row.duration,
      createdAt: row.createdAt,
      ownerName: row.ownerName,
      playbackUrl:
        row.status === "ready" ? await createPlaybackUrl(row.s3Key) : undefined,
    })),
  );
}
