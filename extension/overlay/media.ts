import type { OverlayWindowMessage } from "../messages";

export function postParent(message: OverlayWindowMessage) {
  window.parent.postMessage(message, "*");
}

export function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export async function primeMic(needed: boolean) {
  if (!needed) {
    return { ok: true };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (error) {
    const denied = error instanceof Error && error.name === "NotAllowedError";
    return { ok: !denied, denied };
  }
}

export async function acquireCamera(deviceId: string) {
  const attempts: MediaStreamConstraints[] = [];
  if (deviceId) {
    attempts.push({ video: { deviceId: { ideal: deviceId } }, audio: false });
  }
  attempts.push({ video: { facingMode: "user" }, audio: false });
  attempts.push({ video: true, audio: false });

  let lastError: unknown;
  for (let round = 0; round < 3; round += 1) {
    if (round > 0) {
      await delay(180 * round);
    }
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw lastError;
}

export async function attachCamera(
  camera: HTMLVideoElement,
  stream: MediaStream,
) {
  const track = stream.getVideoTracks()[0];
  if (track?.muted) {
    await Promise.race([
      new Promise<void>((resolve) => {
        track.addEventListener("unmute", () => resolve(), { once: true });
      }),
      delay(400),
    ]);
  }
  if (camera.srcObject !== stream) {
    camera.srcObject = stream;
  }
  await new Promise<void>((resolve) => {
    if (camera.readyState >= 1) {
      resolve();
      return;
    }
    camera.addEventListener("loadedmetadata", () => resolve(), { once: true });
    setTimeout(resolve, 800);
  });
  try {
    await camera.play();
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "AbortError") {
      // Autoplay can still fail; muted + playsinline usually allows it.
    }
  }
}

export function playCamera(camera: HTMLVideoElement | null) {
  if (!camera || !camera.paused) {
    return;
  }
  void camera.play().catch((error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") {
      return;
    }
  });
}

export function chooseDesktop(recorderTabId?: number | null) {
  return new Promise<{ streamId: string; unsupported: boolean }>((resolve) => {
    const finish = (payload: { streamId: string; unsupported: boolean }) =>
      resolve(payload);

    void (async () => {
      try {
        if (!chrome.desktopCapture?.chooseDesktopMedia) {
          finish({ streamId: "", unsupported: true });
          return;
        }

        let targetTab: chrome.tabs.Tab | null = null;
        if (recorderTabId != null) {
          try {
            targetTab = await chrome.tabs.get(recorderTabId);
          } catch {
            targetTab = null;
          }
        }

        const sources: `${chrome.desktopCapture.DesktopCaptureSourceType}`[] = [
          "screen",
          "window",
          "tab",
        ];
        const done = (id: string) =>
          finish({ streamId: id || "", unsupported: false });
        if (targetTab) {
          chrome.desktopCapture.chooseDesktopMedia(sources, targetTab, done);
        } else {
          chrome.desktopCapture.chooseDesktopMedia(sources, done);
        }
      } catch {
        finish({ streamId: "", unsupported: true });
      }
    })();
  });
}
