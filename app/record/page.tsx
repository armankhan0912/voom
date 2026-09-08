import { SiteHeader } from "@/components/site-header";
import { ScreenRecorder } from "@/components/screen-recorder";
import { requireDbUser } from "@/lib/current-user";

export default async function RecordPage() {
  await requireDbUser();

  return (
    <div>
      <SiteHeader />
      <main>
        <h1>Record</h1>
        <ScreenRecorder />
      </main>
    </div>
  );
}
