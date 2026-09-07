import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentDbUser } from "@/lib/current-user";

export async function SiteHeader() {
  const user = await getCurrentDbUser();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-black/[.06] px-6 py-4 dark:border-white/[.08]">
      <Link href="/" className="text-sm font-semibold tracking-wide uppercase">
        Voom
      </Link>
      {user ? (
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/record" className="hover:underline">
            Record
          </Link>
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <SignOutButton className="rounded-full border border-black/[.08] px-3 py-1.5 text-sm hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]" />
        </nav>
      ) : null}
    </header>
  );
}
