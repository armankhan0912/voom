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
      ? "rounded-full bg-voom-ink px-4 py-2 text-sm font-medium text-white hover:bg-voom-accent-hover"
      : variant === "chip"
        ? "rounded-full border border-voom-line bg-voom-surface px-3 py-1.5 text-sm hover:bg-voom-paper"
        : "rounded-full px-2 py-1 text-sm text-voom-muted hover:text-voom-ink";

  return (
    <button type="button" className={className} onClick={() => void copy()}>
      {copied ? "Link copied!" : label}
    </button>
  );
}
