"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";

export function SignOutButton() {
  return (
    <ClerkSignOutButton>
      <button
        type="button"
        className="text-sm underline-offset-2 hover:underline"
      >
        Sign out
      </button>
    </ClerkSignOutButton>
  );
}
