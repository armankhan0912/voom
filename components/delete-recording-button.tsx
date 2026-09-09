"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteRecordingButton({
  id,
  redirectTo,
  className,
}: {
  id: string;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (deleting) return;
    if (!window.confirm("Delete this Voom? This cannot be undone.")) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/videos/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        setDeleting(false);
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={deleting}
      onClick={() => void remove()}
      className={
        className ??
        "rounded-full px-2 py-1 text-sm text-voom-muted hover:text-voom-ink disabled:opacity-50"
      }
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
