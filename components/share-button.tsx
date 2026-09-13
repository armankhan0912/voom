"use client";

import { useEffect, useId, useRef, useState } from "react";
import { embedIframeCode } from "@/lib/embed";
import { shareUrl } from "@/lib/videos";

export function ShareButton({
  videoId,
  url,
  label = "Share",
  variant = "ghost",
}: {
  videoId: string;
  url?: string;
  label?: string;
  variant?: "ghost" | "primary" | "chip";
}) {
  const titleId = useId();
  const shareInputRef = useRef<HTMLInputElement>(null);
  const embedInputRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const share = url ?? shareUrl(videoId);
  const embedCode = embedIframeCode(videoId);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCopied(null);
      setCopyError(null);
    }
  }, [open]);

  async function copyText(
    value: string,
    kind: "link" | "embed",
    field: HTMLInputElement | HTMLTextAreaElement | null,
  ) {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1800);
    } catch {
      field?.focus();
      field?.select();
      setCopied(null);
      setCopyError("Could not copy automatically. Select the text and copy it.");
    }
  }

  const className =
    variant === "primary"
      ? "voom-btn-primary"
      : variant === "chip"
        ? "voom-btn-secondary px-3 py-1.5"
        : "voom-btn-ghost px-2 py-1 text-voom-muted";

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="voom-card w-full max-w-lg p-5 shadow-[0_16px_40px_rgba(23,23,23,0.16)]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                Share Voom
              </h2>
              <button
                type="button"
                className="voom-btn-ghost px-2 py-1 text-sm text-voom-muted"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-5">
              <p className="text-sm font-medium">Share link</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  ref={shareInputRef}
                  className="voom-input min-w-0 flex-1 text-sm"
                  value={share}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button
                  type="button"
                  className="voom-btn-primary shrink-0"
                  onClick={() => void copyText(share, "link", shareInputRef.current)}
                >
                  {copied === "link" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-medium">Embed</p>
              <textarea
                ref={embedInputRef}
                className="voom-input mt-2 min-h-[11rem] resize-none font-mono text-xs leading-5"
                value={embedCode}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className="voom-btn-secondary mt-2"
                onClick={() => void copyText(embedCode, "embed", embedInputRef.current)}
              >
                {copied === "embed" ? "Copied!" : "Copy embed code"}
              </button>
            </div>

            {copyError ? (
              <p className="mt-3 text-sm text-voom-accent">{copyError}</p>
            ) : null}

            <p className="mt-5 text-sm text-voom-muted">
              Anyone with this link can watch this video.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
