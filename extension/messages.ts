export const RECORDER_PORT_NAME = "voom-recorder";

export type OverlayPart = "bubble" | "toolbar";

export type RecorderState =
  | "idle"
  | "permission_request"
  | "setup"
  | "screen_selection"
  | "recording"
  | "paused"
  | "stopping"
  | "completed"
  | "error";

export type RecorderControlAction =
  | "sync"
  | "start"
  | "pause"
  | "resume"
  | "stop";

export type OverlayControlAction = "pause" | "resume" | "stop";

export type VoomSession = {
  recorderTabId: number | null;
  usingOffscreen: boolean;
  overlayTabId: number | null;
  sourceTabId: number | null;
  pendingStreamId: string | null;
  state: RecorderState;
  elapsedMs: number;
  videoId: string | null;
  uploadSettled: boolean;
};

export type VoomUiState = {
  type: "voom-ui-state";
  state: RecorderState | string;
  elapsedMs: number;
  cameraEnabled?: boolean;
  cameraDeviceId?: string;
  micEnabled?: boolean;
};

export type UploadPartRef = {
  partNumber: number;
  etag: string;
};

export type VoomBeginMessage = {
  type: "voom-begin";
  source?: "popup" | "website";
  autostart?: boolean;
  cameraEnabled?: boolean;
  cameraDeviceId?: string;
  micEnabled?: boolean;
  micDeviceId?: string;
};

export type VoomRuntimeMessage =
  | { type: "voom-get-config" }
  | { type: "voom-query-session" }
  | VoomBeginMessage
  | { type: "voom-upload-start"; contentType?: string }
  | { type: "voom-upload-multipart"; videoId: string }
  | { type: "voom-upload-object"; videoId: string }
  | { type: "voom-upload-part"; videoId: string; partNumber: number }
  | {
      type: "voom-upload-finish";
      videoId: string;
      parts: UploadPartRef[];
      duration?: number;
    }
  | { type: "voom-upload-abort"; videoId?: string }
  | { type: "voom-presign"; contentType?: string }
  | { type: "voom-complete"; videoId: string; duration?: number; failed?: boolean }
  | { type: "voom-upload"; buffer: ArrayBuffer; contentType?: string; duration?: number }
  | { type: "voom-broadcast"; payload: VoomUiState }
  | { type: "voom-overlay-ready" }
  | { type: "voom-overlay-control"; action: OverlayControlAction }
  | { type: "voom-choose-desktop"; recorderTabId?: number | null }
  | { type: "voom-overlay-choose-desktop"; recorderTabId?: number | null }
  | { type: "voom-activate-recorder" }
  | { type: "voom-prepare-overlay" }
  | { type: "voom-focus-page" }
  | { type: "voom-capture-cancelled" }
  | { type: "voom-remove-overlay" }
  | { type: "voom-release-camera" }
  | { type: "voom-prime-media"; mic?: boolean }
  | VoomUiState
  | { type: "voom-recorder-control"; action: RecorderControlAction };

export type OverlayWindowMessage =
  | { type: "voom-overlay-visibility"; bubble?: boolean; toolbar?: boolean }
  | { type: "voom-overlay-shown" }
  | {
      type: "voom-overlay-drag-start";
      part: OverlayPart | string | null;
      screenX: number;
      screenY: number;
    }
  | {
      type: "voom-overlay-drag-move";
      part: OverlayPart | string | null;
      screenX: number;
      screenY: number;
    }
  | { type: "voom-overlay-drag-end"; part: OverlayPart | string | null }
  | { type: "voom-stop-camera" }
  | { type: "voom-prime-media"; mic?: boolean }
  | { type: "voom-prime-media-result"; ok: boolean; denied?: boolean }
  | { type: "voom-choose-desktop"; recorderTabId?: number | null }
  | {
      type: "voom-choose-desktop-result";
      streamId: string;
      unsupported: boolean;
    }
  | VoomUiState;

export type WebsiteWindowMessage =
  | { type: "voom-ping-extension" }
  | VoomBeginMessage
  | { type: "voom-query-session" }
  | { type: "voom-extension-ready" }
  | { type: "voom-extension-stale" }
  | { type: "voom-begin-result"; payload: { error?: string; ok?: boolean } }
  | { type: "voom-session"; payload: VoomSession | Record<string, unknown> };

export type VoomMessage =
  | VoomRuntimeMessage
  | OverlayWindowMessage
  | WebsiteWindowMessage;
