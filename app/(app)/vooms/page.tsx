import { EmptyState } from "@/components/empty-state";
import { RecordLink } from "@/components/record-link";
import { VoomsLibrary } from "@/components/vooms-library";
import { requireDbUser } from "@/lib/current-user";
import { listUserRecordings } from "@/lib/recordings";

export default async function VoomsPage() {
  const user = await requireDbUser();
  const recordings = await listUserRecordings(user.id);

  if (recordings.length === 0) {
    return (
      <main className="px-6 py-10 md:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Your Vooms</h1>
            <p className="mt-2 text-voom-muted">Your recordings, all in one place.</p>
          </div>
          <RecordLink className="voom-btn-primary">Record a Voom</RecordLink>
        </div>
        <div className="mt-10">
          <EmptyState
            title="Your Vooms will appear here"
            description="Record your first video and share it with a link."
            actionHref="/record"
            actionLabel="Record a Voom"
          />
        </div>
      </main>
    );
  }

  return <VoomsLibrary recordings={recordings} />;
}
