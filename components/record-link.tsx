"use client";

import type { MouseEvent, ReactNode } from "react";
import { primeMediaPermission, useRecordSetup } from "@/components/record-setup-overlay";

export function RecordLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { open } = useRecordSetup();

  async function onClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    await primeMediaPermission();
    open();
  }

  return (
    <a href="/record" className={className} onClick={onClick}>
      {children}
    </a>
  );
}
