import Link from "next/link";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";

function initials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function WatchHeader({
  user,
}: {
  user: { name: string | null; email: string } | null;
}) {
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <Link href={user ? "/" : "/"} className="text-lg font-semibold">
        Voom
      </Link>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-voom-ink text-xs font-medium text-white"
              title={user.name || user.email}
            >
              {initials(user.name, user.email)}
            </div>
            <SignOutButton />
          </>
        ) : (
          <SignInButton variant="ghost">Sign in</SignInButton>
        )}
      </div>
    </header>
  );
}
