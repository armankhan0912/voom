"use client";

export default function VoomsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="px-6 py-8 md:px-8">
      <h1 className="text-lg font-semibold">Could not load your library</h1>
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
