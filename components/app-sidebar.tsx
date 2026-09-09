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
  { href: "/", label: "Home" },
  { href: "/vooms", label: "My Vooms" },
  { href: "/record", label: "Record a Voom" },
];

export function AppSidebar({
  name,
  email,
}: {
  name: string | null;
  email: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col bg-voom-sidebar px-4 py-6 text-white md:fixed md:inset-y-0 md:w-60">
      <Link href="/" className="px-3 text-lg font-semibold tracking-tight">
        Voom
      </Link>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          const className = `rounded-xl px-3 py-2.5 text-sm ${
            active
              ? "bg-white/12 text-white"
              : "text-white/70 hover:bg-white/8 hover:text-white"
          }`;
          if (link.href === "/record") {
            return (
              <RecordLink key={link.href} className={className}>
                {link.label}
              </RecordLink>
            );
          }
          return (
            <Link key={link.href} href={link.href} className={className}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl bg-white/8 px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-medium">
            {initials(name, email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name || "Account"}</p>
            <p className="truncate text-xs text-white/55">{email}</p>
          </div>
        </div>
        <div className="mt-3 text-white/80">
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
