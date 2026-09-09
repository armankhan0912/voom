"use client";

import { SignInButton as ClerkSignInButton } from "@clerk/nextjs";

export function SignInButton({
  children = "Sign in",
  variant = "primary",
}: {
  children?: string;
  variant?: "primary" | "ghost" | "light";
}) {
  const className =
    variant === "ghost"
      ? "text-sm text-voom-ink hover:opacity-70"
      : variant === "light"
        ? "rounded-full bg-white px-4 py-2 text-sm font-medium text-voom-ink"
        : "rounded-full bg-voom-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-voom-accent-hover";

  return (
    <ClerkSignInButton
      mode="redirect"
      forceRedirectUrl="/"
      signUpForceRedirectUrl="/"
    >
      <button type="button" className={className}>
        {children}
      </button>
    </ClerkSignInButton>
  );
}
