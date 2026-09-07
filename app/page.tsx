import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentDbUser } from "@/lib/current-user";

export default async function Home() {
  const user = await getCurrentDbUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-8 px-6 py-24 text-center">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
          Voom
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Async screen recording
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Record your screen, upload the video, and share a link. Sign in to
          start.
        </p>

        {user ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-base text-zinc-700 dark:text-zinc-300">
              Signed in as{" "}
              <span className="font-medium text-black dark:text-zinc-50">
                {user.name ?? user.email}
              </span>
            </p>
            <SignOutButton />
          </div>
        ) : (
          <SignInButton />
        )}
      </main>
    </div>
  );
}
