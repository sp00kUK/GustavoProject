import type { PatternSettings } from '../types';
import type { ProcessedPattern, RawPattern } from './types';

/**
 * ============================================================================
 * MASK CONVENTION - the single most important rule in the app
 * ============================================================================
 *
 *   WHITE (255)  ->  mask 0     ->  displacement 0        ->  radius = R
 *   BLACK (0)    ->  mask 1     ->  displacement = depth  ->  radius = R - depth
 *   50% grey     ->  mask 0.5   ->  half depth
 *
 * i.e. `mask = 1 - luminance`, so dark artwork carves inward. The Invert
 * toggle flips it, because nobody should have to go and edit their PNG just
 * because it came out of the wrong tool.
 */

export interface ProcessOptions {
  /**
   * Extra blur applied after thresholding, in source pixels. Used by the
   * binary "soft edge" treatment, where the mask stops being binary on
   * purpose.
   */
  softenPx?: number;
}

export function processPattern(
  raw: RawPattern,
  settings: PatternSettings,
  options: ProcessOptions = {},
): ProcessedPattern {
  const { width, height } = raw;
  const n = width * height;
  const softenPx = options.softenPx ?? 0;

  // 1. Normalise, compositing any transparency onto white so that a
  //    transparent pixel reads as "untouched" rather than as whatever RGB
  //    happened to be stored underneath it.
  const lum = new Float32Array(n);
  const alpha = raw.alpha;
  for (let i = 0; i < n; i++) {
    const l = raw.luminance[i] / 255;
    lum[i] = alpha ? l * (alpha[i] / 255) + (1 - alpha[i] / 255) : l;
  }

  // 2. Levels. Black/white point first (they define the working range), then
  //    brightness, contrast and finally gamma.
  applyLevels(lum, settings);

  // 3. Optional pre-blur, in source pixels.
  if (settings.blur > 0) boxBlur(lum, width, height, settings.blur);

  // 4. Polarity and mode.
  let mask = new Uint8Array(n);
  const binary = settings.mode === 'binary';

  if (binary) {
    const t = settings.threshold;
    for (let i = 0; i < n; i++) {
      const carved = settings.invert ? lum[i] >= t : lum[i] < t;
      mask[i] = carved ? 255 : 0;
    }
    if (settings.despeckle > 0) despeckle(mask, width, height, settings.despeckle);
  } else {
    const steps = settings.quantize | 0;
    for (let i = 0; i < n; i++) {
      let m = settings.invert ? lum[i] : 1 - lum[i];
      if (steps > 1) m = Math.round(m * (steps - 1)) / (steps - 1);
      mask[i] = Math.round(clamp01(m) * 255);
    }
  }

  // 5. Soft edges. Deliberately after thresholding: the shape is decided by
  //    the threshold, the softness only rounds how it meets the surface.
  let resultBinary = binary;
  if (softenPx > 0) {
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = mask[i] / 255;
    boxBlur(f, width, height, softenPx);
    for (let i = 0; i < n; i++) mask[i] = Math.round(clamp01(f[i]) * 255);
    resultBinary = false;
  }

  return {
    width,
    height,
    mask,
    binary: resultBinary,
    signature: patternSignature(raw, settings, softenPx),
  };
}

function applyLevels(lum: Float32Array, s: PatternSettings): void {
  const black = Math.min(s.blackPoint, s.whitePoint - 1e-4);
  const span = Math.max(1e-4, s.whitePoint - black);
  const contrast = 1 + s.contrast;
  const invGamma = 1 / Math.max(0.01, s.gamma);
  const needsLevels =
    black !== 0 || s.whitePoint !== 1 || s.brightness !== 0 || s.contrast !== 0;
  const needsGamma = s.gamma !== 1;
  if (!needsLevels && !needsGamma) return;

  for (let i = 0; i < lum.length; i++) {
    let v = lum[i];
    if (needsLevels) {
      v = (v - black) / span;
      v = (v - 0.5) * contrast + 0.5 + s.brightness;
    }
    v = clamp01(v);
    if (needsGamma) v = Math.pow(v, invGamma);
    lum[i] = v;
  }
}

/**
 * Separable box blur run three times, which converges on a Gaussian closely
 * enough for artwork preparation and stays O(n) regardless of radius.
 *
 * Edges wrap, because the pattern is periodic once it is tiled onto the
 * cylinder - clamping here would darken or lighten the tile seams.
 */
export function boxBlur(
  data: Float32Array,
  width: number,
  height: number,
  radiusPx: number,
): void {
  const r = Math.max(1, Math.round(radiusPx));
  if (r < 1) return;
  const tmp = new Float32Array(data.length);
  for (let pass = 0; pass < 3; pass++) {
    blurAxis(data, tmp, width, height, r, true);
    blurAxis(tmp, data, width, height, r, false);
  }
}

function blurAxis(
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number,
  r: number,
  horizontal: boolean,
): void {
  const len = horizontal ? width : height;
  const other = horizontal ? height : width;
  const window = r * 2 + 1;
  const inv = 1 / window;

  for (let o = 0; o < other; o++) {
    const at = (k: number): number => {
      const w = ((k % len) + len) % len;
      return horizontal ? src[o * width + w] : src[w * width + o];
    };
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += at(k);
    for (let k = 0; k < len; k++) {
      const idx = horizontal ? o * width + k : k * width + o;
      dst[idx] = sum * inv;
      sum += at(k + r + 1) - at(k - r);
    }
  }
}

/**
 * Remove connected runs of carved (or uncarved) pixels smaller than
 * `minArea`, which is how JPEG ringing and dithering artefacts stop turning
 * into thousands of one-pixel pits in the printed surface.
 *
 * Connectivity wraps in both axes to match how the tile repeats.
 */
export function despeckle(
  mask: Uint8Array,
  width: number,
  height: number,
  minArea: number,
): void {
  const n = width * height;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const component = new Int32Array(n);

  for (let start = 0; start < n; start++) {
    if (seen[start]) continue;
    const value = mask[start];
    let top = 0;
    let count = 0;
    stack[top++] = start;
    seen[start] = 1;

    while (top > 0) {
      const p = stack[--top];
      component[count++] = p;
      const x = p % width;
      const y = (p / width) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = (x + (k === 0 ? 1 : k === 1 ? -1 : 0) + width) % width;
        const ny = (y + (k === 2 ? 1 : k === 3 ? -1 : 0) + height) % height;
        const q = ny * width + nx;
        if (seen[q] || mask[q] !== value) continue;
        seen[q] = 1;
        stack[top++] = q;
      }
    }

    if (count < minArea) {
      const flipped = value === 0 ? 255 : 0;
      for (let k = 0; k < count; k++) mask[component[k]] = flipped;
    }
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Identifies everything that affects the processed mask, and nothing that
 * does not. Changing relief depth or mesh detail leaves this untouched, so
 * those adjustments reuse the cached mask instead of reprocessing the image.
 */
export function patternSignature(
  raw: RawPattern,
  s: PatternSettings,
  softenPx: number,
): string {
  return [
    raw.id,
    s.mode,
    s.invert ? 1 : 0,
    s.threshold,
    s.despeckle,
    s.brightness,
    s.contrast,
    s.gamma,
    s.blackPoint,
    s.whitePoint,
    s.blur,
    s.quantize,
    softenPx.toFixed(3),
  ].join('|');
}

/** Build a RawPattern from RGBA bytes (canvas, ImageData, decoded file). */
export function rawFromRGBA(
  id: string,
  name: string,
  kind: RawPattern['kind'],
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  originalWidth = width,
  originalHeight = height,
): RawPattern {
  const n = width * height;
  const luminance = new Uint8Array(n);
  let hasAlpha = false;
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    // Rec.709 luma on normalised sRGB values, matching what a human reads as
    // "how dark is this pixel".
    luminance[i] = Math.round(
      0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2],
    );
    alpha[i] = rgba[o + 3];
    if (rgba[o + 3] !== 255) hasAlpha = true;
  }
  return {
    id,
    name,
    kind,
    width,
    height,
    luminance,
    alpha: hasAlpha ? alpha : null,
    originalWidth,
    originalHeight,
  };
}
