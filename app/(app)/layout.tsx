import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireDbUser } from "@/lib/current-user";

export default async function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireDbUser();

  return (
    <AppShell name={user.name} email={user.email}>
      {children}
    </AppShell>
  );
}
