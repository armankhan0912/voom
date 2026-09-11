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
      ? "voom-btn-ghost"
      : variant === "light"
        ? "voom-btn-secondary"
        : "voom-btn-primary";

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
