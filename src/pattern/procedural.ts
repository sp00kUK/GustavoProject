import type { PatternSampler } from '../types';
import type { RawPattern } from './types';

/**
 * Procedural pattern sources.
 *
 * Two shapes of thing live here, and the split is deliberate:
 *
 *  - `PatternSampler` factories, used by the geometry proofs and tests. They
 *    prove the mesh generators depend on nothing but the sampler interface -
 *    no canvas, no image decoding, no DOM.
 *
 *  - `RawPattern` generators, used for the in-app example library. All are
 *    original, seamless, and deterministic.
 */

/* ==================================================================== *
 * Direct samplers
 * ==================================================================== */

/** Checkerboard in tile-local space. Carves the "black" cells. */
export function checkerboardSampler(cellsX = 1, cellsY = 1): PatternSampler {
  return {
    sample(u, v, atTopEdge) {
      const vv = atTopEdge ? 1 - 1e-9 : v;
      const cx = Math.floor(u * cellsX);
      const cy = Math.floor(vv * cellsY);
      return (cx + cy) & 1 ? 1 : 0;
    },
  };
}

/**
 * Continuous heightmap, the reference case for grayscale relief:
 *
 *     mask = 0.5 + 0.5 * sin(u * 2pi * columns) * sin(v * 2pi * rows)
 */
export function sineSampler(columns = 1, rows = 1): PatternSampler {
  return {
    sample(u, v, atTopEdge) {
      const vv = atTopEdge ? 1 : v;
      return (
        0.5 +
        0.5 * Math.sin(u * Math.PI * 2 * columns) * Math.sin(vv * Math.PI * 2 * rows)
      );
    },
  };
}

/** Constant mask, for the all-black / all-white acceptance tests. */
export function constantSampler(value: number): PatternSampler {
  return { sample: () => value };
}

/** Left half carved, right half untouched. Reference for a hard vertical wall. */
export function verticalSplitSampler(splitAt = 0.5): PatternSampler {
  return { sample: (u) => (u < splitAt ? 1 : 0) };
}

/**
 * A carved rectangle straddling u = 0, i.e. crossing the cylinder's 0/360
 * seam. It must come out as one continuous recess, not two.
 */
export function seamRectangleSampler(
  halfWidth = 0.1,
  vMin = 0.3,
  vMax = 0.7,
): PatternSampler {
  return {
    sample(u, v) {
      const wrapped = u > 0.5 ? u - 1 : u;
      return Math.abs(wrapped) < halfWidth && v >= vMin && v <= vMax ? 1 : 0;
    },
  };
}

/** A carved rectangle running into the top and/or bottom edge. */
export function edgeRectangleSampler(
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
): PatternSampler {
  return {
    sample(u, v) {
      return u >= uMin && u <= uMax && v >= vMin && v <= vMax ? 1 : 0;
    },
  };
}

/* ==================================================================== *
 * Raster example library
 * ==================================================================== */

export interface ExamplePattern {
  id: string;
  label: string;
  description: string;
  build: (size?: number) => RawPattern;
}

export const EXAMPLE_PATTERNS: ExamplePattern[] = [
  {
    id: 'brick',
    label: 'Brick',
    description: 'Running-bond brickwork with recessed mortar lines.',
    build: (s = 512) => makeRaw('brick', 'Brick', s, s, brickField),
  },
  {
    id: 'cobblestone',
    label: 'Cobblestone',
    description: 'Irregular Voronoi stones - the classic terrain roller.',
    build: (s = 512) => makeRaw('cobblestone', 'Cobblestone', s, s, cobbleField),
  },
  {
    id: 'hex',
    label: 'Hex Grid',
    description: 'Seamless hexagonal grid.',
    build: (s = 512) => makeRaw('hex', 'Hex Grid', s, s, hexField),
  },
  {
    id: 'diamond',
    label: 'Diamond Knurl',
    description: 'Cross-hatch knurling for grips and handles.',
    build: (s = 512) => makeRaw('diamond', 'Diamond Knurl', s, s, diamondField),
  },
  {
    id: 'panel',
    label: 'Sci-Fi Panel',
    description: 'Panel lines, rivets and a vent block.',
    build: (s = 512) => makeRaw('panel', 'Sci-Fi Panel', s, s, panelField),
  },
  {
    id: 'checker',
    label: 'Checkerboard',
    description: 'Reference pattern - useful for checking tiling and depth.',
    build: (s = 512) => makeRaw('checker', 'Checkerboard', s, s, checkerField),
  },
  {
    id: 'wave',
    label: 'Wave Relief',
    description: 'Smooth sinusoidal heightmap for grayscale mode.',
    build: (s = 512) => makeRaw('wave', 'Wave Relief', s, s, waveField),
  },
];

/** `field(x, y, size)` returns luminance 0..1; 0 is carved by default. */
function makeRaw(
  id: string,
  name: string,
  width: number,
  height: number,
  field: (u: number, v: number) => number,
): RawPattern {
  const luminance = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      luminance[y * width + x] = Math.round(clamp01(field(u, v)) * 255);
    }
  }
  return {
    id: `example:${id}`,
    name,
    kind: 'procedural',
    width,
    height,
    luminance,
    alpha: null,
    originalWidth: width,
    originalHeight: height,
  };
}

/* -- Individual fields ------------------------------------------------ */

function brickField(u: number, v: number): number {
  const rowsPerTile = 4;
  const row = Math.floor(v * rowsPerTile);
  const shifted = u + (row & 1 ? 0.25 : 0);
  const bu = fract(shifted * 2);
  const bv = fract(v * rowsPerTile);
  const mortarU = 0.035;
  const mortarV = 0.09;
  const inMortar = bu < mortarU || bu > 1 - mortarU || bv < mortarV || bv > 1 - mortarV;
  if (inMortar) return 0;
  // Slight bevel towards the mortar so the brick faces are not perfectly flat.
  const edge = Math.min(
    Math.min(bu - mortarU, 1 - mortarU - bu) / 0.06,
    Math.min(bv - mortarV, 1 - mortarV - bv) / 0.1,
  );
  return 0.65 + 0.35 * clamp01(edge);
}

function cobbleField(u: number, v: number): number {
  const seeds = cobbleSeeds;
  let d1 = Infinity;
  let d2 = Infinity;
  for (let i = 0; i < seeds.length; i += 2) {
    // Toroidal distance keeps the pattern seamless in both axes.
    let dx = Math.abs(u - seeds[i]);
    let dy = Math.abs(v - seeds[i + 1]);
    if (dx > 0.5) dx = 1 - dx;
    if (dy > 0.5) dy = 1 - dy;
    const d = dx * dx + dy * dy;
    if (d < d1) {
      d2 = d1;
      d1 = d;
    } else if (d < d2) {
      d2 = d;
    }
  }
  const gap = Math.sqrt(d2) - Math.sqrt(d1);
  const mortar = 0.022;
  if (gap < mortar) return 0;
  return 0.6 + 0.4 * clamp01((gap - mortar) / 0.05);
}

const cobbleSeeds = (() => {
  const rand = mulberry32(0x5eed1);
  const out: number[] = [];
  const grid = 7;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      out.push(
        fract((gx + 0.2 + rand() * 0.6) / grid),
        fract((gy + 0.2 + rand() * 0.6) / grid),
      );
    }
  }
  return out;
})();

function hexField(u: number, v: number): number {
  // Two offset rectangular lattices give a seamless hex packing.
  const sx = 2;
  const sy = 2;
  const px = u * sx;
  const py = v * sy;
  const a = hexDist(fract(px), fract(py));
  const b = hexDist(fract(px + 0.5), fract(py + 0.5));
  const d = Math.min(a, b);
  const line = 0.06;
  if (d > 0.5 - line) return 0;
  return 0.7 + 0.3 * clamp01((0.5 - line - d) / 0.12);
}

function hexDist(x: number, y: number): number {
  const dx = Math.abs(x - 0.5);
  const dy = Math.abs(y - 0.5);
  return Math.max(dx * 0.866 + dy * 0.5, dy);
}

function diamondField(u: number, v: number): number {
  const n = 8;
  const a = Math.abs(fract((u + v) * n) - 0.5) * 2;
  const b = Math.abs(fract((u - v) * n) - 0.5) * 2;
  const groove = Math.min(a, b);
  return groove < 0.22 ? 0 : clamp01((groove - 0.22) / 0.4) * 0.4 + 0.6;
}

function panelField(u: number, v: number): number {
  const line = 0.02;
  // Outer frame
  if (u < line || u > 1 - line || v < line || v > 1 - line) return 0;
  // Internal split
  if (Math.abs(v - 0.45) < line * 0.8) return 0;
  // Vent block
  if (u > 0.12 && u < 0.55 && v > 0.55 && v < 0.9) {
    if (fract((v - 0.55) * 9) < 0.45) return 0;
  }
  // Rivets
  for (const [rx, ry] of [
    [0.72, 0.62],
    [0.86, 0.62],
    [0.72, 0.82],
    [0.86, 0.82],
  ]) {
    if (Math.hypot(u - rx, v - ry) < 0.035) return 0;
  }
  // Recessed inspection hatch
  if (u > 0.15 && u < 0.85 && v > 0.1 && v < 0.36) return 0.45;
  return 1;
}

function checkerField(u: number, v: number): number {
  const n = 4;
  return (Math.floor(u * n) + Math.floor(v * n)) & 1 ? 0 : 1;
}

function waveField(u: number, v: number): number {
  const s =
    Math.sin(u * Math.PI * 2) * Math.sin(v * Math.PI * 2) * 0.5 +
    Math.sin(u * Math.PI * 4 + 1.1) * Math.sin(v * Math.PI * 4 - 0.4) * 0.25;
  return 0.5 + s * 0.5;
}

/* -- helpers ---------------------------------------------------------- */

function fract(x: number): number {
  return x - Math.floor(x);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Small deterministic PRNG, so example artwork is identical every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
