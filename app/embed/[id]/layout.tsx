import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Voom",
  robots: { index: false, follow: false },
};

export default function EmbedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div id="embed-root" className="fixed inset-0 h-full w-full overflow-hidden bg-black">
      {children}
    </div>
  );
}
