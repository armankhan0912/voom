import Link from "next/link";
import { SignInButton } from "@/components/sign-in-button";
import { SiteHeader } from "@/components/site-header";
import { getCurrentDbUser } from "@/lib/current-user";

export default async function Home() {
  const user = await getCurrentDbUser();

  return (
    <div className="flex min-h-full flex-col bg-zinc-50 font-sans dark:bg-black">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
          Voom
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Async screen recording
        </h1>
        <p className="mt-4 max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Record your screen, upload the video, and share a link.
        </p>

        {user ? (
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/record"
              className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background"
            >
              Record
            </Link>
            <Link
              href="/dashboard"
              className="flex h-12 items-center justify-center rounded-full border border-black/[.08] px-6 text-base font-medium dark:border-white/[.145]"
            >
              Dashboard
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <SignInButton />
          </div>
        )}
      </main>
    </div>
  );
}
