"use client";

import { useState } from "react";

export function ShareButton({
  url,
  label = "Share",
  variant = "ghost",
}: {
  url: string;
  label?: string;
  variant?: "ghost" | "primary" | "chip";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const className =
    variant === "primary"
      ? "voom-btn-primary"
      : variant === "chip"
        ? "voom-btn-secondary px-3 py-1.5"
        : "voom-btn-ghost px-2 py-1 text-voom-muted";

  return (
    <button type="button" className={className} onClick={() => void copy()}>
      {copied ? "Link copied!" : label}
    </button>
  );
}
