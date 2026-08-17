import type { PatternSampler, PatternSettings } from '../types';
import type { ProcessedPattern } from './types';

/**
 * ============================================================================
 * UV TRANSFORMATION ORDER - fixed, documented, never reordered
 * ============================================================================
 *
 *   1. cylinder UV        u around the circumference, v up the usable height
 *   2. repetition         tu = u * columns,  tv = v * rows
 *   3. stagger            odd (or every) tile row shifted along tu
 *   4. tile-local         pu = frac(tu), pv = frac(tv)
 *   5. scale              about the tile centre
 *   6. rotation           about the tile centre
 *   7. offset             translation within the tile
 *   8. mirror             per axis, about the tile centre
 *   9. tile fit           stretch / fit / fill of the source into the tile
 *  10. sample             nearest (binary) or bilinear (grayscale), wrapping
 *
 * Polarity, thresholding and levels are already baked into the mask by
 * `processPattern`, which is what makes step 10 cheap and, for binary mode,
 * genuinely hard-edged: interpolating a binary mask would soften every cavity
 * wall, which is exactly the "melted displacement map" look this app exists
 * to avoid.
 *
 * The order is fixed so that adjusting rotation never silently changes what
 * offset means. Two users with the same numbers get the same geometry.
 */

export interface SamplerOptions {
  /** Physical tile size in mm, needed for `tileFit` and for aspect handling. */
  tileWidthMm: number;
  tileHeightMm: number;
}

const EPS = 1e-9;

export function createPatternSampler(
  processed: ProcessedPattern,
  settings: PatternSettings,
  options: SamplerOptions,
): PatternSampler {
  return createRowPatternSampler(
    new Map([['primary', processed]]),
    'primary',
    settings,
    options,
  );
}

/**
 * Build one cylindrical sampler whose source can change at exact tile-row
 * boundaries. Transform, stagger and seam semantics remain identical to the
 * single-artwork sampler; only the source mask selected for a row changes.
 */
export function createRowPatternSampler(
  processedById: ReadonlyMap<string, ProcessedPattern>,
  primaryId: string,
  settings: PatternSettings,
  options: SamplerOptions,
): PatternSampler {
  const columns = Math.max(1, settings.columns);
  const rows = Math.max(1, settings.rows);

  const tileAspect =
    options.tileHeightMm > 0 ? options.tileWidthMm / options.tileHeightMm : 1;
  const sources = new Map<string, PreparedSource>();
  for (const [id, processed] of processedById) {
    sources.set(id, prepareSource(processed, settings.tileFit, tileAspect));
  }
  const primary = sources.get(primaryId) ?? sources.values().next().value;
  if (!primary) return { sample: () => 0 };

  const clipOutsideTile = settings.tileFit === 'fit';
  const staggerActive = settings.staggerMode !== 'none' && settings.stagger !== 0;

  return {
    sample(u: number, v: number, atTopEdge?: boolean): number {
      // 2. repetition
      let tu = u * columns;
      const tv = v * rows;

      const rowIndex = Math.max(
        0,
        Math.min(rows - 1, Math.floor(tv - (atTopEdge ? EPS : 0))),
      );
      const requestedId = settings.rowPatternIds?.[rowIndex];
      const source =
        sources.get(`row_${rowIndex}`) ??
        (requestedId ? sources.get(requestedId) : undefined) ??
        primary;

      const rowAdj = settings.rowAdjustments?.[rowIndex];

      // Per-row transforms
      const rowRotDeg = rowAdj?.rotation !== undefined ? rowAdj.rotation : settings.rotation;
      const rowRot = (rowRotDeg * Math.PI) / 180;
      const rowCosR = rowRot !== 0 ? Math.cos(rowRot) : 1;
      const rowSinR = rowRot !== 0 ? Math.sin(rowRot) : 0;

      const rowScaleX = rowAdj?.scaleX !== undefined ? rowAdj.scaleX : settings.scaleX;
      const rowScaleY = rowAdj?.scaleY !== undefined ? rowAdj.scaleY : settings.scaleY;
      const rowSx = rowScaleX === 0 ? EPS : rowScaleX;
      const rowSy = rowScaleY === 0 ? EPS : rowScaleY;

      const rowOffsetX = rowAdj?.offsetX !== undefined ? rowAdj.offsetX : settings.offsetX;
      const rowOffsetY = rowAdj?.offsetY !== undefined ? rowAdj.offsetY : settings.offsetY;

      const rowMirrorX = rowAdj?.mirrorX !== undefined ? rowAdj.mirrorX : settings.mirrorX;
      const rowMirrorY = rowAdj?.mirrorY !== undefined ? rowAdj.mirrorY : settings.mirrorY;

      // 3. stagger - applied on whole tile rows, so brickwork stays periodic
      if (staggerActive) {
        const k = settings.staggerMode === 'alternate' ? rowIndex & 1 : rowIndex;
        tu += settings.stagger * k;
      }

      // 4. tile-local
      let pu = tu - Math.floor(tu);
      let pv = atTopEdge ? 1 : tv - Math.floor(tv);

      // 5-8. tile-local transforms about the centre.
      let cu = pu - 0.5;
      let cv = pv - 0.5;

      cu /= rowSx;
      cv /= rowSy;

      if (rowRot !== 0) {
        const ru = cu * rowCosR - cv * rowSinR;
        const rv = cu * rowSinR + cv * rowCosR;
        cu = ru;
        cv = rv;
      }

      cu += rowOffsetX;
      cv += rowOffsetY;

      if (rowMirrorX) cu = -cu;
      if (rowMirrorY) cv = -cv;

      // 9. tile fit
      cu /= source.fx;
      cv /= source.fy;

      pu = cu + 0.5;
      pv = cv + 0.5;

      if (clipOutsideTile && (pu < 0 || pu > 1 || pv < 0 || pv > 1)) return 0;

      // 10. sample
      return source.sample(
        source.processed.mask,
        source.processed.width,
        source.processed.height,
        pu,
        pv,
        atTopEdge === true,
      );
    },
  };
}

interface PreparedSource {
  processed: ProcessedPattern;
  fx: number;
  fy: number;
  sample: typeof sampleNearest;
}

function prepareSource(
  processed: ProcessedPattern,
  tileFit: PatternSettings['tileFit'],
  tileAspect: number,
): PreparedSource {
  const imgAspect = processed.width / processed.height;
  let fx = 1;
  let fy = 1;
  if (tileFit === 'fit') {
    if (imgAspect > tileAspect) fy = tileAspect / imgAspect;
    else fx = imgAspect / tileAspect;
  } else if (tileFit === 'fill') {
    if (imgAspect > tileAspect) fx = imgAspect / tileAspect;
    else fy = tileAspect / imgAspect;
  }
  return {
    processed,
    fx,
    fy,
    sample: processed.binary ? sampleNearest : sampleBilinear,
  };
}

/** Sample an already-processed image in square UV space. */
export function sampleProcessedPattern(
  processed: ProcessedPattern,
  u: number,
  v: number,
  clampV = true,
): number {
  const sample = processed.binary ? sampleNearest : sampleBilinear;
  return sample(processed.mask, processed.width, processed.height, u, v, clampV);
}

/**
 * Nearest-neighbour with wrap.
 *
 * Wrapping - rather than clamping - is essential: sampling just left of pixel
 * 0 must return the right-hand edge of the artwork, otherwise the pattern
 * smears at every tile boundary and at the cylinder's 0/360 seam.
 */
function sampleNearest(
  mask: Uint8Array,
  width: number,
  height: number,
  u: number,
  v: number,
  clampV: boolean,
): number {
  const x = wrapIndex(Math.floor(u * width), width);
  const y = clampV
    ? clampIndex(Math.floor(v * height), height)
    : wrapIndex(Math.floor(v * height), height);
  return mask[y * width + x] / 255;
}

/** Bilinear with wrap on both axes (vertical wrap optional). */
function sampleBilinear(
  mask: Uint8Array,
  width: number,
  height: number,
  u: number,
  v: number,
  clampV: boolean,
): number {
  const fx = u * width - 0.5;
  const fy = v * height - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;

  const wrapY = clampV ? clampIndex : wrapIndex;
  const xa = wrapIndex(x0, width);
  const xb = wrapIndex(x0 + 1, width);
  const ya = wrapY(y0, height);
  const yb = wrapY(y0 + 1, height);

  const p00 = mask[ya * width + xa];
  const p10 = mask[ya * width + xb];
  const p01 = mask[yb * width + xa];
  const p11 = mask[yb * width + xb];

  const top = p00 + (p10 - p00) * tx;
  const bottom = p01 + (p11 - p01) * tx;
  return (top + (bottom - top) * ty) / 255;
}

function wrapIndex(i: number, n: number): number {
  const m = i % n;
  return m < 0 ? m + n : m;
}

function clampIndex(i: number, n: number): number {
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}

/** Physical size of one repeat tile, in mm. */
export function tileSizeMm(
  circumference: number,
  usableHeight: number,
  columns: number,
  rows: number,
): { width: number; height: number } {
  return {
    width: circumference / Math.max(1, columns),
    height: usableHeight / Math.max(1, rows),
  };
}
