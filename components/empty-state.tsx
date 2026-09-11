import Link from "next/link";
import { RecordLink } from "@/components/record-link";

function EmptyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mx-auto h-10 w-10 text-voom-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M10 10.5v5l4.5-2.5z" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  const className = "voom-btn-primary mt-6";

  return (
    <div className="voom-card px-8 py-16 text-center">
      <EmptyIcon />
      <h2 className="mt-5 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-voom-muted">{description}</p>
      {actionHref === "/record" ? (
        <RecordLink className={className}>{actionLabel}</RecordLink>
      ) : (
        <Link href={actionHref} className={className}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
