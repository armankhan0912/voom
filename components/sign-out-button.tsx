"use client";

import type { ReactNode } from "react";
import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";

export function SignOutButton({
  className = "voom-btn-ghost text-sm",
  label,
  children = "Sign out",
}: {
  className?: string;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <ClerkSignOutButton>
      <button type="button" className={className} aria-label={label}>
        {children}
      </button>
    </ClerkSignOutButton>
  );
}
