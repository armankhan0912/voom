import { SiteHeader } from "@/components/site-header";
import { ScreenRecorder } from "@/components/screen-recorder";
import { requireDbUser } from "@/lib/current-user";

export default async function RecordPage() {
  await requireDbUser();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Record</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Capture your screen, then upload directly to storage. The video never
          passes through the Voom server.
        </p>
        <ScreenRecorder />
      </main>
    </div>
  );
}
