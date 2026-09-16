import { useCallback, useEffect, useRef, type RefObject } from "react";
import { acquireCamera, attachCamera, playCamera, postParent } from "./media";

export function useCamera(
  part: string | null,
  videoRef: RefObject<HTMLVideoElement | null>,
  setVisible: (visible: boolean) => void,
) {
  const syncIdRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const lastDeviceIdRef = useRef("");
  const failedForRef = useRef<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    lastDeviceIdRef.current = "";
    const camera = videoRef.current;
    if (camera) {
      camera.pause();
      camera.srcObject = null;
    }
  }, [videoRef]);

  const hide = useCallback(() => {
    setVisible(false);
    postParent({ type: "voom-overlay-visibility", bubble: false });
  }, [setVisible]);

  const show = useCallback(() => {
    setVisible(true);
    postParent({ type: "voom-overlay-visibility", bubble: true });
  }, [setVisible]);

  const syncCamera = useCallback(
    async (enabled: boolean, deviceId: string) => {
      if (part === "toolbar") {
        return;
      }

      if (!enabled) {
        syncIdRef.current += 1;
        failedForRef.current = null;
        stopCamera();
        hide();
        return;
      }

      if (streamRef.current && lastDeviceIdRef.current === deviceId) {
        playCamera(videoRef.current);
        show();
        return;
      }

      if (failedForRef.current === deviceId) {
        hide();
        return;
      }

      const syncId = (syncIdRef.current += 1);
      stopCamera();
      hide();

      try {
        const stream = await acquireCamera(deviceId);
        if (syncId !== syncIdRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        lastDeviceIdRef.current = deviceId || "";
        failedForRef.current = null;
        const camera = videoRef.current;
        if (camera) {
          await attachCamera(camera, stream);
        }
        if (syncId !== syncIdRef.current) {
          return;
        }
        show();
      } catch {
        if (syncId !== syncIdRef.current) {
          return;
        }
        failedForRef.current = deviceId;
        hide();
      }
    },
    [hide, part, show, stopCamera, videoRef],
  );

  const release = useCallback(() => {
    syncIdRef.current += 1;
    stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    const onPageHide = () => {
      release();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      release();
    };
  }, [release]);

  return { syncCamera, release };
}
