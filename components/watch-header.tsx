import Link from "next/link";
import { ProfileMenu } from "@/components/profile-menu";
import { ShareButton } from "@/components/share-button";
import { SignInButton } from "@/components/sign-in-button";
import { VoomBrand } from "@/components/voom-logo";

export function WatchHeader({
  user,
  videoId,
  shareUrl,
}: {
  user: { name: string | null; email: string } | null;
  videoId?: string;
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
        {shareUrl && videoId ? (
          <ShareButton videoId={videoId} url={shareUrl} label="Share" variant="chip" />
        ) : null}
        {user ? (
          <ProfileMenu name={user.name} email={user.email} />
        ) : (
          <SignInButton variant="ghost">Sign in</SignInButton>
        )}
      </div>
    </header>
  );
}
