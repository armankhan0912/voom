import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { UPLOAD_PART_SIZE, createPartAssembler } from "./upload-assembler";
import { createVoomUploadQueue } from "./upload-queue";

const PART_SIZE = UPLOAD_PART_SIZE;

type UploadedRecord = {
  size: number;
  bytes: Uint8Array<ArrayBuffer>;
  url: string;
  partNumber?: number;
};

function filledBlob(size: number, value: number) {
  return new Blob([new Uint8Array(size).fill(value)]);
}

async function readBytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await blob.arrayBuffer());
}

async function concatBytes(blobs: Blob[]) {
  const pieces: Uint8Array[] = [];
  let total = 0;
  for (const blob of blobs) {
    const bytes = await readBytes(blob);
    pieces.push(bytes);
    total += bytes.length;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const bytes of pieces) {
    out.set(bytes, offset);
    offset += bytes.length;
  }
  return out;
}

describe("createPartAssembler", () => {
  it("keeps leftover bytes when blobs cross the 10 MiB boundary", async () => {
    const assembler = createPartAssembler(PART_SIZE);
    const a = filledBlob(4 * 1024 * 1024, 1);
    const b = filledBlob(4 * 1024 * 1024, 2);
    const c = filledBlob(4 * 1024 * 1024, 3);

    assert.equal(assembler.push(a).length, 0);
    assert.equal(assembler.push(b).length, 0);
    const parts = assembler.push(c);

    assert.equal(parts.length, 1);
    assert.equal(assembler.getPendingBytes(), 2 * 1024 * 1024);

    const trailing = assembler.flush();
    const first = parts[0];
    assert.equal(first?.size, PART_SIZE);
    assert.equal(trailing?.size, 2 * 1024 * 1024);
    if (!first || !trailing) {
      throw new Error("expected a complete part and leftover bytes");
    }
    assert.deepEqual(await concatBytes([first, trailing]), await concatBytes([a, b, c]));
  });

  it("splits one large blob that crosses 10 MiB", async () => {
    const assembler = createPartAssembler(PART_SIZE);
    const source = filledBlob(PART_SIZE + 1500, 9);
    const parts = assembler.push(source);
    const trailing = assembler.flush();

    assert.equal(parts.length, 1);
    const first = parts[0];
    assert.equal(first?.size, PART_SIZE);
    assert.equal(trailing?.size, 1500);
    if (!first || !trailing) {
      throw new Error("expected a complete part and leftover bytes");
    }
    assert.deepEqual(await concatBytes([first, trailing]), await readBytes(source));
  });

  it("assembles many small blobs without dropping or duplicating bytes", async () => {
    const assembler = createPartAssembler(PART_SIZE);
    const blobs: Blob[] = [];
    const complete: Blob[] = [];

    for (let index = 0; index < 50; index += 1) {
      const blob = filledBlob(250_000 + (index % 5) * 1000, index + 1);
      blobs.push(blob);
      complete.push(...assembler.push(blob));
    }

    const trailing = assembler.flush();
    if (trailing) {
      complete.push(trailing);
    }

    for (const part of complete.slice(0, -1)) {
      assert.equal(part.size, PART_SIZE);
    }
    assert.deepEqual(await concatBytes(complete), await concatBytes(blobs));
  });
});

describe("createVoomUploadQueue hybrid upload", () => {
  const uploaded: UploadedRecord[] = [];
  const objectPuts: UploadedRecord[] = [];
  let failNext = 0;
  let multipartStarts = 0;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    uploaded.length = 0;
    objectPuts.length = 0;
    failNext = 0;
    multipartStarts = 0;
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (failNext > 0) {
        failNext -= 1;
        throw new Error("network failure");
      }

      const body = init?.body as Blob;
      const isObject = String(url).includes("/object");
      const record: UploadedRecord = {
        size: body.size,
        bytes: await readBytes(body),
        url: String(url),
      };

      if (isObject) {
        objectPuts.push(record);
      } else {
        uploaded.push(record);
      }

      return {
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "etag"
              ? `"etag-${uploaded.length + objectPuts.length}"`
              : null;
          },
        },
      } as Response;
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  function createQueue() {
    return createVoomUploadQueue({
      partSize: PART_SIZE,
      requestStart: async () => ({
        video: { id: "video-1" },
      }),
      requestBeginMultipart: async () => {
        multipartStarts += 1;
        return { uploadId: "upload-1" };
      },
      requestPartUrl: async (_videoId, partNumber) => ({
        uploadUrl: `https://example.test/part/${partNumber}`,
      }),
      requestPutUrl: async () => ({
        uploadUrl: "https://example.test/object",
        contentType: "video/webm",
      }),
    });
  }

  async function runQueue(blobs: Blob[]) {
    const queue = createQueue();
    await queue.begin();
    for (const blob of blobs) {
      queue.enqueue(blob);
    }
    return queue.finish();
  }

  it("uploads a 2 MiB recording with a single PutObject", async () => {
    const source = filledBlob(2 * 1024 * 1024, 11);
    const result = await runQueue([source]);

    assert.equal(result.mode, "put");
    assert.equal(multipartStarts, 0);
    assert.equal(uploaded.length, 0);
    assert.equal(objectPuts.length, 1);
    assert.equal(objectPuts[0]?.size, source.size);
    assert.deepEqual(objectPuts[0]?.bytes, await readBytes(source));
  });

  it("uploads a 7 MiB recording with a single PutObject", async () => {
    const source = filledBlob(7 * 1024 * 1024, 12);
    const result = await runQueue([source]);

    assert.equal(result.mode, "put");
    assert.equal(multipartStarts, 0);
    assert.equal(objectPuts[0]?.size, 7 * 1024 * 1024);
  });

  it("uses multipart for an exact 10 MiB recording", async () => {
    const source = filledBlob(PART_SIZE, 13);
    const result = await runQueue([source]);

    assert.equal(result.mode, "multipart");
    assert.equal(multipartStarts, 1);
    assert.equal(objectPuts.length, 0);
    assert.equal(uploaded.length, 1);
    assert.equal(uploaded[0]?.size, PART_SIZE);
    assert.deepEqual(
      result.parts.map((part) => part.partNumber),
      [1],
    );
  });

  it("uploads 15 MiB as 10 MiB + 5 MiB", async () => {
    const source = filledBlob(PART_SIZE + 5 * 1024 * 1024, 14);
    const result = await runQueue([source]);

    assert.equal(result.mode, "multipart");
    assert.deepEqual(
      uploaded.map((part) => part.size).sort((left, right) => right - left),
      [PART_SIZE, 5 * 1024 * 1024],
    );
    assert.deepEqual(
      await concatBytes(
        [...uploaded]
          .sort((left, right) => right.size - left.size)
          .map((part) => new Blob([new Uint8Array(part.bytes)])),
      ),
      await readBytes(source),
    );
  });

  it("uploads 17 MiB as 10 MiB + 7 MiB final", async () => {
    const source = filledBlob(PART_SIZE + 7 * 1024 * 1024, 15);
    const result = await runQueue([source]);

    assert.deepEqual(
      uploaded.map((part) => part.size).sort((left, right) => right - left),
      [PART_SIZE, 7 * 1024 * 1024],
    );
    assert.equal(result.parts.length, 2);
  });

  it("uploads 27 MiB as 10 + 10 + 7 MiB", async () => {
    const source = filledBlob(PART_SIZE * 2 + 7 * 1024 * 1024, 16);
    const result = await runQueue([source]);

    assert.equal(result.parts.length, 3);
    assert.deepEqual(
      uploaded.map((part) => part.size).sort((left, right) => right - left),
      [PART_SIZE, PART_SIZE, 7 * 1024 * 1024],
    );
  });

  it("keeps partNumbers stable when uploads finish out of order", async () => {
    const source = filledBlob(PART_SIZE * 2 + 50, 17);
    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const partNumber = Number(String(url).split("/").at(-1));
      if (partNumber === 1) {
        await firstReleased;
      } else {
        releaseFirst();
      }

      uploaded.push({
        partNumber,
        size: (init?.body as Blob).size,
        bytes: await readBytes(init?.body as Blob),
        url: String(url),
      });

      return {
        ok: true,
        headers: {
          get() {
            return `"etag-${partNumber}"`;
          },
        },
      } as unknown as Response;
    }) as typeof fetch;

    const result = await runQueue([source]);
    assert.deepEqual(
      result.parts.map((part) => part.partNumber),
      [1, 2, 3],
    );
    assert.equal(result.parts[0]?.etag, '"etag-1"');
  });

  it("retries a failed part without changing bytes", async () => {
    failNext = 1;
    const source = filledBlob(2048, 33);
    const result = await runQueue([source]);

    assert.equal(result.mode, "put");
    assert.equal(objectPuts.length, 1);
    assert.deepEqual(objectPuts[0]?.bytes, await readBytes(source));
  });

  it("flushes leftover bytes on STOP while a part is in flight", async () => {
    const blobs = [filledBlob(PART_SIZE, 21), filledBlob(1234, 22)];
    const queue = createQueue();
    await queue.begin();
    queue.enqueue(blobs[0]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    queue.enqueue(blobs[1]);
    const result = await queue.finish();

    assert.equal(result.mode, "multipart");
    assert.equal(result.parts.length, 2);
    assert.deepEqual(
      uploaded.map((part) => part.size).sort((left, right) => right - left),
      [PART_SIZE, 1234],
    );
  });

  it("accepts a late blob that arrives before finish flushes", async () => {
    const queue = createQueue();
    await queue.begin();
    queue.enqueue(filledBlob(1024, 1));
    queue.enqueue(filledBlob(2048, 2));
    const result = await queue.finish();

    assert.equal(result.mode, "put");
    assert.equal(objectPuts[0]?.size, 3072);
  });

  it("returns the same result for a duplicate finish call", async () => {
    const queue = createQueue();
    await queue.begin();
    queue.enqueue(filledBlob(4096, 8));
    const first = await queue.finish();
    const second = await queue.finish();

    assert.equal(first.mode, "put");
    assert.equal(second, first);
    assert.equal(objectPuts.length, 1);
  });

  it("applies backpressure when queued bytes exceed the cap", async () => {
    const events: boolean[] = [];
    const queue = createVoomUploadQueue({
      partSize: PART_SIZE,
      maxQueuedBytes: 1024,
      requestStart: async () => ({ video: { id: "video-1" } }),
      requestBeginMultipart: async () => ({ uploadId: "upload-1" }),
      requestPartUrl: async () => ({ uploadUrl: "https://example.test/part/1" }),
      requestPutUrl: async () => ({
        uploadUrl: "https://example.test/object",
        contentType: "video/webm",
      }),
      onBackpressure(active) {
        events.push(active);
      },
    });

    await queue.begin();
    queue.enqueue(filledBlob(2048, 1));
    assert.equal(events[0], true);
    await queue.finish();
    assert.equal(events.at(-1), false);
  });
});
