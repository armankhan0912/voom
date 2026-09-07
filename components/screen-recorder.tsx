"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadRecording } from "@/lib/upload-recording";

async function captureStream(includeMicrophone: boolean) {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });

  if (!includeMicrophone) {
    return display;
  }

  const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  const displayAudio = display.getAudioTracks()[0];

  if (displayAudio) {
    context
      .createMediaStreamSource(new MediaStream([displayAudio]))
      .connect(destination);
  }

  context.createMediaStreamSource(microphone).connect(destination);

  return new MediaStream([
    ...display.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function ScreenRecorder() {
  const router = useRouter();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const [includeMicrophone, setIncludeMicrophone] = useState(true);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    const stream = await captureStream(includeMicrophone);
    streamRef.current = stream;
    chunksRef.current = [];
    startedAtRef.current = Date.now();

    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm",
    });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      void finish();
    };

    stream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    });

    recorder.start(1000);
    setRecording(true);
  }

  async function finish() {
    setRecording(false);
    stopStream(streamRef.current);
    streamRef.current = null;

    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];

    if (blob.size === 0) {
      setError("Nothing was recorded.");
      return;
    }

    setUploading(true);

    try {
      const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
      const result = await uploadRecording(blob, duration);
      router.push(`/v/${result.video.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function stop() {
    recorderRef.current?.stop();
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeMicrophone}
          onChange={(event) => setIncludeMicrophone(event.target.checked)}
          disabled={recording || uploading}
        />
        Include microphone
      </label>

      {recording ? (
        <button
          type="button"
          onClick={stop}
          className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background"
        >
          Stop recording
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          disabled={uploading}
          className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Start recording"}
        </button>
      )}

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}
