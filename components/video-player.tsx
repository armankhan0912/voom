"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWatchPlayer } from "@/components/watch-player-context";

function progressFromVideo(video: HTMLVideoElement) {
  const { currentTime, duration } = video;
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

export function VideoPlayer({ src, title }: { src: string; title: string }) {
  const { videoRef } = useWatchPlayer();
  const progressBarRef = useRef<HTMLDivElement>(null);
  const recoveringDuration = useRef(false);
  const [progress, setProgress] = useState(0);

  const syncProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || recoveringDuration.current) {
      return;
    }

    setProgress(progressFromVideo(video));
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    recoveringDuration.current = false;
    setProgress(0);

    const finishDurationRecovery = () => {
      if (!recoveringDuration.current) {
        return false;
      }

      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        return true;
      }

      recoveringDuration.current = false;
      if (video.currentTime !== 0) {
        video.currentTime = 0;
      }

      return false;
    };

    const onLoadedMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        recoveringDuration.current = false;
        syncProgress();
        return;
      }

      recoveringDuration.current = true;
      try {
        video.currentTime = 1e101;
      } catch {
        recoveringDuration.current = false;
        syncProgress();
      }
    };

    const onDurationChange = () => {
      if (finishDurationRecovery()) {
        return;
      }

      syncProgress();
    };

    const onSeeked = () => {
      if (finishDurationRecovery()) {
        return;
      }

      syncProgress();
    };

    const onEnded = () => {
      recoveringDuration.current = false;
      setProgress(100);
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("timeupdate", syncProgress);
    video.addEventListener("play", syncProgress);
    video.addEventListener("pause", syncProgress);
    video.addEventListener("ended", onEnded);
    video.addEventListener("seeking", syncProgress);
    video.addEventListener("seeked", onSeeked);

    if (video.readyState >= 1) {
      onLoadedMetadata();
    } else {
      syncProgress();
    }

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("timeupdate", syncProgress);
      video.removeEventListener("play", syncProgress);
      video.removeEventListener("pause", syncProgress);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("seeking", syncProgress);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [src, syncProgress, videoRef]);

  const seekFromClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const bar = progressBarRef.current;
    if (!video || !bar || !Number.isFinite(video.duration) || video.duration <= 0) {
      return;
    }

    const clickX = event.clientX - bar.getBoundingClientRect().left;
    const progressBarWidth = bar.getBoundingClientRect().width;
    if (progressBarWidth <= 0) {
      return;
    }

    const newTime = (clickX / progressBarWidth) * video.duration;
    video.currentTime = Math.max(0, Math.min(video.duration, newTime));
    setProgress(progressFromVideo(video));
  };

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-black shadow-[0_8px_28px_rgba(43,33,24,0.12)]">
      <video
        ref={videoRef}
        className="voom-watch-video aspect-video w-full"
        src={src}
        controls
        playsInline
        preload="metadata"
        title={title}
      />
      <div
        ref={progressBarRef}
        className="absolute inset-x-3 bottom-[42px] z-10 h-1 cursor-pointer rounded-full bg-white/25"
        onClick={seekFromClick}
        role="presentation"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ left: `${progress}%` }}
        />
      </div>
    </div>
  );
}
