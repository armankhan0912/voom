export const UPLOAD_PART_SIZE = 10 * 1024 * 1024;
export const MIN_MULTIPART_PART_SIZE = 5 * 1024 * 1024;
export const MAX_CONCURRENT_UPLOADS = 2;
export const MAX_QUEUED_BYTES = 32 * 1024 * 1024;
export const VOOM_MULTIPART_PART_SIZE = UPLOAD_PART_SIZE;

type Piece = {
  blob: Blob;
  offset: number;
};

export type PartAssembler = {
  push: (blob: Blob | null | undefined) => Blob[];
  flush: () => Blob | null;
  getPendingBytes: () => number;
  partSize: number;
};

export function createPartAssembler(partSize?: number): PartAssembler {
  const size = partSize ?? UPLOAD_PART_SIZE;
  let pieces: Piece[] = [];
  let pendingBytes = 0;

  function available(piece: Piece) {
    return piece.blob.size - piece.offset;
  }

  function cut(byteCount: number) {
    if (byteCount <= 0 || byteCount > pendingBytes) {
      throw new Error("Invalid assembler cut");
    }

    const slices: Blob[] = [];
    let remaining = byteCount;

    while (remaining > 0) {
      const piece = pieces[0];
      if (!piece) {
        throw new Error("Invalid assembler cut");
      }
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
    const parts: Blob[] = [];
    while (pendingBytes >= size) {
      parts.push(cut(size));
    }
    return parts;
  }

  function push(blob: Blob | null | undefined) {
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
