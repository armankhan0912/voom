"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RecordLink } from "@/components/record-link";
import { SignOutButton } from "@/components/sign-out-button";

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

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10.5V19h12v-8.5" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16" />
    </svg>
  );
}

function RecordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AppSidebar({
  name,
  email,
}: {
  name: string | null;
  email: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col border-b border-voom-line bg-voom-sidebar px-3 py-5 md:fixed md:inset-y-0 md:w-60 md:border-r md:border-b-0">
      <Link href="/" className="px-3 text-lg font-semibold tracking-tight">
        Voom
      </Link>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          const className = `flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm transition-colors duration-200 ${
            active
              ? "bg-voom-soft font-medium text-voom-accent"
              : "text-voom-muted hover:bg-voom-soft hover:text-voom-ink"
          }`;
          const Icon = link.icon;
          if (link.href === "/record") {
            return (
              <RecordLink key={link.href} className={className}>
                <Icon />
                {link.label}
              </RecordLink>
            );
          }
          return (
            <Link key={link.href} href={link.href} className={className}>
              <Icon />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[14px] border border-voom-line bg-voom-paper/60 px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-voom-soft text-xs font-medium text-voom-accent">
            {initials(name, email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name || "Account"}</p>
            <p className="truncate text-xs text-voom-muted">{email}</p>
          </div>
        </div>
        <div className="mt-2">
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
