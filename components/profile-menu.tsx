"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";

function initials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function ProfileMenu({
  name,
  email,
}: {
  name: string | null;
  email: string;
}) {
  const buttonId = useId();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const displayName = name?.trim() || email;

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={buttonId}
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-voom-soft text-xs font-medium text-voom-accent transition-colors duration-200 hover:bg-voom-active"
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        {initials(name, email)}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          className="absolute top-full right-0 z-50 mt-2 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[14px] border border-voom-line bg-voom-surface shadow-[0_12px_32px_rgba(23,23,23,0.12)]"
        >
          <div className="border-b border-voom-line px-3 py-2.5">
            <p className="text-xs text-voom-muted">Signed in as</p>
            <p className="mt-0.5 truncate text-sm font-medium">{displayName}</p>
          </div>
          <ClerkSignOutButton>
            <button
              type="button"
              role="menuitem"
              className="voom-btn-ghost w-full justify-start rounded-none px-3 py-2.5 text-sm"
            >
              Sign out
            </button>
          </ClerkSignOutButton>
        </div>
      ) : null}
    </div>
  );
}
