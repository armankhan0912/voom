"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";

export function SignOutButton() {
  return (
    <ClerkSignOutButton>
      <button type="button" className="voom-btn-ghost text-sm">
        Sign out
      </button>
    </ClerkSignOutButton>
  );
}
