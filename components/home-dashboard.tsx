import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { HomeGreeting } from "@/components/home-greeting";
import { RecordLink } from "@/components/record-link";
import { RecordingGrid } from "@/components/recording-grid";
import { listUserRecordings } from "@/lib/recordings";

export async function HomeDashboard({
  userId,
  name,
}: {
  userId: string;
  name: string | null;
}) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";
  const recordings = await listUserRecordings(userId, { limit: 3 });

  return (
    <main className="px-6 py-10 md:px-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <HomeGreeting name={firstName} />
          <p className="mt-2 text-voom-muted">
            Record a video and share it instantly.
          </p>
        </div>
        <RecordLink className="inline-flex rounded-full bg-voom-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-voom-accent-hover">
          Record a Voom
        </RecordLink>
      </div>

      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-lg font-semibold">Recent Vooms</h2>
          {recordings.length > 0 ? (
            <Link href="/vooms" className="text-sm text-voom-muted hover:text-voom-ink">
              View all
            </Link>
          ) : null}
        </div>
        {recordings.length === 0 ? (
          <EmptyState
            title="No Vooms yet"
            description="Record your first video and share it with a link."
            actionHref="/record"
            actionLabel="Record a Voom"
          />
        ) : (
          <RecordingGrid recordings={recordings} />
        )}
      </section>
    </main>
  );
}
