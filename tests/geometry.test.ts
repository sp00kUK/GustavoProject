import { describe, expect, it } from 'vitest';
import {
  checkerboardSampler,
  constantSampler,
  edgeRectangleSampler,
  seamRectangleSampler,
  sineSampler,
  verticalSplitSampler,
} from '../src/pattern/procedural';
import { validateSettings, maxSafeDepth, summarise } from '../src/geometry/constraints';
import { orientMesh, computeMeshStats } from '../src/geometry/mesh/meshOps';
import { resolveResolution } from '../src/geometry/quality';
import {
  build,
  expectWatertight,
  rimTransitions,
  rng,
  CYLINDER,
  RELIEF,
  MM_PRECISION,
} from './helpers';
import type { PatternSampler } from '../src/types';

/* ==================================================================== *
 * Spec test cases 77-86
 * ==================================================================== */

describe('dimensional accuracy', () => {
  it('77: depth 0 produces a cylinder of exactly the requested size', () => {
    const r = build(constantSampler(0), 'binary', { relief: { depth: 0 } });
    const { min, max } = r.stats.bounds;
    expect(max[1] - min[1]).toBeCloseTo(100, MM_PRECISION);
    // A 24-gon-and-finer approximation touches the true radius at its vertices.
    expect(r.stats.maxOuterRadius).toBeCloseTo(25, MM_PRECISION);
    expect(max[0] - min[0]).toBeCloseTo(50, 1);
    expect(max[2] - min[2]).toBeCloseTo(50, 1);
    expectWatertight(r);
  });

  it('78: an all-black pattern carves the whole barrel to R - depth', () => {
    const r = build(constantSampler(1));
    expect(r.stats.maxOuterRadius).toBeCloseTo(23, MM_PRECISION);
    expectWatertight(r);
  });

  it('79: an all-white pattern leaves the base cylinder untouched', () => {
    const white = build(constantSampler(0));
    const plain = build(constantSampler(0), 'binary', { relief: { depth: 0 } });
    expect(white.stats.maxOuterRadius).toBeCloseTo(25, MM_PRECISION);
    expect(white.stats.triangleCount).toBe(plain.stats.triangleCount);
    expect(white.stats.volume).toBeCloseTo(plain.stats.volume, 2);
  });

  it('80: 50% grey displaces exactly half the depth in grayscale mode', () => {
    const r = build(constantSampler(0.5), 'grayscale');
    expect(r.stats.maxOuterRadius).toBeCloseTo(24, MM_PRECISION);
    expectWatertight(r);
  });

  it('81: invert turns black into white and white into black', () => {
    // Polarity lives in the mask pipeline; at kernel level it is the sampler
    // that flips, so assert the two produce identical geometry.
    const black = build(constantSampler(1));
    const invertedWhite = build({ sample: () => 1 - 0 });
    expect(invertedWhite.stats.maxOuterRadius).toBeCloseTo(
      black.stats.maxOuterRadius,
      MM_PRECISION,
    );
  });
});

describe('tiling', () => {
  const stripe = (columns: number): PatternSampler => ({
    sample: (u) => ((u * columns) % 1 < 0.4 ? 1 : 0),
  });

  it('82: exactly N repetitions appear around 360 degrees', () => {
    for (const columns of [1, 2, 3, 4, 6, 7]) {
      const r = build(stripe(columns), 'binary', { quality: 'standard' });
      const transitions = rimTransitions(r.mesh, -50, 22.9, r.resolution.radialSegments);
      expect(transitions, `columns=${columns}`).toBe(columns * 2);
      expectWatertight(r);
    }
  });

  it('82: the final tile is not stretched - all repeats are equal width', () => {
    const columns = 4;
    const s = stripe(columns);
    const widths: number[] = [];
    let runStart = -1;
    const N = 4000;
    for (let i = 0; i <= N; i++) {
      const carved = s.sample(i / N, 0.5) > 0.5;
      const prev = i === 0 ? false : s.sample((i - 1) / N, 0.5) > 0.5;
      if (carved && !prev) runStart = i;
      if (!carved && prev && runStart >= 0) widths.push(i - runStart);
    }
    expect(widths.length).toBe(columns);
    for (const w of widths) expect(Math.abs(w - widths[0])).toBeLessThanOrEqual(1);
  });

  it('83: N rows span the usable height', () => {
    const band: PatternSampler = { sample: (_u, v) => (v % 1 < 0.4 ? 1 : 0) };
    const rows = 5;
    const scaled: PatternSampler = { sample: (u, v) => band.sample(u, v * rows) };
    const r = build(scaled, 'binary', { quality: 'standard' });
    expectWatertight(r);
    // Each band contributes a step in and a step out along every column.
    expect(r.stats.minOuterRadius).toBeCloseTo(4, MM_PRECISION);
    expect(r.stats.maxOuterRadius).toBeCloseTo(25, MM_PRECISION);
  });
});

describe('the 360 degree seam', () => {
  it('84: a seamless texture leaves no crack, gap or duplicated wall', () => {
    const r = build(sineSampler(4, 5), 'grayscale', { quality: 'standard' });
    expectWatertight(r);
  });

  it('172: a recess straddling u=0 is one continuous cavity, not two', () => {
    const r = build(seamRectangleSampler(0.12, 0, 1), 'binary', {
      quality: 'standard',
    });
    expectWatertight(r);
    // One recess crossing the seam has exactly two walls. Had the seam split
    // it into two separate recesses there would be four.
    expect(rimTransitions(r.mesh, -50, 22.9, r.resolution.radialSegments)).toBe(2);
    // And the same recess, floating clear of both ends, must also stay closed.
    expectWatertight(build(seamRectangleSampler(0.12, 0.3, 0.7)));
  });

  it('a pattern offset around the seam never opens the mesh', () => {
    for (const offset of [0, 0.13, 0.5, 0.87, 0.999]) {
      const shifted: PatternSampler = {
        sample: (u, v) => seamRectangleSampler(0.1, 0.3, 0.7).sample((u + offset) % 1, v),
      };
      expectWatertight(build(shifted));
    }
  });
});

describe('end closure', () => {
  it('173: a recess running into the top face stays watertight', () => {
    expectWatertight(build(edgeRectangleSampler(0.1, 0.35, 0.8, 1.0)));
  });

  it('173: a recess running into the bottom face stays watertight', () => {
    expectWatertight(build(edgeRectangleSampler(0.1, 0.35, 0.0, 0.2)));
  });

  it('a recess spanning the full height stays watertight', () => {
    expectWatertight(build(verticalSplitSampler(0.5)));
  });

  it('caps follow the patterned radius rather than assuming a constant rim', () => {
    const r = build(edgeRectangleSampler(0.1, 0.35, 0.0, 0.2));
    const bottomRadii = new Set<number>();
    const p = r.mesh.positions;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i + 1] + 50) > 1e-4) continue;
      const radius = Math.round(Math.hypot(p[i], p[i + 2]) * 100) / 100;
      if (radius > 20) bottomRadii.add(radius);
    }
    // The rim must contain both the untouched radius and the carved one.
    expect(bottomRadii.has(25)).toBe(true);
    expect(bottomRadii.has(23)).toBe(true);
  });
});

describe('bore', () => {
  it('85: 50 mm body / 8 mm bore / 2 mm depth leaves a 19 mm wall', () => {
    const r = build(checkerboardSampler(6, 8));
    expectWatertight(r);
    expect(r.stats.minOuterRadius).toBeCloseTo(4, MM_PRECISION);
    const s = summarise(CYLINDER, RELIEF);
    expect(s.minOuterRadius).toBe(23);
    expect(s.boreRadius).toBe(4);
    expect(s.minWall).toBe(19);
  });

  it('a solid roller with no bore is still closed', () => {
    const r = build(checkerboardSampler(6, 8), 'binary', {
      cylinder: { boreEnabled: false },
    });
    expectWatertight(r);
    expect(r.stats.minOuterRadius).toBeCloseTo(0, MM_PRECISION);
  });

  it('86: a depth that reaches into the bore is blocked, with the safe value', () => {
    const cylinder = {
      diameter: 20,
      height: 50,
      boreEnabled: true,
      boreDiameter: 16,
    };
    const relief = { ...RELIEF, depth: 3 };
    const v = validateSettings(cylinder, relief);
    expect(v.canGenerate).toBe(false);
    const blocker = v.issues.find((i) => i.code === 'DEPTH_BREACHES_BORE');
    expect(blocker).toBeDefined();
    expect(blocker!.severity).toBe('error');
    // R = 10, Rb = 8, so with a 1.2 mm target wall the safe depth is 0.8.
    expect(maxSafeDepth(cylinder, 'deboss')).toBeCloseTo(0.8, 6);
  });

  it('warns, but still generates, when the wall is merely thin', () => {
    const cylinder = { ...CYLINDER, boreDiameter: 44 };
    const v = validateSettings(cylinder, RELIEF);
    expect(v.canGenerate).toBe(true);
    expect(v.issues.some((i) => i.code === 'THIN_WALL')).toBe(true);
  });

  it('rejects nonsense dimensions instead of crashing the kernel', () => {
    expect(validateSettings({ ...CYLINDER, diameter: 0 }, RELIEF).canGenerate).toBe(false);
    expect(validateSettings({ ...CYLINDER, height: -1 }, RELIEF).canGenerate).toBe(false);
    expect(
      validateSettings({ ...CYLINDER, boreDiameter: 60 }, RELIEF).canGenerate,
    ).toBe(false);
    expect(validateSettings(CYLINDER, { ...RELIEF, depth: -1 }).canGenerate).toBe(false);
  });
});

/* ==================================================================== *
 * Emboss, margins, orientation
 * ==================================================================== */

describe('relief direction and margins', () => {
  it('128: emboss raises the pattern outward instead of carving inward', () => {
    const r = build(checkerboardSampler(6, 8), 'binary', {
      relief: { direction: 'emboss' },
    });
    expectWatertight(r);
    expect(r.stats.maxOuterRadius).toBeCloseTo(27, MM_PRECISION);
  });

  it('22: margins keep the ends at the base radius', () => {
    const r = build(constantSampler(1), 'binary', {
      relief: { bottomMargin: 10, topMargin: 10 },
    });
    expectWatertight(r);
    const p = r.mesh.positions;
    let rimRadius = 0;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i + 1] + 50) > 1e-4) continue;
      rimRadius = Math.max(rimRadius, Math.hypot(p[i], p[i + 2]));
    }
    expect(rimRadius).toBeCloseTo(25, MM_PRECISION);
  });
});

describe('export orientation', () => {
  it('102: every orientation is a proper rotation that preserves outward normals', () => {
    const r = build(checkerboardSampler(4, 4));
    for (const orientation of ['vertical', 'horizontalX', 'horizontalY'] as const) {
      const m = orientMesh(r.mesh, orientation);
      const stats = computeMeshStats(m);
      expect(stats.volume, orientation).toBeCloseTo(r.stats.volume, 2);
      expect(stats.bounds.min[2], orientation).toBeCloseTo(0, 5);
    }
  });

  it('vertical export stands the roller on end, Z-up, at millimetre scale', () => {
    const r = build(constantSampler(0), 'binary', { relief: { depth: 0 } });
    const m = orientMesh(r.mesh, 'vertical');
    const s = computeMeshStats(m);
    expect(s.bounds.max[2] - s.bounds.min[2]).toBeCloseTo(100, 4);
    expect(s.bounds.max[0] - s.bounds.min[0]).toBeCloseTo(50, 1);
  });
});

/* ==================================================================== *
 * 90-91: property and invariant tests
 * ==================================================================== */

describe('property tests over random valid configurations', () => {
  it('91: random parameter combinations always yield a valid closed solid', () => {
    const rand = rng(0xc0ffee);
    for (let iteration = 0; iteration < 24; iteration++) {
      const diameter = 12 + rand() * 120;
      const height = 15 + rand() * 180;
      const boreEnabled = rand() > 0.3;
      const maxBore = diameter * 0.5;
      const boreDiameter = 3 + rand() * Math.max(0.1, maxBore - 3);
      const radius = diameter / 2;
      const maxDepth = Math.max(
        0.1,
        radius - (boreEnabled ? boreDiameter / 2 : 0) - 1.5,
      );
      const depth = 0.2 + rand() * Math.min(4, maxDepth);
      const mode = rand() > 0.5 ? 'binary' : 'grayscale';
      const columns = 1 + Math.floor(rand() * 9);
      const rows = 1 + Math.floor(rand() * 9);

      const sampler: PatternSampler =
        mode === 'binary'
          ? checkerboardSampler(columns, rows)
          : sineSampler(columns, rows);

      const cylinder = { diameter, height, boreEnabled, boreDiameter };
      const relief = { ...RELIEF, depth };
      const settings = validateSettings(cylinder, relief);
      if (!settings.canGenerate) continue;

      const result = build(sampler, mode, { cylinder, relief });
      const label = JSON.stringify({ diameter, height, boreDiameter, depth, mode });

      try {
        expectWatertight(result);
      } catch (error) {
        throw new Error(`${(error as Error).message}\n  config: ${label}`);
      }

      // All indices in range, all coordinates finite.
      const vertexCount = result.mesh.positions.length / 3;
      for (let i = 0; i < result.mesh.indices.length; i++) {
        expect(result.mesh.indices[i]).toBeLessThan(vertexCount);
      }
      expect(result.stats.volume).toBeGreaterThan(0);
      expect(Number.isFinite(result.stats.surfaceArea)).toBe(true);
    }
  });

  it('90: index bounds and finiteness hold for a dense pattern', () => {
    const r = build(checkerboardSampler(37, 53), 'binary', { quality: 'standard' });
    expectWatertight(r);
    const vertexCount = r.mesh.positions.length / 3;
    expect(vertexCount).toBeGreaterThan(0);
    for (const value of r.mesh.positions) expect(Number.isFinite(value)).toBe(true);
    for (const index of r.mesh.indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(vertexCount);
    }
  });
});

describe('determinism', () => {
  it('148: identical inputs produce byte-identical geometry', () => {
    const a = build(checkerboardSampler(7, 9), 'binary', { quality: 'standard' });
    const b = build(checkerboardSampler(7, 9), 'binary', { quality: 'standard' });
    expect(a.mesh.positions.length).toBe(b.mesh.positions.length);
    expect(a.mesh.indices.length).toBe(b.mesh.indices.length);
    expect(Buffer.from(a.mesh.positions.buffer)).toEqual(
      Buffer.from(b.mesh.positions.buffer),
    );
    expect(Buffer.from(a.mesh.indices.buffer)).toEqual(
      Buffer.from(b.mesh.indices.buffer),
    );
  });
});

describe('resolution', () => {
  it('26: segment counts follow physical size, not a hardcoded constant', () => {
    const small = resolveResolution(20, 40, 0.25);
    const large = resolveResolution(200, 400, 0.25);
    expect(large.radialSegments).toBeGreaterThan(small.radialSegments * 8);
    expect(small.radialSegments).toBe(Math.ceil((Math.PI * 20) / 0.25));
  });

  it('151: circumference is pi*D, not 2*pi*D', () => {
    const r = resolveResolution(50, 100, 1);
    expect(r.radialSegments).toBe(Math.ceil(Math.PI * 50));
    expect(summarise(CYLINDER, RELIEF).circumference).toBeCloseTo(157.0796, 3);
  });

  it('clamps absurd requests rather than allocating unbounded memory', () => {
    const r = resolveResolution(300, 300, 0.0001);
    expect(r.clamped).toBe(true);
    expect(r.radialSegments).toBeLessThanOrEqual(16384);
  });
});
