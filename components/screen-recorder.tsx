"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadRecording } from "@/lib/upload-recording";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function ScreenRecorder() {
  const router = useRouter();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    streamRef.current = stream;
    chunksRef.current = [];
    startedAtRef.current = Date.now();

    const recorder = new MediaRecorder(stream);
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
    recorder.start();
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

  return (
    <div>
      {recording ? (
        <button type="button" onClick={() => recorderRef.current?.stop()}>
          Stop
        </button>
      ) : (
        <button type="button" onClick={() => void start()} disabled={uploading}>
          {uploading ? "Uploading…" : "Start recording"}
        </button>
      )}
      {error ? <p>{error}</p> : null}
    </div>
  );
}
