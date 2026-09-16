import type { UploadPartRef } from "./messages";
import {
  MAX_CONCURRENT_UPLOADS,
  MAX_QUEUED_BYTES,
  UPLOAD_PART_SIZE,
  createPartAssembler,
} from "./upload-assembler";

export type UploadStartResult = {
  video?: { id: string };
  uploadId?: string;
  error?: string;
};

export type MultipartStartResult = {
  uploadId?: string;
  error?: string;
};

export type SignedUploadUrl = {
  uploadUrl?: string;
  contentType?: string;
  error?: string;
};

export type UploadQueueOptions = {
  requestStart: () => Promise<UploadStartResult>;
  requestBeginMultipart?: (videoId: string) => Promise<MultipartStartResult>;
  requestPartUrl: (
    videoId: string,
    partNumber: number,
  ) => Promise<SignedUploadUrl>;
  requestPutUrl?: (videoId: string) => Promise<SignedUploadUrl>;
  onBackpressure?: (active: boolean) => void;
  partSize?: number;
  maxConcurrent?: number;
  maxQueuedBytes?: number;
};

export type UploadFinishResult = {
  mode: "put" | "multipart";
  videoId: string;
  parts: UploadPartRef[];
};

export type UploadQueueState = {
  videoId: string | null;
  uploadedBytes: number;
  queuedBytes: number;
  parts: number;
  mode: "multipart" | "buffer";
  failed: boolean;
};

export type VoomUploadQueue = {
  begin: () => Promise<UploadStartResult>;
  enqueue: (blob: Blob) => void;
  finish: () => Promise<UploadFinishResult>;
  getState: () => UploadQueueState;
};

type UploadJob = {
  partNumber: number;
  body: Blob;
  size: number;
};

type UploadedPart = UploadPartRef & {
  size: number;
};

// Crash/tab-close: do not resume an in-progress recording. The background
// worker aborts multipart (if started) and marks the video failed.
export function createVoomUploadQueue(options: UploadQueueOptions): VoomUploadQueue {
  const requestStart = options.requestStart;
  const requestBeginMultipart = options.requestBeginMultipart;
  const requestPartUrl = options.requestPartUrl;
  const requestPutUrl = options.requestPutUrl;
  const onBackpressure = options.onBackpressure ?? (() => {});
  const partSize = options.partSize ?? UPLOAD_PART_SIZE;
  const maxConcurrent = options.maxConcurrent ?? MAX_CONCURRENT_UPLOADS;
  const maxQueuedBytes = options.maxQueuedBytes ?? MAX_QUEUED_BYTES;
  const resumeBytes = Math.floor(maxQueuedBytes / 2);

  const assembler = createPartAssembler(partSize);
  const ready: UploadJob[] = [];
  let session: UploadStartResult | null = null;
  let sessionPromise: Promise<UploadStartResult> | null = null;
  let beginMultipartPromise: Promise<MultipartStartResult> | null = null;
  let usedMultipart = false;
  let incoming: Blob[] = [];
  let queuedBytes = 0;
  let nextPartNumber = 1;
  let inFlight = 0;
  let parts: UploadedPart[] = [];
  let uploadedBytes = 0;
  let pumping = false;
  let closed = false;
  let failed = false;
  let failError: Error | null = null;
  let finishedResult: UploadFinishResult | null = null;
  let backpressure = false;
  let backpressureSince = 0;
  let chunkIndex = 0;
  const waiters: Array<() => void> = [];

  function log(event: string, extra?: unknown) {
    if (extra !== undefined) {
      console.log("[voom]", event, extra);
    } else {
      console.log("[voom]", event);
    }
  }

  function delay(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function wake() {
    const pending = waiters.splice(0);
    for (const check of pending) {
      check();
    }
  }

  function fail(error: unknown) {
    if (failed) {
      return;
    }

    failed = true;
    failError = error instanceof Error ? error : new Error(String(error));
    log("chunk upload failed", failError.message);
    wake();
  }

  function requireSession() {
    const videoId = session?.video?.id;
    if (!session || !videoId) {
      throw new Error(session?.error || "Upload session was not created");
    }
    return { session, videoId };
  }

  function updateBackpressure() {
    const held = queuedBytes;

    if (!backpressure && held >= maxQueuedBytes) {
      backpressure = true;
      backpressureSince = Date.now();
      log("upload queue backpressure on", held);
      onBackpressure(true);
      return;
    }

    if (backpressure && held <= resumeBytes) {
      backpressure = false;
      backpressureSince = 0;
      log("upload queue backpressure off", held);
      onBackpressure(false);
      return;
    }

    if (backpressure && Date.now() - backpressureSince > 30_000) {
      fail(new Error("Upload could not keep up with the recording"));
    }
  }

  function assignPart(body: Blob): UploadJob {
    const partNumber = nextPartNumber;
    nextPartNumber += 1;
    return {
      partNumber,
      body,
      size: body.size,
    };
  }

  function fillReadyParts() {
    while (incoming.length > 0) {
      const blob = incoming.shift();
      if (!blob) {
        break;
      }
      const complete = assembler.push(blob);
      for (const body of complete) {
        usedMultipart = true;
        ready.push(assignPart(body));
      }
    }
  }

  function takeReadyPart() {
    fillReadyParts();
    return ready.shift() ?? null;
  }

  async function begin() {
    log("upload session starting");
    sessionPromise = requestStart();
    session = await sessionPromise;

    if (!session?.video?.id) {
      throw new Error(session?.error || "Could not start upload");
    }

    log("upload session created", session.video.id);
    return session;
  }

  async function ensureMultipart() {
    if (beginMultipartPromise) {
      return beginMultipartPromise;
    }

    if (!requestBeginMultipart) {
      throw new Error("Multipart upload is not configured");
    }

    const { session: liveSession, videoId } = requireSession();

    beginMultipartPromise = requestBeginMultipart(videoId).then((result) => {
      if (!result?.uploadId) {
        throw new Error(result?.error || "Could not start multipart upload");
      }

      liveSession.uploadId = result.uploadId;
      log("multipart started", videoId);
      return result;
    });

    return beginMultipartPromise;
  }

  function enqueue(blob: Blob) {
    if (failed || closed || !blob || blob.size <= 0) {
      return;
    }

    chunkIndex += 1;
    incoming.push(blob);
    queuedBytes += blob.size;
    log("chunk generated", { index: chunkIndex, size: blob.size });
    log("chunk queued", { index: chunkIndex, queuedBytes });
    updateBackpressure();
    void pump();
  }

  async function putWithRetries(url: string, body: Blob, contentType?: string) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (failed) {
        throw failError ?? new Error("Upload failed");
      }

      try {
        const response = await fetch(url, {
          method: "PUT",
          body,
          ...(contentType ? { headers: { "Content-Type": contentType } } : {}),
        });

        if (!response.ok) {
          throw new Error(`Upload failed (${response.status})`);
        }

        return response;
      } catch (error) {
        if (attempt >= 3 || failed) {
          throw error;
        }

        log("chunk retry", { attempt: attempt + 1 });
        await delay(500 * 3 ** (attempt - 1));
      }
    }

    throw new Error("Upload failed");
  }

  async function uploadPart(job: UploadJob) {
    inFlight += 1;
    console.log(`[voom] part ${job.partNumber} size=${job.size} bytes`);
    log("chunk upload started", {
      partNumber: job.partNumber,
      size: job.size,
    });

    try {
      await ensureMultipart();
      const { videoId } = requireSession();
      const signed = await requestPartUrl(videoId, job.partNumber);
      if (!signed?.uploadUrl) {
        throw new Error(signed?.error || "Could not sign upload part");
      }

      const response = await putWithRetries(signed.uploadUrl, job.body);
      const etag = response.headers.get("etag") || response.headers.get("ETag");
      if (!etag) {
        throw new Error("Part upload missing ETag");
      }

      parts.push({
        partNumber: job.partNumber,
        etag,
        size: job.size,
      });
      queuedBytes -= job.size;
      uploadedBytes += job.size;
      log("chunk upload succeeded", {
        partNumber: job.partNumber,
        uploadedBytes,
      });
    } catch (error) {
      fail(error);
    } finally {
      inFlight = Math.max(0, inFlight - 1);
      updateBackpressure();
      wake();
      void pump();
    }
  }

  async function uploadSingleObject(blob: Blob) {
    if (!requestPutUrl) {
      throw new Error("Single-object upload is not configured");
    }

    const { videoId } = requireSession();
    log("small recording putObject", { size: blob.size });
    const signed = await requestPutUrl(videoId);
    if (!signed?.uploadUrl) {
      throw new Error(signed?.error || "Could not start upload");
    }

    await putWithRetries(signed.uploadUrl, blob, signed.contentType || "video/webm");
    queuedBytes -= blob.size;
    uploadedBytes += blob.size;
    updateBackpressure();
    wake();
  }

  async function pump() {
    if (pumping || failed) {
      return;
    }

    pumping = true;

    try {
      if (sessionPromise) {
        await sessionPromise;
      }

      if (!session || failed) {
        return;
      }

      while (inFlight < maxConcurrent) {
        const job = takeReadyPart();
        if (!job) {
          break;
        }

        void uploadPart(job);
      }
    } catch (error) {
      fail(error);
    } finally {
      pumping = false;
    }
  }

  function waitUntil(predicate: () => boolean) {
    return new Promise<void>((resolve, reject) => {
      const check = () => {
        if (failed) {
          reject(failError ?? new Error("Upload failed"));
          return;
        }

        if (predicate()) {
          resolve();
          return;
        }

        waiters.push(check);
      };

      check();
    });
  }

  function logMultipartParts() {
    const ordered = [...parts].sort((left, right) => left.partNumber - right.partNumber);
    console.log("[voom] multipart parts:");
    for (const part of ordered) {
      console.log(`${part.partNumber}: ${part.size} bytes`);
    }
    return ordered;
  }

  async function finish() {
    if (finishedResult) {
      return finishedResult;
    }

    closed = true;
    log("upload queue draining");

    if (sessionPromise) {
      await sessionPromise;
    }

    if (failed) {
      throw failError ?? new Error("Upload failed");
    }

    const { videoId } = requireSession();

    fillReadyParts();
    const leftover = assembler.flush();

    if (!usedMultipart) {
      if (!leftover || leftover.size <= 0) {
        throw new Error("Nothing was recorded.");
      }

      await uploadSingleObject(leftover);
      finishedResult = {
        mode: "put",
        videoId,
        parts: [],
      };
      log("upload queue drained", { mode: "put", uploadedBytes });
      return finishedResult;
    }

    void pump();

    if (leftover && leftover.size > 0) {
      void uploadPart(assignPart(leftover));
    }

    await waitUntil(
      () =>
        incoming.length === 0 &&
        ready.length === 0 &&
        assembler.getPendingBytes() === 0 &&
        inFlight === 0,
    );

    if (parts.length === 0) {
      throw new Error("Nothing was recorded.");
    }

    const ordered = logMultipartParts();
    const nonFinal = ordered.slice(0, -1);
    for (const part of nonFinal) {
      if (part.size !== partSize) {
        throw new Error(
          `Non-final part ${part.partNumber} was ${part.size} bytes, expected ${partSize}`,
        );
      }
    }

    log("upload queue drained", {
      mode: "multipart",
      parts: ordered.length,
      uploadedBytes,
    });

    finishedResult = {
      mode: "multipart",
      videoId,
      parts: ordered.map(({ partNumber, etag }) => ({ partNumber, etag })),
    };
    return finishedResult;
  }

  function getState(): UploadQueueState {
    return {
      videoId: session?.video?.id ?? null,
      uploadedBytes,
      queuedBytes,
      parts: parts.length,
      mode: usedMultipart ? "multipart" : "buffer",
      failed,
    };
  }

  return {
    begin,
    enqueue,
    finish,
    getState,
  };
}
