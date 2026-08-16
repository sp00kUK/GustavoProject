import type { RawPattern } from './types';

export interface SeamReport {
  /** 0 = tiles cleanly left-to-right, 1 = obvious repeating seam. */
  horizontal: number;
  /** 0 = tiles cleanly top-to-bottom. */
  vertical: number;
}

/**
 * Estimate whether artwork actually tiles.
 *
 * The app guarantees that the *mesh* wraps: the topology closes at 0/360 by
 * index, so there is never a crack. What it cannot do is make a picture
 * seamless. A photo of bricks still shows a visible repeat every tile, and
 * users need to be told that rather than discovering it after a six hour print.
 *
 * Naively comparing the two edge pixels flags every hard-edged pattern - a
 * checkerboard is perfectly tileable yet its edge columns are opposites. So
 * the wrap-around difference is judged against the sharpest edge already
 * present inside the image: a seam only counts as a seam if it is a bigger
 * discontinuity than anything the artwork itself contains.
 */
export function analyseSeams(raw: RawPattern): SeamReport {
  return {
    horizontal: axisScore(raw, true),
    vertical: axisScore(raw, false),
  };
}

function axisScore(raw: RawPattern, horizontal: boolean): number {
  const { width, height, luminance } = raw;
  const span = horizontal ? width : height;
  const across = horizontal ? height : width;
  if (span < 2 || across < 1) return 0;

  const at = (i: number, k: number): number =>
    horizontal ? luminance[k * width + i] : luminance[i * width + k];

  let maxInterior = 0;
  for (let i = 0; i < span - 1; i++) {
    let sum = 0;
    for (let k = 0; k < across; k++) sum += Math.abs(at(i, k) - at(i + 1, k));
    const mean = sum / across;
    if (mean > maxInterior) maxInterior = mean;
  }

  let wrapSum = 0;
  for (let k = 0; k < across; k++) wrapSum += Math.abs(at(span - 1, k) - at(0, k));
  const wrap = wrapSum / across;

  return Math.max(0, Math.min(1, (wrap - maxInterior) / 255));
}
