"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function RecordingTitle({
  id,
  title,
  className,
}: {
  id: string;
  title: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(title);
  }, [title]);

  async function save() {
    const next = value.trim().slice(0, 120) || "Untitled recording";
    setValue(next);
    if (next === title || saving) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/videos/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!response.ok) {
        setValue(title);
        return;
      }
      router.refresh();
    } catch {
      setValue(title);
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      aria-label="Recording title"
      value={value}
      maxLength={120}
      disabled={saving}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void save()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setValue(title);
          event.currentTarget.blur();
        }
      }}
      className={
        className ??
        "w-full min-w-0 bg-transparent font-medium outline-none"
      }
    />
  );
}
