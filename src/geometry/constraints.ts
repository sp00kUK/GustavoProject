import type { CylinderSettings, ReliefSettings, ValidationIssue } from '../types';
import { ABSOLUTE_MIN_WALL, DEFAULT_MIN_WALL_WARNING } from './constants';

export interface DimensionSummary {
  radius: number;
  boreRadius: number;
  circumference: number;
  /** Smallest outer radius the relief can reach. */
  minOuterRadius: number;
  /** Largest outer radius the relief can reach. */
  maxOuterRadius: number;
  /** Material left between the deepest carve and the bore (or the axis). */
  minWall: number;
  usableHeight: number;
}

export function summarise(
  cylinder: CylinderSettings,
  relief: ReliefSettings,
): DimensionSummary {
  const radius = cylinder.diameter / 2;
  const boreRadius = cylinder.boreEnabled ? cylinder.boreDiameter / 2 : 0;
  const deboss = relief.direction === 'deboss';

  const minOuterRadius = deboss ? radius - relief.depth : radius;
  const maxOuterRadius = deboss ? radius : radius + relief.depth;

  return {
    radius,
    boreRadius,
    circumference: Math.PI * cylinder.diameter,
    minOuterRadius,
    maxOuterRadius,
    minWall: minOuterRadius - boreRadius,
    usableHeight: Math.max(
      0,
      cylinder.height - relief.topMargin - relief.bottomMargin,
    ),
  };
}

/**
 * Largest carving depth that still leaves `minWallTarget` of material.
 *
 * Emboss adds material outward, so it never eats into the wall; only deboss
 * is bounded.
 */
export function maxSafeDepth(
  cylinder: CylinderSettings,
  direction: 'deboss' | 'emboss',
  minWallTarget = DEFAULT_MIN_WALL_WARNING,
): number {
  if (direction === 'emboss') return Infinity;
  const radius = cylinder.diameter / 2;
  const boreRadius = cylinder.boreEnabled ? cylinder.boreDiameter / 2 : 0;
  return Math.max(0, radius - boreRadius - minWallTarget);
}

export interface SettingsValidation {
  issues: ValidationIssue[];
  /** True when nothing blocks generation. */
  canGenerate: boolean;
  summary: DimensionSummary;
}

/**
 * Guard the geometry kernel from impossible input, and explain the problem in
 * terms of the physical part rather than in terms of the maths.
 */
export function validateSettings(
  cylinder: CylinderSettings,
  relief: ReliefSettings,
  minWallWarning = DEFAULT_MIN_WALL_WARNING,
): SettingsValidation {
  const issues: ValidationIssue[] = [];
  const summary = summarise(cylinder, relief);

  const push = (
    severity: ValidationIssue['severity'],
    code: string,
    message: string,
    detail?: Record<string, number | string>,
  ) => issues.push({ severity, code, message, detail });

  if (!(cylinder.diameter > 0)) {
    push('error', 'BAD_DIAMETER', 'Diameter must be greater than 0 mm.');
  }
  if (!(cylinder.height > 0)) {
    push('error', 'BAD_HEIGHT', 'Height must be greater than 0 mm.');
  }
  if (!(relief.depth >= 0)) {
    push('error', 'BAD_DEPTH', 'Relief depth cannot be negative.');
  }
  if (cylinder.boreEnabled) {
    if (!(cylinder.boreDiameter > 0)) {
      push('error', 'BAD_BORE', 'Bore diameter must be greater than 0 mm.');
    } else if (cylinder.boreDiameter >= cylinder.diameter) {
      push(
        'error',
        'BORE_TOO_LARGE',
        `A ${fmt(cylinder.boreDiameter)} mm bore does not fit inside a ` +
          `${fmt(cylinder.diameter)} mm cylinder.`,
        { bore: cylinder.boreDiameter, diameter: cylinder.diameter },
      );
    }
  }
  if (relief.topMargin + relief.bottomMargin >= cylinder.height) {
    push(
      'error',
      'MARGINS_TOO_LARGE',
      `Top and bottom margins (${fmt(relief.topMargin + relief.bottomMargin)} mm) ` +
        `leave no room on a ${fmt(cylinder.height)} mm tall roller.`,
      { margins: relief.topMargin + relief.bottomMargin, height: cylinder.height },
    );
  }

  // The one that actually matters in practice: carving through into the bore.
  if (relief.direction === 'deboss' && issues.length === 0) {
    const safe = maxSafeDepth(cylinder, 'deboss', minWallWarning);
    const hardLimit = maxSafeDepth(cylinder, 'deboss', ABSOLUTE_MIN_WALL);

    if (summary.minWall <= ABSOLUTE_MIN_WALL) {
      const what = cylinder.boreEnabled ? 'axle bore' : 'centre of the roller';
      push(
        'error',
        'DEPTH_BREACHES_BORE',
        `The current carving depth reaches the ${what}.\n\n` +
          `Maximum safe depth for these dimensions is ${fmt(safe)} mm.\n` +
          `Reduce the carving depth or decrease the bore diameter.`,
        {
          maxSafeDepth: safe,
          hardLimit,
          // Lets the UI pick the right wording without re-deriving it.
          target: cylinder.boreEnabled ? 'bore' : 'centre',
        },
      );
    } else if (summary.minWall < minWallWarning) {
      push(
        'warning',
        'THIN_WALL',
        `Pattern depth leaves only ${fmt(summary.minWall)} mm of wall thickness ` +
          `(recommended minimum ${fmt(minWallWarning)} mm).`,
        { minWall: summary.minWall, maxSafeDepth: safe, recommended: minWallWarning },
      );
    }
  }

  return { issues, canGenerate: issues.every((i) => i.severity !== 'error'), summary };
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2).replace(/\.00$/, '') : '-';
}
