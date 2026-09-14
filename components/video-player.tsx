"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWatchPlayer } from "@/components/watch-player-context";
import { formatDuration } from "@/lib/recording-display";

function resolvedDuration(
  video: HTMLVideoElement,
  fallbackSeconds?: number | null,
) {
  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration;
  }

  if (
    typeof fallbackSeconds === "number" &&
    Number.isFinite(fallbackSeconds) &&
    fallbackSeconds > 0
  ) {
    return fallbackSeconds;
  }

  return 0;
}

function progressFromVideo(
  video: HTMLVideoElement,
  fallbackSeconds?: number | null,
) {
  const duration = resolvedDuration(video, fallbackSeconds);
  if (duration <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (video.currentTime / duration) * 100));
}

export function VideoPlayer({
  src,
  title,
  duration: durationSeconds,
  variant = "watch",
}: {
  src: string;
  title: string;
  duration?: number | null;
  variant?: "watch" | "embed";
}) {
  const { videoRef } = useWatchPlayer();
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hideClockTimer = useRef<number | null>(null);
  const playingRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(
    typeof durationSeconds === "number" && durationSeconds > 0
      ? durationSeconds
      : 0,
  );
  const [showClock, setShowClock] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const embed = variant === "embed";

  const revealClock = useCallback(() => {
    setShowClock(true);
    if (hideClockTimer.current != null) {
      window.clearTimeout(hideClockTimer.current);
    }

    hideClockTimer.current = window.setTimeout(() => {
      if (playingRef.current) {
        setShowClock(false);
      }
    }, 2500);
  }, []);

  const syncProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    playingRef.current = !video.paused && !video.ended;
    setProgress(progressFromVideo(video, durationSeconds));
    setCurrentTime(video.currentTime);
    setTotalTime(resolvedDuration(video, durationSeconds));
    if (video.paused || video.ended) {
      setShowClock(true);
    }
  }, [durationSeconds, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    setProgress(0);
    setCurrentTime(0);
    setTotalTime(
      typeof durationSeconds === "number" && durationSeconds > 0
        ? durationSeconds
        : 0,
    );
    setLoadError(false);
    setShowClock(true);

    const onError = () => {
      setLoadError(true);
    };

    const onEnded = () => {
      playingRef.current = false;
      setProgress(100);
      setShowClock(true);
    };

    const onPlay = () => {
      syncProgress();
      revealClock();
    };

    video.addEventListener("loadedmetadata", syncProgress);
    video.addEventListener("durationchange", syncProgress);
    video.addEventListener("timeupdate", syncProgress);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", syncProgress);
    video.addEventListener("ended", onEnded);
    video.addEventListener("seeking", syncProgress);
    video.addEventListener("seeked", syncProgress);
    video.addEventListener("error", onError);

    if (video.readyState >= 1) {
      syncProgress();
    }

    return () => {
      video.removeEventListener("loadedmetadata", syncProgress);
      video.removeEventListener("durationchange", syncProgress);
      video.removeEventListener("timeupdate", syncProgress);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", syncProgress);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("seeking", syncProgress);
      video.removeEventListener("seeked", syncProgress);
      video.removeEventListener("error", onError);
      if (hideClockTimer.current != null) {
        window.clearTimeout(hideClockTimer.current);
      }
    };
  }, [durationSeconds, revealClock, src, syncProgress, videoRef]);

  const seekFromClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const bar = progressBarRef.current;
    if (!video || !bar) {
      return;
    }

    const duration = resolvedDuration(video, durationSeconds);
    if (duration <= 0) {
      return;
    }

    const clickX = event.clientX - bar.getBoundingClientRect().left;
    const progressBarWidth = bar.getBoundingClientRect().width;
    if (progressBarWidth <= 0) {
      return;
    }

    const newTime = (clickX / progressBarWidth) * duration;
    video.currentTime = Math.max(0, Math.min(duration, newTime));
    setProgress(progressFromVideo(video, durationSeconds));
    setCurrentTime(video.currentTime);
    setTotalTime(duration);
  };

  const clockLabel = `${formatDuration(Math.floor(currentTime))}/${
    totalTime > 0 ? formatDuration(totalTime) : "—"
  }`;

  return (
    <div
      className={
        embed
          ? "relative h-full w-full overflow-hidden bg-black"
          : "relative overflow-hidden rounded-[20px] bg-black shadow-[0_8px_28px_rgba(23,23,23,0.12)]"
      }
      onMouseMove={revealClock}
      onMouseLeave={() => {
        if (playingRef.current) {
          setShowClock(false);
        }
      }}
    >
      <video
        ref={videoRef}
        className={
          embed
            ? "voom-watch-video h-full w-full object-contain"
            : "voom-watch-video aspect-video w-full"
        }
        src={src}
        controls
        playsInline
        preload="auto"
        title={title}
      />
      {loadError ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-6 text-center text-sm text-white/85">
          This video could not be loaded. Refresh to try again.
        </div>
      ) : null}
      <div
        className={`pointer-events-none absolute bottom-[11px] left-12 z-10 text-[13px] font-medium tabular-nums text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.85)] transition-opacity duration-200 ${
          showClock && !loadError ? "opacity-100" : "opacity-0"
        }`}
      >
        {clockLabel}
      </div>
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
