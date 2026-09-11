import Link from "next/link";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentDbUser } from "@/lib/current-user";

export async function SiteHeader() {
  const user = await getCurrentDbUser();

  return (
    <header className="flex items-center justify-between border-b border-voom-line bg-voom-surface px-6 py-4">
      <Link href="/" className="font-semibold tracking-tight">
        Voom
      </Link>
      {user ? (
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="voom-btn-ghost">
            Home
          </Link>
          <Link href="/vooms" className="voom-btn-ghost">
            My Vooms
          </Link>
          <Link href="/record" className="voom-btn-ghost">
            Record
          </Link>
          <SignOutButton />
        </nav>
      ) : (
        <SignInButton />
      )}
    </header>
  );
}
