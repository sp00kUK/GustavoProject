/**
 * Minimal ZIP writer, just enough for OPC packages such as 3MF.
 *
 * Written by hand rather than pulled in as a dependency: a 3MF needs exactly
 * three stored-or-deflated entries and no ZIP64, no encryption, no multi-disk
 * support. Deflate comes from the platform's CompressionStream where it
 * exists, and falls back to stored entries where it does not - both are legal
 * per the ZIP appnote and both are read by every slicer.
 */

/**
 * TypeScript distinguishes buffers that might be shared from ones that cannot,
 * and `BlobPart` only accepts the latter. Everything this writer handles is
 * plain, so pin it once here rather than casting at every call site.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(chunks: Bytes[], seed = 0): number {
  let c = ~seed >>> 0;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      c = CRC_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
    }
  }
  return ~c >>> 0;
}

export interface ZipEntry {
  name: string;
  chunks: Bytes[];
  /** Deflate when the platform supports it. Defaults to true. */
  compress?: boolean;
}

const MAX_ZIP_BYTES = 0xffffffff;

export async function createZip(entries: ZipEntry[]): Promise<Blob> {
  const parts: BlobPart[] = [];
  const central: Bytes[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const uncompressedSize = entry.chunks.reduce((n, c) => n + c.length, 0);
    const crc = crc32(entry.chunks);

    let method = 0;
    let payload: Bytes[] = entry.chunks;
    if (entry.compress !== false && typeof CompressionStream !== 'undefined') {
      try {
        payload = [await deflateRaw(entry.chunks)];
        method = 8;
      } catch {
        payload = entry.chunks;
        method = 0;
      }
    }
    const compressedSize = payload.reduce((n, c) => n + c.length, 0);

    if (offset + compressedSize > MAX_ZIP_BYTES) {
      throw new Error(
        'This model is too large for a 3MF package (4 GB limit). Export as STL, ' +
          'or reduce the export mesh detail.',
      );
    }

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0x0021, true); // mod date (1980-01-01)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressedSize, true);
    lv.setUint32(22, uncompressedSize, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    parts.push(local, ...payload);

    const dir = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true); // central directory header
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, method, true);
    dv.setUint16(12, 0, true);
    dv.setUint16(14, 0x0021, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, compressedSize, true);
    dv.setUint32(24, uncompressedSize, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint32(42, offset, true);
    dir.set(nameBytes, 46);
    central.push(dir);

    offset += local.length + compressedSize;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central directory
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

async function deflateRaw(chunks: Bytes[]): Promise<Bytes> {
  const stream = new Blob(chunks)
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
