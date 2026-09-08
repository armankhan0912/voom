import Link from "next/link";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentDbUser } from "@/lib/current-user";

export async function SiteHeader() {
  const user = await getCurrentDbUser();

  return (
    <header>
      <Link href="/">Voom</Link>
      {user ? (
        <nav>
          <Link href="/record">Record</Link>{" "}
          <Link href="/dashboard">Videos</Link> <SignOutButton />
        </nav>
      ) : (
        <SignInButton />
      )}
    </header>
  );
}
