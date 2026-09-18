"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type WatchPlayerContextValue = {
  videoRef: RefObject<HTMLVideoElement | null>;
  seekTo: (seconds: number) => void;
  currentTime: number;
  reportCurrentTime: (seconds: number) => void;
};

const WatchPlayerContext = createContext<WatchPlayerContextValue | null>(null);

export function WatchPlayerProvider({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(seconds)) {
      return;
    }

    const duration = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
    const next = Math.min(Math.max(0, seconds), duration);
    video.currentTime = next;
    setCurrentTime(next);
    void video.play().catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      videoRef,
      seekTo,
      currentTime,
      reportCurrentTime: setCurrentTime,
    }),
    [currentTime, seekTo],
  );

  return (
    <WatchPlayerContext.Provider value={value}>{children}</WatchPlayerContext.Provider>
  );
}

export function useWatchPlayer() {
  const value = useContext(WatchPlayerContext);
  if (!value) {
    throw new Error("useWatchPlayer must be used within WatchPlayerProvider");
  }
  return value;
}
