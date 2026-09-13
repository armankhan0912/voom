import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { RecordSetupProvider } from "@/components/record-setup-overlay";

export function AppShell({
  name,
  email,
  children,
}: {
  name: string | null;
  email: string;
  children: ReactNode;
}) {
  return (
    <RecordSetupProvider>
      <div className="min-h-screen bg-voom-paper">
        <AppSidebar name={name} email={email} />
        <div className="voom-sidebar-main md:pl-[var(--voom-sidebar-width)]">
          {children}
        </div>
      </div>
    </RecordSetupProvider>
  );
}
