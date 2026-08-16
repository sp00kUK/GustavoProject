import type { PatternSampler, ReliefDirection } from '../../types';
import { GEOMETRY_EPSILON } from '../constants';

export interface ReliefFieldParams {
  height: number;
  bottomMargin: number;
  topMargin: number;
  sampler: PatternSampler;
}

/**
 * Turns the abstract pattern sampler into "carve mask at a physical height".
 *
 * Two things happen here and nowhere else:
 *
 * 1. Margins. Bands of `bottomMargin` / `topMargin` millimetres at each end
 *    are forced to mask 0, so the roller keeps a clean untouched rim.
 *
 * 2. Band remapping. The pattern's vertical parameter is stretched across the
 *    *usable* band between the margins, not across the whole part. That means
 *    "rows = 8" always gives eight whole tiles you can see, instead of eight
 *    tiles with the first and last partly hidden under the margins. With the
 *    default 0 mm margins this is the identity mapping.
 */
export class ReliefField {
  readonly usableBottom: number;
  readonly usableTop: number;
  readonly usableHeight: number;
  private readonly sampler: PatternSampler;

  constructor(params: ReliefFieldParams) {
    const { height, bottomMargin, topMargin, sampler } = params;
    const yBottom = -height / 2;
    const yTop = height / 2;
    this.usableBottom = yBottom + bottomMargin;
    this.usableTop = yTop - topMargin;
    this.usableHeight = Math.max(this.usableTop - this.usableBottom, GEOMETRY_EPSILON);
    this.sampler = sampler;
  }

  /** Carve mask in [0, 1] at circumferential parameter u and world height y. */
  maskAt(u: number, y: number): number {
    if (y < this.usableBottom - GEOMETRY_EPSILON) return 0;
    if (y > this.usableTop + GEOMETRY_EPSILON) return 0;
    const v = (y - this.usableBottom) / this.usableHeight;
    const clamped = v < 0 ? 0 : v > 1 ? 1 : v;
    const atTopEdge = clamped >= 1 - GEOMETRY_EPSILON;
    const m = this.sampler.sample(u, clamped, atTopEdge);
    return m < 0 ? 0 : m > 1 ? 1 : m;
  }
}

/** Radius for a given mask value. Deboss carves inward, emboss raises outward. */
export function radiusForMask(
  baseRadius: number,
  depth: number,
  direction: ReliefDirection,
  mask: number,
): number {
  return direction === 'emboss' ? baseRadius + depth * mask : baseRadius - depth * mask;
}
