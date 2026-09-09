import Link from "next/link";
import { RecordLink } from "@/components/record-link";

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
  const className =
    "mt-6 inline-flex rounded-full bg-voom-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-voom-accent-hover";

  return (
    <div className="rounded-3xl bg-voom-surface px-8 py-16 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-voom-muted">{description}</p>
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
