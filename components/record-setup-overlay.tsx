"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./record-setup-overlay.module.css";

type DeviceOption = { deviceId: string; label: string };

const RecordSetupContext = createContext<{
  open: () => void;
  close: () => void;
} | null>(null);

export function useRecordSetup() {
  const value = useContext(RecordSetupContext);
  if (!value) {
    throw new Error("useRecordSetup must be used within RecordSetupProvider");
  }
  return value;
}

function requestExtension(type: string, extra?: Record<string, unknown>) {
  window.postMessage({ type, ...extra }, "*");
}

async function primeMediaPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        // Overlay shows the denial.
      }
    }
  }
}

function CameraIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h7A2.5 2.5 0 0 1 16 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 15.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M16 10.5l4.2-2.4A1 1 0 0 1 21.5 9v6a1 1 0 0 1-1.3.9L16 13.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RecordSetupOverlay({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const [installed, setInstalled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraDeviceId, setCameraDeviceId] = useState("");
  const [micDeviceId, setMicDeviceId] = useState("");
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [mics, setMics] = useState<DeviceOption[]>([]);
  const [bubblePos, setBubblePos] = useState({ left: 24, top: null as number | null });

  const cameraDeviceIdRef = useRef("");
  const previewGenRef = useRef(0);

  const stopPreview = useCallback(() => {
    previewGenRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  const fillDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const nextCameras = devices
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
      }));
    const nextMics = devices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      }));
    setCameras(nextCameras);
    setMics(nextMics);
    setMicDeviceId((current) => current || nextMics[0]?.deviceId || "");
  }, []);

  const startPreview = useCallback(async (deviceId: string) => {
    if (!cameraEnabled) {
      stopPreview();
      return;
    }

    const gen = ++previewGenRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { ideal: deviceId } } : true,
        audio: micEnabled,
      });
      if (gen !== previewGenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const previous = streamRef.current;
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            // Autoplay can fail; muted + playsInline usually allows it.
          }
        }
      }
      previous?.getTracks().forEach((track) => track.stop());
      stream.getAudioTracks().forEach((track) => track.stop());

      const usedId = stream.getVideoTracks()[0]?.getSettings().deviceId || deviceId;
      if (usedId && !cameraDeviceIdRef.current) {
        cameraDeviceIdRef.current = usedId;
        setCameraDeviceId(usedId);
      }
      setError(null);
      await fillDevices();
    } catch {
      if (gen !== previewGenRef.current) {
        return;
      }
      stopPreview();
      setCameraEnabled(false);
      setError("Camera permission was denied.");
    }
  }, [cameraEnabled, fillDevices, micEnabled, stopPreview]);

  useEffect(() => {
    cameraDeviceIdRef.current = cameraDeviceId;
  }, [cameraDeviceId]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window || !event.data || typeof event.data !== "object") {
        return;
      }

      if (event.data.type === "voom-extension-ready") {
        setInstalled(true);
      }

      if (event.data.type === "voom-extension-stale") {
        setInstalled(true);
        setStarting(false);
        setError("Refresh this page to reconnect the Voom extension.");
      }

      if (event.data.type === "voom-begin-result") {
        const payload = event.data.payload as { error?: string; ok?: boolean };
        if (payload?.error === "already_recording") {
          setStarting(false);
          setError("Recording is already in progress. Use Pause/Stop on the page.");
          return;
        }
        if (payload?.error) {
          setStarting(false);
          setError(payload.error);
          return;
        }
        onClose();
      }
    }

    window.addEventListener("message", onMessage);
    requestExtension("voom-ping-extension");
    const timeout = window.setTimeout(() => {
      setInstalled((current) => current ?? false);
    }, 400);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
    };
  }, [onClose]);

  useEffect(() => {
    if (!cameraEnabled) {
      stopPreview();
      return;
    }
    void startPreview(cameraDeviceIdRef.current);
    return () => {
      previewGenRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
    };
  }, [cameraEnabled, startPreview, stopPreview]);

  function onBubblePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onBubblePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const left = dragRef.current.left + (event.clientX - dragRef.current.x);
    const top = dragRef.current.top + (event.clientY - dragRef.current.y);
    const maxLeft = window.innerWidth - 168;
    const maxTop = window.innerHeight - 168;
    setBubblePos({
      left: Math.max(0, Math.min(maxLeft, left)),
      top: Math.max(0, Math.min(maxTop, top)),
    });
  }

  function onBubblePointerUp(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Not captured.
    }
  }

  function startRecording() {
    if (installed !== true || starting) return;
    setError(null);
    setStarting(true);
    const payload = {
      cameraEnabled,
      cameraDeviceId: cameraDeviceIdRef.current || cameraDeviceId,
      micEnabled,
      micDeviceId,
    };
    stopPreview();
    onClose();
    requestExtension("voom-begin", payload);
  }

  const startDisabled = installed !== true || starting;

  return (
    <>
      <div className={styles.backdrop} />

      <div className={styles.panel}>
        <div className={styles.header}>
          <p className={styles.title}>Record</p>
          <button className={styles.close} type="button" aria-label="Close recorder" onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.control}>
          <CameraIcon />
          {cameras.length > 0 ? (
            <select
              className={styles.controlSelect}
              value={cameraDeviceId}
              disabled={!cameraEnabled}
              onChange={(event) => {
                const id = event.target.value;
                cameraDeviceIdRef.current = id;
                setCameraDeviceId(id);
                void startPreview(id);
              }}
              aria-label="Camera"
            >
              {cameras.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          ) : (
            <span className={styles.controlLabel}>Camera</span>
          )}
          <button
            className={`${styles.toggle} ${cameraEnabled ? styles.toggleOn : styles.toggleOff}`}
            type="button"
            onClick={() => setCameraEnabled((value) => !value)}
          >
            {cameraEnabled ? "On" : "Off"}
          </button>
        </div>

        <div className={styles.control}>
          <MicIcon />
          {mics.length > 0 ? (
            <select
              className={styles.controlSelect}
              value={micDeviceId}
              disabled={!micEnabled}
              onChange={(event) => setMicDeviceId(event.target.value)}
              aria-label="Microphone"
            >
              {mics.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          ) : (
            <span className={styles.controlLabel}>Microphone</span>
          )}
          <button
            className={`${styles.toggle} ${micEnabled ? styles.toggleOn : styles.toggleOff}`}
            type="button"
            onClick={() => setMicEnabled((value) => !value)}
          >
            {micEnabled ? "On" : "Off"}
          </button>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        {installed === false ? (
          <p className={styles.install}>
            Install the Voom Recorder extension, then reload this page.
          </p>
        ) : null}
        {starting ? <p className={styles.status}>Choose what to share in the Chrome dialog.</p> : null}

        <button className={styles.start} type="button" disabled={startDisabled} onClick={startRecording}>
          {starting ? "Starting…" : "Start Recording"}
        </button>
      </div>

      {cameraEnabled ? (
        <div
          className={styles.bubble}
          style={
            bubblePos.top == null
              ? { left: bubblePos.left, bottom: 24, top: "auto" }
              : { left: bubblePos.left, top: bubblePos.top, bottom: "auto" }
          }
          onPointerDown={onBubblePointerDown}
          onPointerMove={onBubblePointerMove}
          onPointerUp={onBubblePointerUp}
        >
          <video ref={videoRef} autoPlay muted playsInline />
        </div>
      ) : null}
    </>
  );
}

function RecordQueryOpener({ onOpen }: { onOpen: () => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("record") === "1") {
      onOpen();
    }
  }, [onOpen, searchParams]);

  return null;
}

export function RecordSetupProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pathname === "/record") {
      setOpen(true);
    }
  }, [pathname]);

  const close = useCallback(() => {
    setOpen(false);
    if (pathname === "/record") {
      router.replace("/");
      return;
    }
    if (typeof window !== "undefined" && window.location.search.includes("record=1")) {
      router.replace("/");
    }
  }, [pathname, router]);

  const openSetup = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <RecordSetupContext.Provider value={{ open: openSetup, close }}>
      {children}
      <Suspense fallback={null}>
        <RecordQueryOpener onOpen={openSetup} />
      </Suspense>
      {mounted && open
        ? createPortal(<RecordSetupOverlay onClose={close} />, document.body)
        : null}
    </RecordSetupContext.Provider>
  );
}

export { primeMediaPermission };
