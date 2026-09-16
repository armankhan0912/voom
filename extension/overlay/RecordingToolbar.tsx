import type { MouseEvent, MutableRefObject, Ref } from "react";
import { formatElapsed } from "./media";

type RecordingToolbarProps = {
  rootRef: Ref<HTMLDivElement>;
  ignoreClickRef: MutableRefObject<boolean>;
  live: boolean;
  paused: boolean;
  stopping: boolean;
  elapsedMs: number;
  onPause: () => void;
  onStop: () => void;
};

export function RecordingToolbar({
  rootRef,
  ignoreClickRef,
  live,
  paused,
  stopping,
  elapsedMs,
  onPause,
  onStop,
}: RecordingToolbarProps) {
  const className = [live ? "" : "hidden", paused ? "is-paused" : ""]
    .filter(Boolean)
    .join(" ");

  function guardClick(event: MouseEvent, action: () => void) {
    if (ignoreClickRef.current) {
      event.preventDefault();
      ignoreClickRef.current = false;
      return;
    }
    action();
  }

  return (
    <div id="toolbar" ref={rootRef} className={className || undefined}>
      <span id="rec-dot" aria-hidden="true" />
      <span id="timer">{formatElapsed(elapsedMs)}</span>
      <span className="divider" aria-hidden="true" />
      <button
        id="pause"
        type="button"
        className={paused ? "is-resume" : undefined}
        title={paused ? "Resume" : "Pause"}
        aria-label={paused ? "Resume" : "Pause"}
        disabled={stopping}
        onClick={(event) => guardClick(event, onPause)}
      >
        <svg className="icon-pause" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
          <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
        </svg>
        <svg className="icon-play" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 3.2v9.6L13 8 5 3.2Z" />
        </svg>
      </button>
      <button
        id="stop"
        type="button"
        title={stopping ? "Uploading…" : "Stop recording"}
        aria-label={stopping ? "Uploading…" : "Stop recording"}
        disabled={stopping}
        onClick={(event) => guardClick(event, onStop)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
        </svg>
      </button>
    </div>
  );
}
