/// <reference types="vite/client" />
/// <reference types="chrome" />

declare module "*?script" {
  const path: string;
  export default path;
}

interface MediaTrackConstraintSet {
  chromeMediaSource?: string;
  chromeMediaSourceId?: string;
}

interface MediaTrackConstraints {
  mandatory?: MediaTrackConstraintSet;
}

interface Window {
  __voomBridgeHandler?: (event: MessageEvent<unknown>) => void;
}

interface Navigator {
  webkitGetUserMedia?: (
    constraints: MediaStreamConstraints,
    successCallback: (stream: MediaStream) => void,
    errorCallback: (error: Error) => void,
  ) => void;
}
