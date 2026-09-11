import Link from "next/link";
import { ShareButton } from "@/components/share-button";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { VoomBrand } from "@/components/voom-logo";

function initials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function WatchHeader({
  user,
  shareUrl,
}: {
  user: { name: string | null; email: string } | null;
  shareUrl?: string;
}) {
  return (
    <header className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex min-w-0 items-center gap-5">
        <VoomBrand />
        {user ? (
          <Link
            href="/vooms"
            className="truncate text-sm text-voom-muted transition-colors duration-200 hover:text-voom-accent"
          >
            Back to My Vooms
          </Link>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {shareUrl ? <ShareButton url={shareUrl} label="Share" variant="chip" /> : null}
        {user ? (
          <>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-voom-soft text-xs font-medium text-voom-accent"
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
