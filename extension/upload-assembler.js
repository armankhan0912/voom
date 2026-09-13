const UPLOAD_PART_SIZE = 10 * 1024 * 1024;
const MIN_MULTIPART_PART_SIZE = 5 * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = 2;
const MAX_QUEUED_BYTES = 32 * 1024 * 1024;
const VOOM_MULTIPART_PART_SIZE = UPLOAD_PART_SIZE;

function createPartAssembler(partSize) {
  const size = partSize ?? UPLOAD_PART_SIZE;
  /** @type {{ blob: Blob, offset: number }[]} */
  let pieces = [];
  let pendingBytes = 0;

  function available(piece) {
    return piece.blob.size - piece.offset;
  }

  function cut(byteCount) {
    if (byteCount <= 0 || byteCount > pendingBytes) {
      throw new Error("Invalid assembler cut");
    }

    const slices = [];
    let remaining = byteCount;

    while (remaining > 0) {
      const piece = pieces[0];
      const take = available(piece);

      if (take <= remaining) {
        slices.push(piece.blob.slice(piece.offset));
        remaining -= take;
        pieces.shift();
      } else {
        slices.push(piece.blob.slice(piece.offset, piece.offset + remaining));
        piece.offset += remaining;
        remaining = 0;
      }
    }

    pendingBytes -= byteCount;
    return new Blob(slices, { type: "application/octet-stream" });
  }

  function takeCompleteParts() {
    const parts = [];
    while (pendingBytes >= size) {
      parts.push(cut(size));
    }
    return parts;
  }

  function push(blob) {
    if (!blob || blob.size <= 0) {
      return [];
    }

    pieces.push({ blob, offset: 0 });
    pendingBytes += blob.size;
    return takeCompleteParts();
  }

  function flush() {
    if (pendingBytes === 0) {
      return null;
    }

    return cut(pendingBytes);
  }

  function getPendingBytes() {
    return pendingBytes;
  }

  return {
    push,
    flush,
    getPendingBytes,
    partSize: size,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    UPLOAD_PART_SIZE,
    MIN_MULTIPART_PART_SIZE,
    MAX_CONCURRENT_UPLOADS,
    MAX_QUEUED_BYTES,
    VOOM_MULTIPART_PART_SIZE,
    createPartAssembler,
  };
}
