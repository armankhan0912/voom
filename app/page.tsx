import Link from "next/link";
import { SignInButton } from "@/components/sign-in-button";
import { SiteHeader } from "@/components/site-header";
import { getCurrentDbUser } from "@/lib/current-user";

export default async function Home() {
  const user = await getCurrentDbUser();

  return (
    <div>
      <SiteHeader />
      <main>
        <h1>Voom</h1>
        <p>Record your screen and share a link.</p>
        {user ? (
          <p>
            <Link href="/record">Record</Link>{" "}
            <Link href="/dashboard">Videos</Link>
          </p>
        ) : (
          <SignInButton />
        )}
      </main>
    </div>
  );
}
