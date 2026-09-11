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
        className="voom-btn-primary mt-4"
        onClick={reset}
      >
        Try again
      </button>
    </main>
  );
}
