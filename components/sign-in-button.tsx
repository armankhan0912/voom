"use client";

import { SignInButton as ClerkSignInButton } from "@clerk/nextjs";

export function SignInButton() {
  return (
    <ClerkSignInButton forceRedirectUrl="/" signUpForceRedirectUrl="/">
      <button type="button">Sign in with Google</button>
    </ClerkSignInButton>
  );
}
