import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function VoomNotFound() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Voom not found</h1>
        <p className="mt-2 text-voom-muted">
          This Voom does not exist or is not available.
        </p>
        <Link href="/" className="voom-btn-ghost mt-6 inline-block text-sm">
          Back to Voom
        </Link>
      </main>
    </div>
  );
}
