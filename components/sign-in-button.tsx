"use client";

import { SignInButton as ClerkSignInButton } from "@clerk/nextjs";

export function SignInButton() {
  return (
    <ClerkSignInButton forceRedirectUrl="/" signUpForceRedirectUrl="/">
      <button
        type="button"
        className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Sign in with Google
      </button>
    </ClerkSignInButton>
  );
}
