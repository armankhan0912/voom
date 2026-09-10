"use client";

import { useWatchPlayer } from "@/components/watch-player-context";

export function VideoPlayer({ src, title }: { src: string; title: string }) {
  const { videoRef } = useWatchPlayer();

  return (
    <div className="overflow-hidden rounded-3xl bg-black">
      <video
        ref={videoRef}
        className="aspect-video w-full"
        src={src}
        controls
        playsInline
        title={title}
      />
    </div>
  );
}
