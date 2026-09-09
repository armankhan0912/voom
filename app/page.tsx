import { LandingPage } from "@/components/landing-page";
import { AppShell } from "@/components/app-shell";
import { HomeDashboard } from "@/components/home-dashboard";
import { getCurrentDbUser } from "@/lib/current-user";

export default async function Home() {
  const user = await getCurrentDbUser();

  if (!user) {
    return <LandingPage />;
  }

  return (
    <AppShell name={user.name} email={user.email}>
      <HomeDashboard userId={user.id} name={user.name} />
    </AppShell>
  );
}
