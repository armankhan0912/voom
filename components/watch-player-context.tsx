"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

type WatchPlayerContextValue = {
  videoRef: RefObject<HTMLVideoElement | null>;
  seekTo: (seconds: number) => void;
};

const WatchPlayerContext = createContext<WatchPlayerContextValue | null>(null);

export function WatchPlayerProvider({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(seconds)) {
      return;
    }

    video.currentTime = Math.max(0, seconds);
    void video.play().catch(() => {});
  }, []);

  return (
    <WatchPlayerContext.Provider value={{ videoRef, seekTo }}>
      {children}
    </WatchPlayerContext.Provider>
  );
}

export function useWatchPlayer() {
  const value = useContext(WatchPlayerContext);
  if (!value) {
    throw new Error("useWatchPlayer must be used within WatchPlayerProvider");
  }
  return value;
}
