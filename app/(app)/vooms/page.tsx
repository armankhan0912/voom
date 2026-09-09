import { EmptyState } from "@/components/empty-state";
import { VoomsLibrary } from "@/components/vooms-library";
import { requireDbUser } from "@/lib/current-user";
import { listUserRecordings } from "@/lib/recordings";

export default async function VoomsPage() {
  const user = await requireDbUser();
  const recordings = await listUserRecordings(user.id);

  if (recordings.length === 0) {
    return (
      <main className="px-6 py-10 md:px-10">
        <h1 className="text-3xl font-semibold tracking-tight">My Vooms</h1>
        <p className="mt-2 text-voom-muted">All your recordings in one place.</p>
        <div className="mt-10">
          <EmptyState
            title="No Vooms yet"
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
