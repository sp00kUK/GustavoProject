import type { QualityPreset } from '../types';
import {
  MAX_SEGMENTS_PER_AXIS,
  MIN_RADIAL_SEGMENTS,
  MIN_VERTICAL_SEGMENTS,
} from './constants';

/**
 * Quality is expressed as a *physical* surface sample spacing, not as a
 * segment count. A 20 mm roller and a 200 mm roller need very different
 * segment counts to look equally smooth, and "0.25 mm sampling" is something
 * a 3D-printing user can reason about, whereas "2048 radial segments" is not.
 */
export const QUALITY_SPACING_MM: Record<Exclude<QualityPreset, 'custom'>, number> = {
  draft: 1.0,
  standard: 0.5,
  high: 0.25,
  ultra: 0.15,
};

export const QUALITY_LABELS: Record<QualityPreset, string> = {
  draft: 'Draft',
  standard: 'Standard',
  high: 'High',
  ultra: 'Ultra',
  custom: 'Custom',
};

export function spacingForPreset(preset: QualityPreset, customSpacing: number): number {
  if (preset === 'custom') return Math.max(0.01, customSpacing);
  return QUALITY_SPACING_MM[preset];
}

export interface Resolution {
  radialSegments: number;
  verticalSegments: number;
  /** Spacing actually achieved, after clamping. */
  spacingMm: number;
  /** True when clamping changed the requested spacing. */
  clamped: boolean;
}

export function resolveResolution(
  diameter: number,
  height: number,
  spacingMm: number,
): Resolution {
  const circumference = Math.PI * diameter;
  const rawRadial = Math.ceil(circumference / spacingMm);
  const rawVertical = Math.ceil(height / spacingMm);

  const radialSegments = clamp(rawRadial, MIN_RADIAL_SEGMENTS, MAX_SEGMENTS_PER_AXIS);
  const verticalSegments = clamp(rawVertical, MIN_VERTICAL_SEGMENTS, MAX_SEGMENTS_PER_AXIS);

  const achieved = Math.max(circumference / radialSegments, height / verticalSegments);

  return {
    radialSegments,
    verticalSegments,
    spacingMm: achieved,
    clamped: radialSegments !== rawRadial || verticalSegments !== rawVertical,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * The finest physical feature the source artwork actually contains, in mm.
 *
 * One source pixel maps to (tile size / tile pixels) millimetres. Sampling
 * coarser than that throws detail away; the UI turns this into the "pattern
 * contains finer detail than the current mesh" warning rather than silently
 * losing it.
 */
export function sourceDetailSpacing(
  circumference: number,
  usableHeight: number,
  columns: number,
  rows: number,
  patternWidth: number,
  patternHeight: number,
): number {
  const mmPerPxU = circumference / Math.max(1, columns) / Math.max(1, patternWidth);
  const mmPerPxV = usableHeight / Math.max(1, rows) / Math.max(1, patternHeight);
  return Math.min(mmPerPxU, mmPerPxV);
}

/** Estimated triangle count, used for the large-export warning. */
export function estimateTriangles(
  radialSegments: number,
  verticalSegments: number,
  mode: 'binary' | 'grayscale',
  carvedFraction = 0.35,
): number {
  const capsAndBore = radialSegments * 8;
  if (mode === 'grayscale') {
    return radialSegments * verticalSegments * 2 + capsAndBore;
  }
  // Binary merges vertically, so the barrel cost scales with how often the
  // pattern changes state going up a column, not with the cell count.
  const transitions = Math.max(1, verticalSegments * carvedFraction * 0.5);
  const barrel = radialSegments * (transitions + 1) * 2;
  const walls = radialSegments * transitions * 4;
  return Math.round(barrel + walls + capsAndBore);
}

/** Binary STL is a fixed 84 byte header plus 50 bytes per facet. */
export function estimateStlBytes(triangleCount: number): number {
  return 84 + triangleCount * 50;
}
