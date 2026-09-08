"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";

export function SignOutButton() {
  return (
    <ClerkSignOutButton>
      <button type="button">Sign out</button>
    </ClerkSignOutButton>
  );
}
