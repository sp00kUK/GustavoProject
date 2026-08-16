import { rawFromRGBA } from './process';
import type { RawPattern } from './types';

/**
 * Browser-side artwork loading. Everything here needs a DOM, which is why it
 * is isolated from the pattern engine proper - the sampler, the processor and
 * the geometry kernel all run happily in a worker or in Node.
 */

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

/**
 * Largest source dimension kept in memory. A 12000 x 12000 PNG is 576 MB as
 * RGBA; downsampling to 2048 keeps the finest detail any realistic roller can
 * reproduce (a 2048 px tile on a 157 mm circumference is 0.077 mm per pixel)
 * while staying well inside a browser tab's budget.
 */
export const MAX_SOURCE_DIMENSION = 2048;

export interface LoadResult {
  pattern: RawPattern;
  /** Set when the source was larger than MAX_SOURCE_DIMENSION. */
  downsampledFrom?: { width: number; height: number };
}

export async function loadPatternFile(
  file: File,
  svgResolution = MAX_SOURCE_DIMENSION,
): Promise<LoadResult> {
  const name = file.name;
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(name);
  if (isSvg) return loadSvg(file, svgResolution);
  return loadRaster(file);
}

/* -------------------------------------------------------------------- *
 * Raster
 * -------------------------------------------------------------------- */

async function loadRaster(file: File): Promise<LoadResult> {
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const bitmap = await decodeBitmap(file);
  try {
    const { width, height, scaled } = fitWithin(bitmap.width, bitmap.height);
    const rgba = drawToRGBA(bitmap, width, height, scaled);
    return {
      pattern: {
        ...rawFromRGBA(
          `file:${file.name}:${file.size}:${file.lastModified}`,
          file.name,
          'raster',
          rgba,
          width,
          height,
          bitmap.width,
          bitmap.height,
        ),
        sourceBytes,
        sourceMimeType: normaliseRasterMimeType(file),
      },
      ...(scaled ? { downsampledFrom: { width: bitmap.width, height: bitmap.height } } : {}),
    };
  } finally {
    bitmap.close?.();
  }
}

async function decodeBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error('DECODE_FAILED');
  }
}

/* -------------------------------------------------------------------- *
 * SVG
 * -------------------------------------------------------------------- */

/**
 * SVG is rasterised through an `<img>` with a blob URL, never by injecting the
 * markup into the document.
 *
 * That distinction is the whole security story for this feature: an SVG loaded
 * as an image is rendered in a context where scripts, external fetches and
 * foreignObject cannot execute, so hostile artwork cannot reach the page. The
 * markup is additionally scanned first and rejected outright if it carries
 * script or external references, so a malformed file fails loudly instead of
 * silently rendering as a blank tile.
 */
async function loadSvg(file: File, resolution: number): Promise<LoadResult> {
  const text = await file.text();
  assertSafeSvg(text);

  const size = Math.min(MAX_SOURCE_DIMENSION, Math.max(64, Math.round(resolution)));
  const blob = new Blob([text], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImage(url);
    const aspect =
      image.naturalWidth > 0 && image.naturalHeight > 0
        ? image.naturalWidth / image.naturalHeight
        : 1;
    const width = aspect >= 1 ? size : Math.max(1, Math.round(size * aspect));
    const height = aspect >= 1 ? Math.max(1, Math.round(size / aspect)) : size;

    const canvas = makeCanvas(width, height);
    const ctx = get2d(canvas);
    // Transparent SVG areas must read as untouched surface, so paint white
    // underneath rather than letting alpha-zero black pixels through.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const rgba = ctx.getImageData(0, 0, width, height).data;
    return {
      pattern: {
        ...rawFromRGBA(
          `svg:${file.name}:${file.size}:${file.lastModified}:${size}`,
          file.name,
          'svg',
          rgba,
          width,
          height,
        ),
        sourceBytes: new TextEncoder().encode(text),
        sourceMimeType: 'image/svg+xml',
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'SVG_UNSAFE') throw error;
    throw new Error('SVG_FAILED');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Reject SVGs carrying script or external references before rendering them. */
function assertSafeSvg(text: string): void {
  const lowered = text.toLowerCase();
  const forbidden = [
    '<script',
    'javascript:',
    ' onload=',
    ' onerror=',
    ' onclick=',
    '<foreignobject',
    '<iframe',
    '<use xlink:href="http',
    '<image xlink:href="http',
  ];
  if (forbidden.some((needle) => lowered.includes(needle))) {
    throw new Error('SVG_UNSAFE');
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'sync';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('SVG_FAILED'));
    image.src = url;
  });
}

/* -------------------------------------------------------------------- *
 * Shared canvas helpers
 * -------------------------------------------------------------------- */

function fitWithin(
  width: number,
  height: number,
): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(width, height);
  if (longest <= MAX_SOURCE_DIMENSION) return { width, height, scaled: false };
  const factor = MAX_SOURCE_DIMENSION / longest;
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
    scaled: true,
  };
}

function drawToRGBA(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  downsampled: boolean,
): Uint8ClampedArray {
  const canvas = makeCanvas(width, height);
  const ctx = get2d(canvas);
  // Area-style smoothing preserves grayscale gradients when shrinking; for a
  // 1:1 draw it makes no difference and line art stays crisp either way.
  ctx.imageSmoothingEnabled = downsampled;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

function makeCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function get2d(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('DECODE_FAILED');
  return ctx;
}

export function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

function normaliseRasterMimeType(file: File): string {
  if (file.type === 'image/jpg') return 'image/jpeg';
  if (ACCEPTED_TYPES.includes(file.type) && file.type !== 'image/svg+xml') return file.type;
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  return 'image/png';
}
