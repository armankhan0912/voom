export function GenerationFailure({
  message,
  reason,
  canRetry,
  retrying,
  onRetry,
}: {
  message: string;
  reason: string | null;
  canRetry: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-sm text-voom-muted">{message}</p>
      {reason ? <p className="mt-2 text-sm text-voom-ink">{reason}</p> : null}
      {canRetry ? (
        <button
          type="button"
          className="voom-btn-secondary mt-3 px-3 py-1.5 text-sm"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? "Trying again…" : "Try again"}
        </button>
      ) : null}
    </div>
  );
}
