import Image from "next/image";
import Link from "next/link";

const MARK_ASPECT = 484 / 364;

export function VoomMark({
  size = 32,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/voom-mark.png"
      alt=""
      aria-hidden="true"
      width={Math.round(size * MARK_ASPECT)}
      height={size}
      priority={priority}
      className={className}
    />
  );
}

export function VoomWordmark({
  size = 28,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={`inline-flex items-center leading-none ${className ?? ""}`}>
      <span className="sr-only">Voom</span>
      <VoomMark size={size * 1.5} priority={priority} />
      <span
        aria-hidden="true"
        className="font-bold tracking-[-0.045em] text-voom-ink"
        style={{ fontSize: size, marginLeft: size * -0.08 }}
      >
        oom
      </span>
    </span>
  );
}

export function VoomBrand({
  href = "/",
  showMark = false,
}: {
  href?: string;
  showMark?: boolean;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight text-voom-ink">
      {showMark ? <VoomMark size={24} /> : null}
      Voom
    </Link>
  );
}
