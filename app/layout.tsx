import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import Script from "next/script";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { SIDEBAR_INIT_SCRIPT } from "@/lib/sidebar";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-voom",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-voom-display",
});

export const metadata: Metadata = {
  title: "Voom",
  description: "Async screen recording and sharing",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // The sidebar script sets data-voom-sidebar on <html> before hydration.
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script
          id="voom-sidebar-state"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT_SCRIPT }}
        />
        <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
      </body>
    </html>
  );
}
