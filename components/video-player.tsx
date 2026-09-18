"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useWatchPlayer } from "@/components/watch-player-context";
import { formatDuration } from "@/lib/recording-display";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const HIDE_CONTROLS_MS = 2500;
const SEEK_STEP = 5;
const VOLUME_STEP = 0.1;

function resolvedDuration(
  video: HTMLVideoElement | null,
  fallbackSeconds?: number | null,
) {
  if (video && Number.isFinite(video.duration) && video.duration > 0) {
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

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function controlButtonClass(extra = "") {
  return `inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-150 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voom-accent ${extra}`;
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
  const { videoRef, reportCurrentTime } = useWatchPlayer();
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    typeof durationSeconds === "number" && durationSeconds > 0 ? durationSeconds : 0,
  );
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [canPip, setCanPip] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setCanPip(document.pictureInPictureEnabled);
  }, []);

  const embed = variant === "embed";
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused && !video.ended && !menuOpen) {
        setShowControls(false);
      }
    }, HIDE_CONTROLS_MS);
  }, [clearHideTimer, menuOpen, videoRef]);

  const revealControls = useCallback(() => {
    setShowControls(true);
    const video = videoRef.current;
    if (video && !video.paused && !video.ended) {
      scheduleHide();
    }
  }, [scheduleHide, videoRef]);

  const syncFromVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const nextDuration = resolvedDuration(video, durationSeconds);
    const nextTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    setPlaying(!video.paused && !video.ended);
    setCurrentTime(nextTime);
    reportCurrentTime(nextTime);
    setDuration(nextDuration);
    setVolume(video.volume);
    setMuted(video.muted || video.volume === 0);
    setSpeed(video.playbackRate);
    if (video.buffered.length > 0 && nextDuration > 0) {
      setBuffered((video.buffered.end(video.buffered.length - 1) / nextDuration) * 100);
    }
    if (video.paused || video.ended) {
      setShowControls(true);
      clearHideTimer();
    }
  }, [clearHideTimer, durationSeconds, reportCurrentTime, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    setLoadError(false);
    setBuffering(true);
    setMenuOpen(false);
    setCurrentTime(0);
    reportCurrentTime(0);
    setDuration(
      typeof durationSeconds === "number" && durationSeconds > 0 ? durationSeconds : 0,
    );
    setShowControls(true);

    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      syncFromVideo();
      scheduleHide();
    };
    const onCanPlay = () => setBuffering(false);
    const onError = () => {
      setLoadError(true);
      setBuffering(false);
    };
    const onEnded = () => {
      setPlaying(false);
      setShowControls(true);
      syncFromVideo();
    };
    const onEnterPip = () => setPipActive(true);
    const onLeavePip = () => setPipActive(false);

    video.addEventListener("loadedmetadata", syncFromVideo);
    video.addEventListener("durationchange", syncFromVideo);
    video.addEventListener("timeupdate", syncFromVideo);
    video.addEventListener("progress", syncFromVideo);
    video.addEventListener("play", syncFromVideo);
    video.addEventListener("pause", syncFromVideo);
    video.addEventListener("ended", onEnded);
    video.addEventListener("seeking", syncFromVideo);
    video.addEventListener("seeked", syncFromVideo);
    video.addEventListener("volumechange", syncFromVideo);
    video.addEventListener("ratechange", syncFromVideo);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    video.addEventListener("enterpictureinpicture", onEnterPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);

    if (video.readyState >= 1) {
      syncFromVideo();
      setBuffering(video.readyState < 3);
    }

    return () => {
      video.removeEventListener("loadedmetadata", syncFromVideo);
      video.removeEventListener("durationchange", syncFromVideo);
      video.removeEventListener("timeupdate", syncFromVideo);
      video.removeEventListener("progress", syncFromVideo);
      video.removeEventListener("play", syncFromVideo);
      video.removeEventListener("pause", syncFromVideo);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("seeking", syncFromVideo);
      video.removeEventListener("seeked", syncFromVideo);
      video.removeEventListener("volumechange", syncFromVideo);
      video.removeEventListener("ratechange", syncFromVideo);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
      video.removeEventListener("enterpictureinpicture", onEnterPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
      clearHideTimer();
    };
  }, [clearHideTimer, durationSeconds, reportCurrentTime, scheduleHide, src, syncFromVideo, videoRef]);

  useEffect(() => {
    function onFullscreenChange() {
      const root = rootRef.current;
      setFullscreen(Boolean(root && document.fullscreenElement === root));
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setMenuOpen(false);
    }

    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    setMenuOpen(false);
    rootRef.current?.focus({ preventScroll: true });
    if (video.paused || video.ended) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [videoRef]);

  const seekToRatio = useCallback(
    (clientX: number) => {
      const video = videoRef.current;
      const bar = progressRef.current;
      const length = resolvedDuration(video, durationSeconds);
      if (!video || !bar || length <= 0) {
        return;
      }

      const rect = bar.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      video.currentTime = ratio * length;
      syncFromVideo();
    },
    [durationSeconds, syncFromVideo, videoRef],
  );

  const onProgressPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekToRatio(event.clientX);
  };

  const onProgressPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return;
    }
    seekToRatio(event.clientX);
  };

  const onProgressPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const skip = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      const length = resolvedDuration(video, durationSeconds);
      if (!video || length <= 0) {
        return;
      }
      video.currentTime = Math.min(length, Math.max(0, video.currentTime + delta));
      syncFromVideo();
    },
    [durationSeconds, syncFromVideo, videoRef],
  );

  const changeVolume = useCallback(
    (next: number) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      const volumeValue = Math.min(1, Math.max(0, next));
      video.volume = volumeValue;
      video.muted = volumeValue === 0;
      syncFromVideo();
    },
    [syncFromVideo, videoRef],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) {
        video.volume = 1;
      }
    } else {
      video.muted = true;
    }
    syncFromVideo();
  }, [syncFromVideo, videoRef]);

  const toggleFullscreen = useCallback(async () => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    try {
      if (document.fullscreenElement === root) {
        await document.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch {
      // Fullscreen can be blocked by the browser.
    }
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !canPip) {
      return;
    }

    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP can be blocked by the browser.
    }
  }, [canPip, videoRef]);

  const setPlaybackSpeed = useCallback(
    (rate: number) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      video.playbackRate = rate;
      setMenuOpen(false);
      syncFromVideo();
    },
    [syncFromVideo, videoRef],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditableTarget(event.target)) {
      return;
    }

    const key = event.key;
    if (key === " " || key === "k" || key === "K") {
      event.preventDefault();
      togglePlay();
      return;
    }
    if (key === "ArrowLeft") {
      event.preventDefault();
      skip(-SEEK_STEP);
      return;
    }
    if (key === "ArrowRight") {
      event.preventDefault();
      skip(SEEK_STEP);
      return;
    }
    if (key === "ArrowUp") {
      event.preventDefault();
      changeVolume((videoRef.current?.volume ?? volume) + VOLUME_STEP);
      return;
    }
    if (key === "ArrowDown") {
      event.preventDefault();
      changeVolume((videoRef.current?.volume ?? volume) - VOLUME_STEP);
      return;
    }
    if (key === "m" || key === "M") {
      event.preventDefault();
      toggleMute();
      return;
    }
    if (key === "f" || key === "F") {
      event.preventDefault();
      void toggleFullscreen();
      return;
    }
    if (key === "Escape") {
      if (menuOpen) {
        event.preventDefault();
        setMenuOpen(false);
      }
    }
  };

  const clockLabel = `${formatDuration(Math.floor(currentTime))} / ${formatDuration(Math.floor(duration))}`;
  const controlsVisible = showControls || !playing || loadError || menuOpen;

  return (
    <div
      ref={rootRef}
      className={
        embed
          ? "relative h-full w-full overflow-hidden bg-black"
          : "relative overflow-hidden rounded-[20px] bg-black shadow-[0_8px_28px_rgba(23,23,23,0.12)]"
      }
      tabIndex={0}
      role="region"
      aria-label={`${title} video player`}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (playing && !menuOpen) {
          setShowControls(false);
        }
      }}
      onFocus={revealControls}
      onKeyDown={onKeyDown}
    >
      <video
        ref={videoRef}
        className={
          embed
            ? "voom-watch-video h-full w-full object-contain"
            : "voom-watch-video aspect-video w-full"
        }
        src={src}
        playsInline
        preload="auto"
        title={title}
        onClick={togglePlay}
      />

      {buffering && !loadError ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="size-10 animate-spin rounded-full border-2 border-white/25 border-t-voom-accent" />
          <span className="sr-only">Loading video</span>
        </div>
      ) : null}

      {loadError ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-6 text-center text-sm text-white/85">
          This video could not be loaded. Refresh to try again.
        </div>
      ) : null}

      <div
        className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-10 transition-opacity duration-200 ${
          controlsVisible && !loadError ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          ref={progressRef}
          className="relative h-2 cursor-pointer rounded-full bg-white/25"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, Math.floor(duration))}
          aria-valuenow={Math.floor(currentTime)}
          aria-valuetext={clockLabel}
          tabIndex={0}
          onPointerDown={onProgressPointerDown}
          onPointerMove={onProgressPointerMove}
          onPointerUp={onProgressPointerUp}
          onPointerCancel={onProgressPointerUp}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              skip(-SEEK_STEP);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              skip(SEEK_STEP);
            }
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/35"
            style={{ width: `${Math.min(100, buffered)}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-voom-accent"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: `${progress}%` }}
          />
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-0.5 text-white">
          <button
            type="button"
            className={controlButtonClass()}
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause" : "Play"}
            onClick={togglePlay}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          <p className="shrink-0 px-1 text-[12px] font-medium whitespace-nowrap tabular-nums text-white/90">
            {clockLabel}
          </p>

          <button
            type="button"
            className={controlButtonClass()}
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
          >
            {muted ? <MutedIcon /> : <VolumeIcon />}
          </button>
          <label className="sr-only" htmlFor="voom-volume">
            Volume
          </label>
          <input
            id="voom-volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label="Volume"
            title="Volume"
            className="h-1 w-12 min-w-0 cursor-pointer accent-voom-accent sm:w-16"
            onChange={(event) => changeVolume(Number(event.target.value))}
          />

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <div className="relative">
              <button
                type="button"
                className={controlButtonClass("min-w-10 px-1 text-xs font-semibold")}
                aria-label="Playback speed"
                aria-expanded={menuOpen}
                title="Playback speed"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
              >
                {speed === 1 ? "1x" : `${speed}x`}
              </button>
              {menuOpen ? (
                <div
                  className="absolute right-0 bottom-11 min-w-28 overflow-hidden rounded-[12px] bg-black/90 py-1 shadow-lg"
                  role="menu"
                  aria-label="Playback speed"
                >
                  {SPEEDS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      role="menuitemradio"
                      aria-checked={speed === rate}
                      className={`block w-full px-3 py-1.5 text-left text-sm ${
                        speed === rate ? "bg-white/15 text-voom-accent" : "text-white hover:bg-white/10"
                      }`}
                      onClick={() => setPlaybackSpeed(rate)}
                    >
                      {rate === 1 ? "Normal" : `${rate}x`}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {canPip ? (
              <button
                type="button"
                className={controlButtonClass()}
                aria-label={pipActive ? "Exit picture in picture" : "Picture in picture"}
                title={pipActive ? "Exit picture in picture" : "Picture in picture"}
                onClick={() => void togglePip()}
              >
                <PipIcon />
              </button>
            ) : null}

            <button
              type="button"
              className={controlButtonClass()}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => void toggleFullscreen()}
            >
              {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5L8 5.5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M5 9v6h4l5 4V5L9 9H5Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Z" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M5 9v6h4l5 4V5L9 9H5Zm14.5 1.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4-2.1-2.1 2.1-2.1Z" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M7 14H5v5h5v-2H7v-3Zm0-4V7h3V5H5v5h2Zm10 7h-3v2h5v-5h-2v3ZM14 5v2h3v3h2V5h-5Z" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M7 16h3v3h2v-5H7v2Zm3-8H7v2h5V5h-2v3Zm4 11h2v-3h3v-2h-5v5Zm2-11V5h-2v5h5V8h-3Z" />
    </svg>
  );
}

function PipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M4 6h16v12H4V6Zm2 2v8h12V8H6Zm6 3h6v5h-6v-5Z" />
    </svg>
  );
}
