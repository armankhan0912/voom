"use client";

export default function VoomError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-lg font-semibold">Could not load this Voom</h1>
      <p className="mt-2 text-voom-muted">Please try again.</p>
      <button
        type="button"
        className="mt-4 rounded-lg bg-voom-ink px-3 py-2 text-sm text-white"
        onClick={reset}
      >
        Try again
      </button>
    </main>
  );
}
