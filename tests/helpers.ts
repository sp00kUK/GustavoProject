import { generateCylinderRelief } from '../src/geometry/generateCylinderRelief';
import { resolveResolution, spacingForPreset } from '../src/geometry/quality';
import type {
  CylinderSettings,
  PatternMode,
  PatternSampler,
  QualityPreset,
  ReliefSettings,
} from '../src/types';

export const CYLINDER: CylinderSettings = {
  diameter: 50,
  height: 100,
  boreEnabled: true,
  boreDiameter: 8,
};

export const RELIEF: ReliefSettings = {
  depth: 2,
  direction: 'deboss',
  edgeTreatment: 'sharp',
  edgeSoftness: 0,
  bottomMargin: 0,
  topMargin: 0,
};

export function build(
  sampler: PatternSampler,
  mode: PatternMode = 'binary',
  overrides: {
    cylinder?: Partial<CylinderSettings>;
    relief?: Partial<ReliefSettings>;
    quality?: QualityPreset;
  } = {},
) {
  const cylinder = { ...CYLINDER, ...overrides.cylinder };
  const relief = { ...RELIEF, ...overrides.relief };
  const spacing = spacingForPreset(overrides.quality ?? 'draft', 0.5);
  return generateCylinderRelief({
    cylinder,
    relief,
    mode,
    patternSampler: sampler,
    resolution: resolveResolution(cylinder.diameter, cylinder.height, spacing),
  });
}

/** Every acceptance criterion for "this is a printable solid", in one place. */
export function expectWatertight(result: ReturnType<typeof build>): void {
  const v = result.validation;
  const detail = JSON.stringify({
    boundaryEdges: v.boundaryEdges,
    nonManifoldEdges: v.nonManifoldEdges,
    degenerate: v.degenerateTriangles,
    nonFinite: v.nonFiniteVertices,
    issues: v.issues.map((i) => i.code),
  });
  if (!v.closed) throw new Error(`mesh is not closed: ${detail}`);
  if (!v.consistentWinding) throw new Error(`winding is inconsistent: ${detail}`);
  if (!v.outwardWinding) throw new Error(`shell is inverted: ${detail}`);
  if (v.degenerateTriangles > 0) throw new Error(`degenerate faces: ${detail}`);
  if (v.nonFiniteVertices > 0) throw new Error(`non-finite vertices: ${detail}`);
  if (v.isolatedVertices > 0) throw new Error(`isolated vertices: ${detail}`);
}

/**
 * Positions are stored as Float32, so a nominal 25 mm radius round-trips as
 * 25.000001. Assertions therefore work to 1e-4 mm - a tenth of a micron, three
 * orders of magnitude finer than any printer, and far tighter than anything
 * that could hide a real geometry error.
 */
export const MM_PRECISION = 4;

/**
 * Walk the outer rim at a given height and count how many times the radius
 * changes between the base and relief levels. For a pattern with N repeats of
 * a single stripe this must be exactly 2N - which is how "exactly four
 * repetitions, not 3.9" gets tested against the geometry itself rather than
 * against the sampler.
 *
 * Only the largest radius at each angle counts: the cap's collar ring puts a
 * second, inner vertex at every angle, and that is cap geometry rather than
 * rim geometry.
 */
export function rimTransitions(
  mesh: { positions: Float32Array },
  y: number,
  minRadius: number,
  radialSegments: number,
): number {
  // Bucket by angular index, not by the raw angle: two vertices that share an
  // angular line but sit at different radii disagree in atan2 by ~1e-7 once
  // Float32 has rounded their x/z, which would otherwise split one column into
  // two buckets and invent transitions that are not there.
  const step = (Math.PI * 2) / radialSegments;
  const byIndex = new Map<number, number>();
  const p = mesh.positions;
  for (let i = 0; i < p.length; i += 3) {
    if (Math.abs(p[i + 1] - y) > 1e-4) continue;
    const r = Math.hypot(p[i], p[i + 2]);
    if (r < minRadius) continue; // skip the bore ring and the centre vertex
    let angle = Math.atan2(p[i + 2], p[i]);
    if (angle < 0) angle += Math.PI * 2;
    const index = Math.round(angle / step) % radialSegments;
    const existing = byIndex.get(index);
    if (existing === undefined || r > existing) byIndex.set(index, r);
  }
  if (byIndex.size === 0) return 0;

  const levels = [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, r]) => Math.round(r * 1000) / 1000);

  let changes = 0;
  for (let i = 1; i < levels.length; i++) if (levels[i] !== levels[i - 1]) changes++;
  if (levels.length > 1 && levels[0] !== levels[levels.length - 1]) changes++;
  return changes;
}

/** Deterministic PRNG so property-test failures are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
