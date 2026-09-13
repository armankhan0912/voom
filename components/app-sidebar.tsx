"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { RecordLink } from "@/components/record-link";
import { SignOutButton } from "@/components/sign-out-button";
import { VoomMark, VoomWordmark } from "@/components/voom-logo";
import { SIDEBAR_STORAGE_KEY } from "@/lib/sidebar";

function initials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    const letters = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`;
    return letters.toUpperCase();
  }

  return email.slice(0, 2).toUpperCase();
}

const links = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/vooms", label: "My Vooms", icon: LibraryIcon },
  { href: "/record", label: "Record a Voom", icon: RecordIcon },
];

const iconProps = {
  viewBox: "0 0 24 24",
  className: "h-[18px] w-[18px] shrink-0",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.8",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10.5V19h12v-8.5" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16" />
    </svg>
  );
}

function RecordIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg {...iconProps} className="h-4 w-4 shrink-0">
      <path d={direction === "left" ? "M14 6l-6 6 6 6" : "M10 6l6 6-6 6"} />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg {...iconProps}>
      <path d="M15 16.5V19a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 15 5v2.5" />
      <path d="M11 12h9" />
      <path d="m17.5 8.5 3.5 3.5-3.5 3.5" />
    </svg>
  );
}

// The collapsed state lives on <html> so the pre-hydration script can apply it
// before first paint; React reads it from there instead of owning it.
function subscribeToSidebarState(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-voom-sidebar"],
  });
  return () => observer.disconnect();
}

function isCollapsed() {
  return document.documentElement.dataset.voomSidebar === "collapsed";
}

export function AppSidebar({
  name,
  email,
}: {
  name: string | null;
  email: string;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeToSidebarState,
    isCollapsed,
    () => false,
  );

  function toggle() {
    const root = document.documentElement;
    const next = !isCollapsed();

    if (next) {
      root.dataset.voomSidebar = "collapsed";
    } else {
      delete root.dataset.voomSidebar;
    }

    try {
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        next ? "collapsed" : "expanded",
      );
    } catch {
      // Ignore storage failures (private mode, disabled storage).
    }
  }

  const toggleClassName =
    "inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-voom-line text-voom-muted transition-colors duration-200 hover:bg-voom-soft hover:text-voom-accent";

  return (
    <aside className="voom-sidebar-panel flex w-full flex-col gap-3 border-b border-voom-line bg-voom-sidebar px-3 py-3 md:fixed md:inset-y-0 md:left-0 md:z-30 md:w-[var(--voom-sidebar-width)] md:gap-0 md:border-r md:border-b-0 md:py-5">
      <div className="voom-collapse-hide flex items-center justify-between gap-2">
        <Link
          href="/"
          aria-label="Voom home"
          className="flex items-center rounded-[10px] px-1.5 py-1"
        >
          <VoomWordmark size={20} />
        </Link>
        <div className="flex items-center gap-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-voom-soft text-xs font-medium text-voom-accent md:hidden">
            {initials(name, email)}
          </div>
          <span className="md:hidden">
            <SignOutButton />
          </span>
          <button
            type="button"
            onClick={toggle}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            aria-expanded={!collapsed}
            className={`hidden md:inline-flex ${toggleClassName}`}
          >
            <ChevronIcon direction="left" />
          </button>
        </div>
      </div>

      <div className="voom-collapse-only flex-col items-center gap-3">
        <Link href="/" aria-label="Voom home" className="flex items-center">
          <VoomMark size={26} />
        </Link>
        <button
          type="button"
          onClick={toggle}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          aria-expanded={!collapsed}
          className={toggleClassName}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      <nav className="flex gap-1 overflow-x-auto md:mt-7 md:flex-1 md:flex-col md:overflow-visible">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          const className = `voom-nav-item flex shrink-0 items-center gap-3 rounded-[10px] px-3 py-2 text-sm transition-colors duration-200 ${
            active
              ? "bg-voom-soft font-medium text-voom-accent"
              : "text-voom-muted hover:bg-voom-soft hover:text-voom-ink"
          }`;
          const Icon = link.icon;
          const content = (
            <>
              <Icon />
              <span className="voom-collapse-hide whitespace-nowrap">
                {link.label}
              </span>
              <span className="voom-nav-tip">{link.label}</span>
            </>
          );

          if (link.href === "/record") {
            return (
              <RecordLink key={link.href} className={className}>
                {content}
              </RecordLink>
            );
          }

          return (
            <Link key={link.href} href={link.href} className={className}>
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden md:block">
        <div className="voom-collapse-hide rounded-[14px] border border-voom-line bg-voom-surface p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-voom-soft text-xs font-medium text-voom-accent">
              {initials(name, email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name || "Account"}</p>
              <p className="truncate text-xs text-voom-muted">{email}</p>
            </div>
          </div>
          <SignOutButton className="voom-btn-secondary mt-3 w-full py-2 text-sm" />
        </div>

        <div className="voom-collapse-only flex-col items-center gap-2">
          <div
            className="voom-nav-item flex h-9 w-9 items-center justify-center rounded-full bg-voom-soft text-xs font-medium text-voom-accent"
          >
            {initials(name, email)}
            <span className="voom-nav-tip">{name || email}</span>
          </div>
          <SignOutButton
            className="voom-nav-item flex h-9 w-9 items-center justify-center rounded-[10px] text-voom-muted transition-colors duration-200 hover:bg-voom-soft hover:text-voom-accent"
            label="Sign out"
          >
            <SignOutIcon />
            <span className="voom-nav-tip">Sign out</span>
          </SignOutButton>
        </div>
      </div>
    </aside>
  );
}
