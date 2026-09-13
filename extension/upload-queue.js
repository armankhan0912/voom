const voomAssembler =
  typeof createPartAssembler === "function"
    ? {
        createPartAssembler,
        UPLOAD_PART_SIZE,
        MAX_CONCURRENT_UPLOADS,
        MAX_QUEUED_BYTES,
      }
    : // eslint-disable-next-line @typescript-eslint/no-require-imports -- Node tests
      require("./upload-assembler.js");

// Crash/tab-close: do not resume an in-progress recording. The background
// worker aborts multipart (if started) and marks the video failed.
function createVoomUploadQueue(options) {
  const requestStart = options.requestStart;
  const requestBeginMultipart = options.requestBeginMultipart;
  const requestPartUrl = options.requestPartUrl;
  const requestPutUrl = options.requestPutUrl;
  const onBackpressure = options.onBackpressure ?? (() => {});
  const partSize = options.partSize ?? voomAssembler.UPLOAD_PART_SIZE;
  const maxConcurrent =
    options.maxConcurrent ?? voomAssembler.MAX_CONCURRENT_UPLOADS;
  const maxQueuedBytes = options.maxQueuedBytes ?? voomAssembler.MAX_QUEUED_BYTES;
  const resumeBytes = Math.floor(maxQueuedBytes / 2);

  const assembler = voomAssembler.createPartAssembler(partSize);
  const ready = [];
  let session = null;
  let sessionPromise = null;
  let beginMultipartPromise = null;
  let usedMultipart = false;
  let incoming = [];
  let queuedBytes = 0;
  let nextPartNumber = 1;
  let inFlight = 0;
  let parts = [];
  let uploadedBytes = 0;
  let pumping = false;
  let closed = false;
  let failed = false;
  let failError = null;
  let finishedResult = null;
  let backpressure = false;
  let backpressureSince = 0;
  let chunkIndex = 0;
  const waiters = [];

  function log(event, extra) {
    if (extra !== undefined) {
      console.log("[voom]", event, extra);
    } else {
      console.log("[voom]", event);
    }
  }

  function delay(ms) {
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

  function fail(error) {
    if (failed) {
      return;
    }

    failed = true;
    failError = error instanceof Error ? error : new Error(String(error));
    log("chunk upload failed", failError.message);
    wake();
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

  function assignPart(body) {
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
      const complete = assembler.push(blob);
      for (const body of complete) {
        usedMultipart = true;
        ready.push(assignPart(body));
      }
    }
  }

  function takeReadyPart() {
    fillReadyParts();
    return ready.length > 0 ? ready.shift() : null;
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

    beginMultipartPromise = requestBeginMultipart(session.video.id).then(
      (result) => {
        if (!result?.uploadId) {
          throw new Error(result?.error || "Could not start multipart upload");
        }

        session.uploadId = result.uploadId;
        log("multipart started", session.video.id);
        return result;
      },
    );

    return beginMultipartPromise;
  }

  function enqueue(blob) {
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

  async function putWithRetries(url, body, contentType) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (failed) {
        throw failError;
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

  async function uploadPart(job) {
    inFlight += 1;
    console.log(`[voom] part ${job.partNumber} size=${job.size} bytes`);
    log("chunk upload started", {
      partNumber: job.partNumber,
      size: job.size,
    });

    try {
      await ensureMultipart();
      const signed = await requestPartUrl(session.video.id, job.partNumber);
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

  async function uploadSingleObject(blob) {
    if (!requestPutUrl) {
      throw new Error("Single-object upload is not configured");
    }

    log("small recording putObject", { size: blob.size });
    const signed = await requestPutUrl(session.video.id);
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

  function waitUntil(predicate) {
    return new Promise((resolve, reject) => {
      const check = () => {
        if (failed) {
          reject(failError);
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
      throw failError;
    }

    if (!session) {
      throw new Error("Upload session was not created");
    }

    fillReadyParts();
    const leftover = assembler.flush();

    if (!usedMultipart) {
      if (!leftover || leftover.size <= 0) {
        throw new Error("Nothing was recorded.");
      }

      await uploadSingleObject(leftover);
      finishedResult = {
        mode: "put",
        videoId: session.video.id,
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
      videoId: session.video.id,
      parts: ordered.map(({ partNumber, etag }) => ({ partNumber, etag })),
    };
    return finishedResult;
  }

  function getState() {
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createVoomUploadQueue };
}
