import { MeshBuilder } from '../mesh/MeshBuilder';
import { buildBore } from '../cylinder/bore';
import { buildCap, buildCapCollar } from '../cylinder/endCaps';
import { ReliefField, radiusForMask } from './reliefField';
import { TWO_PI } from '../constants';
import type { PrintableMesh, ReliefDirection } from '../../types';

export interface BinaryReliefParams {
  radius: number;
  height: number;
  depth: number;
  direction: ReliefDirection;
  boreRadius: number | null;
  radialSegments: number;
  verticalSegments: number;
  field: ReliefField;
  onProgress?: (fraction: number) => void;
  shouldCancel?: () => boolean;
}

export interface BinaryReliefResult {
  mesh: PrintableMesh;
  /** Cells flipped to break diagonal-only contact - see resolvePinches. */
  pinchFixes: number;
  /** Non-zero means some pinches survived and validation will flag them. */
  unresolvedPinches: number;
  carvedCells: number;
  totalCells: number;
}

/**
 * ============================================================================
 * CRISP BINARY RELIEF
 * ============================================================================
 *
 * The cylindrical surface is treated as a grid of cells in (theta, y) space.
 * Every cell is entirely at one of exactly two radii - the untouched base
 * radius, or the relief radius - and neighbouring cells that disagree are
 * joined by a real wall. Nothing is interpolated, so a cavity has a flat
 * floor, a flat rim and a genuine step between them: an engraving, not a
 * softened bump map.
 *
 *   cell at base level        r = R
 *   cell at relief level      r = R - depth   (deboss)   or R + depth (emboss)
 *   theta boundary disagrees  radial wall in the plane containing the axis
 *   y boundary disagrees      annular-sector wall in a horizontal plane
 *
 * Triangle budget is kept sane by run-length merging each angular column
 * vertically. Merging along y is exact - the cylinder is straight in that
 * direction - so a blank roller collapses to two triangles per column instead
 * of two per cell. Merging *around* theta is deliberately not done, because
 * that would flatten the barrel into a coarse polygon.
 *
 * Merging has one trap, and getting it wrong is what leaves a mesh full of
 * open edges. A merged face's *side* edges are shared with the neighbouring
 * column, which may change state part way up. If the merged face spans that
 * change with a single long edge, the neighbour meets it with two short ones
 * and the two never match: a T-junction, i.e. a hole. So each face is emitted
 * as a strip whose left chain is subdivided at every transition of the column
 * to its left, and whose right chain is subdivided at every transition of the
 * column to its right. The faces stay merged; only the shared boundaries gain
 * the extra collinear points needed to line up exactly.
 *
 * Vertex identity is an integer lattice key, never a coordinate hash:
 *
 *   key(i, j, level) = (j * Nu + i) * 2 + level
 *
 * with i the angular index, j the height grid line, level the radius tier.
 * Two faces reference the same vertex if and only if they mean the same
 * vertex, which is what makes the shell watertight by construction.
 */
export function buildBinaryRelief(params: BinaryReliefParams): BinaryReliefResult {
  const {
    radius,
    height,
    depth,
    direction,
    boreRadius,
    radialSegments: nu,
    verticalSegments: nv,
    field,
    onProgress,
    shouldCancel,
  } = params;

  const yBottom = -height / 2;
  const dy = height / nv;

  const levelRadius = [
    radiusForMask(radius, depth, direction, 0),
    radiusForMask(radius, depth, direction, 1),
  ];

  /* -- 1. Sample cell states at cell centres ---------------------------- */

  const state = new Uint8Array(nu * nv);
  let carvedCells = 0;
  for (let j = 0; j < nv; j++) {
    const y = yBottom + (j + 0.5) * dy;
    const rowBase = j * nu;
    for (let i = 0; i < nu; i++) {
      const mask = field.maskAt((i + 0.5) / nu, y);
      if (mask >= 0.5) {
        state[rowBase + i] = 1;
        carvedCells++;
      }
    }
    if ((j & 63) === 0) {
      if (shouldCancel?.()) throw new CancelledError();
      onProgress?.((j / nv) * 0.25);
    }
  }

  /* -- 2. Break diagonal-only contact ----------------------------------- */

  const pinch = resolvePinches(state, nu, nv);
  carvedCells -= pinch.fixes;
  onProgress?.(0.3);

  /* -- 3. Emit -------------------------------------------------------- */

  const boreKeyBase = 2 * nu * (nv + 1);
  const centreBottomKey = boreKeyBase + 2 * nu;
  const centreTopKey = centreBottomKey + 1;

  // Rough capacity guess; MeshBuilder grows if the pattern is busier.
  const b = new MeshBuilder(nu * 8, nu * 12);

  const cos = new Float64Array(nu);
  const sin = new Float64Array(nu);
  for (let i = 0; i < nu; i++) {
    const theta = (i / nu) * TWO_PI;
    cos[i] = Math.cos(theta);
    sin[i] = Math.sin(theta);
  }

  const key = (i: number, j: number, level: number): number => (j * nu + i) * 2 + level;
  const vert = (i: number, j: number, level: number): number => {
    const r = levelRadius[level];
    return b.vertex(key(i, j, level), r * cos[i], yBottom + j * dy, r * sin[i]);
  };

  /** True when column `c` changes state across height grid line `j`. */
  const changesAt = (c: number, j: number): boolean =>
    j > 0 && j < nv && state[(j - 1) * nu + c] !== state[j * nu + c];

  const chainA = new Int32Array(nv + 2);
  const chainB = new Int32Array(nv + 2);

  // 3a. Outer barrel: vertical run-length merge per angular column, emitted as
  // strips so the side edges align with whatever the neighbours are doing.
  for (let i = 0; i < nu; i++) {
    const prev = (i + nu - 1) % nu;
    const next = (i + 1) % nu;
    let j = 0;
    while (j < nv) {
      const level = state[j * nu + i];
      let jEnd = j;
      while (jEnd + 1 < nv && state[(jEnd + 1) * nu + i] === level) jEnd++;
      const j1 = jEnd + 1;

      // Left edge sits on angular line i, shared with column `prev`.
      // Right edge sits on angular line i+1, shared with column `next`.
      const nLeft = fillChain(chainA, j, j1, (k) => changesAt(prev, k));
      const nRight = fillChain(chainB, j, j1, (k) => changesAt(next, k));

      emitStrip(
        b,
        chainA,
        nLeft,
        chainB,
        nRight,
        (k) => vert(i, k, level),
        (k) => vert(next, k, level),
      );
      j = j1;
    }
    if ((i & 63) === 0) {
      if (shouldCancel?.()) throw new CancelledError();
      onProgress?.(0.3 + (i / nu) * 0.25);
    }
  }

  // 3b. Horizontal walls at vertical state changes inside a column.
  for (let i = 0; i < nu; i++) {
    const n = (i + 1) % nu;
    for (let j = 1; j < nv; j++) {
      const below = state[(j - 1) * nu + i];
      const above = state[j * nu + i];
      if (below === above) continue;
      const A = vert(i, j, below);
      const B = vert(n, j, below);
      const C = vert(n, j, above);
      const D = vert(i, j, above);
      // Annular step face. Taking A,B on the lower cell's radius and C,D on
      // the upper cell's, the traversal A->B->C->D has normal
      //     n_y = rBelow * dTheta * (rAbove - rBelow)
      // which is +Y exactly when the step widens going up - and that is the
      // case where material lies *above* the face, so the normal has to point
      // down. The same inversion holds when the step narrows. So the correct
      // traversal is the reverse in both directions, with no branch.
      b.quad(D, C, B, A);
    }
    if ((i & 63) === 0) {
      if (shouldCancel?.()) throw new CancelledError();
      onProgress?.(0.55 + (i / nu) * 0.15);
    }
  }

  // 3c. Vertical cavity walls between adjacent angular columns, merged in y.
  for (let i = 0; i < nu; i++) {
    const n = (i + 1) % nu;
    let j = 0;
    while (j < nv) {
      const left = state[j * nu + i];
      const right = state[j * nu + n];
      if (left === right) {
        j++;
        continue;
      }
      let jEnd = j;
      while (
        jEnd + 1 < nv &&
        state[(jEnd + 1) * nu + i] === left &&
        state[(jEnd + 1) * nu + n] === right
      ) {
        jEnd++;
      }
      const j1 = jEnd + 1;

      // Both faces of this wall sit on angular line n, so both chains take the
      // transitions of both adjacent columns - which is exactly what those
      // columns' own side chains use.
      const count = fillChain(
        chainA,
        j,
        j1,
        (k) => changesAt(i, k) || changesAt(n, k),
      );
      chainB.set(chainA.subarray(0, count));

      // This winding is correct whether the left column is the taller or the
      // shorter one; the cross product flips sign with the radii.
      emitStrip(
        b,
        chainA,
        count,
        chainB,
        count,
        (k) => vert(n, k, left),
        (k) => vert(n, k, right),
      );
      j = j1;
    }
    if ((i & 63) === 0) {
      if (shouldCancel?.()) throw new CancelledError();
      onProgress?.(0.7 + (i / nu) * 0.15);
    }
  }

  onProgress?.(0.85);

  /* -- 4. Caps -------------------------------------------------------- */

  buildStaircaseCap(b, {
    segments: nu,
    row: 0,
    gridLine: 0,
    y: yBottom,
    isTop: false,
    state,
    levelRadius,
    vert,
    boreRadius,
    boreKey: (i) => boreKeyBase + i,
    centreKey: centreBottomKey,
  });

  buildStaircaseCap(b, {
    segments: nu,
    row: nv - 1,
    gridLine: nv,
    y: yBottom + height,
    isTop: true,
    state,
    levelRadius,
    vert,
    boreRadius,
    boreKey: (i) => boreKeyBase + nu + i,
    centreKey: centreTopKey,
  });

  if (boreRadius !== null) {
    buildBore(b, {
      segments: nu,
      radius: boreRadius,
      yBottom,
      yTop: yBottom + height,
      bottomKey: (i) => boreKeyBase + i,
      topKey: (i) => boreKeyBase + nu + i,
    });
  }

  onProgress?.(1);

  return {
    mesh: b.build(),
    pinchFixes: pinch.fixes,
    unresolvedPinches: pinch.unresolved,
    carvedCells,
    totalCells: nu * nv,
  };
}

/* -------------------------------------------------------------------- *
 * Strip emission
 * -------------------------------------------------------------------- */

/**
 * Collect the height grid lines a chain must pass through: its two endpoints
 * plus every interior line the predicate marks. Written into `out` to keep the
 * inner loop allocation-free; returns how many entries are valid.
 */
function fillChain(
  out: Int32Array,
  j0: number,
  j1: number,
  isBreak: (j: number) => boolean,
): number {
  let n = 0;
  out[n++] = j0;
  for (let j = j0 + 1; j < j1; j++) if (isBreak(j)) out[n++] = j;
  out[n++] = j1;
  return n;
}

/**
 * Triangulate the planar face between two vertical chains.
 *
 * The face is a rectangle - both chains are straight vertical lines at the
 * same radius or at two radii on the same angular line - so any triangulation
 * is exact; the two-pointer walk simply keeps the triangles well shaped.
 *
 * Boundary order is left chain bottom-to-top then right chain top-to-bottom,
 * which is the outward-facing winding derived for the barrel and reused,
 * unchanged, for the cavity walls.
 */
function emitStrip(
  b: MeshBuilder,
  left: Int32Array,
  leftCount: number,
  right: Int32Array,
  rightCount: number,
  leftVertex: (j: number) => number,
  rightVertex: (j: number) => number,
): void {
  let a = 0;
  let c = 0;
  let L = leftVertex(left[0]);
  let R = rightVertex(right[0]);

  while (a < leftCount - 1 || c < rightCount - 1) {
    const advanceLeft =
      a < leftCount - 1 && (c >= rightCount - 1 || left[a + 1] <= right[c + 1]);
    if (advanceLeft) {
      const L2 = leftVertex(left[++a]);
      b.triangle(L, L2, R);
      L = L2;
    } else {
      const R2 = rightVertex(right[++c]);
      b.triangle(L, R2, R);
      R = R2;
    }
  }
}

/* -------------------------------------------------------------------- *
 * Cap construction for a stepped rim
 * -------------------------------------------------------------------- */

interface StaircaseCapOptions {
  segments: number;
  /** Cell row that determines the rim radius. */
  row: number;
  /** Height grid line the cap sits on. */
  gridLine: number;
  /** World height of that grid line. */
  y: number;
  isTop: boolean;
  state: Uint8Array;
  levelRadius: number[];
  vert: (i: number, j: number, level: number) => number;
  boreRadius: number | null;
  boreKey: (i: number) => number;
  centreKey: number;
}

/**
 * Close one end of a barrel whose rim alternates between two radii.
 *
 * Triangulating that staircase straight to the bore does not work: two
 * neighbouring sectors would disagree about how far their shared radial edge
 * extends, leaving a T-junction. Instead the rim is first bridged down to a
 * collar ring at the *lowest* radius present in the rim, and the collar - which
 * is a clean regular polygon - is what gets joined to the bore.
 *
 * The collar band's side edges land exactly on the bottom/top edges of the
 * relief's vertical cavity walls, so the cap and the barrel share them.
 * When the whole rim sits at one radius the collar coincides with the rim and
 * no extra geometry is produced at all.
 */
function buildStaircaseCap(b: MeshBuilder, opts: StaircaseCapOptions): void {
  const { segments, row, gridLine, y, isTop, state, levelRadius, vert } = opts;
  const rowBase = row * segments;

  let collarLevel = state[rowBase];
  for (let i = 1; i < segments; i++) {
    const lvl = state[rowBase + i];
    if (levelRadius[lvl] < levelRadius[collarLevel]) collarLevel = lvl;
  }

  const collarVertex = (i: number): number => vert(i, gridLine, collarLevel);

  buildCapCollar(b, {
    segments,
    y,
    isTop,
    outerStart: (i) => vert(i, gridLine, state[rowBase + i]),
    outerEnd: (i) => vert((i + 1) % segments, gridLine, state[rowBase + i]),
    collarVertex,
    hasBand: (i) => state[rowBase + i] !== collarLevel,
  });

  buildCap(b, {
    segments,
    y,
    isTop,
    ringVertex: collarVertex,
    boreRadius: opts.boreRadius,
    keys: { bore: opts.boreKey, centre: opts.centreKey },
  });
}

/* -------------------------------------------------------------------- *
 * Pinch resolution
 * -------------------------------------------------------------------- */

export interface PinchResult {
  fixes: number;
  unresolved: number;
}

/**
 * Remove configurations where two same-level cells touch only at a corner.
 *
 * At such a corner four faces meet along one radial edge instead of two, and
 * the surface stops being a manifold. That is not a construction bug - the
 * *solid itself* is degenerate there, two blocks of material meeting at a
 * knife point - so the fix has to change the shape, not the triangulation.
 *
 * The cheapest honest fix is to fill one of the two diagonal relief cells back
 * to base level. Filling only ever removes relief cells, so the pass is
 * monotone and terminates; at export resolutions the altered cell is a
 * fraction of a millimetre and invisible, while the alternative is a mesh a
 * slicer refuses without repair.
 *
 * Only interior height lines can pinch. At j = 0 and j = nv there is no row
 * beyond, and the end cap closes the surface instead.
 */
export function resolvePinches(state: Uint8Array, nu: number, nv: number): PinchResult {
  const MAX_PASSES = 24;
  let fixes = 0;
  let remaining = 0;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    remaining = 0;
    let fixedThisPass = 0;

    for (let j = 1; j < nv; j++) {
      const below = (j - 1) * nu;
      const cur = j * nu;
      for (let i = 0; i < nu; i++) {
        const left = (i + nu - 1) % nu;
        const a = state[below + left]; // lower-left
        const bb = state[below + i]; // lower-right
        const c = state[cur + left]; // upper-left
        const d = state[cur + i]; // upper-right
        if (a !== d || bb !== c || a === bb) continue;

        // Fill whichever diagonal pair is at relief level, taking the
        // lexicographically first cell so the result is deterministic.
        if (a === 1) {
          state[below + left] = 0;
        } else {
          state[below + i] = 0;
        }
        fixes++;
        fixedThisPass++;
      }
    }

    if (fixedThisPass === 0) break;
  }

  // Final audit so callers can surface an honest warning if anything survived.
  for (let j = 1; j < nv; j++) {
    const below = (j - 1) * nu;
    const cur = j * nu;
    for (let i = 0; i < nu; i++) {
      const left = (i + nu - 1) % nu;
      const a = state[below + left];
      const bb = state[below + i];
      const c = state[cur + left];
      const d = state[cur + i];
      if (a === d && bb === c && a !== bb) remaining++;
    }
  }

  return { fixes, unresolved: remaining };
}

export class CancelledError extends Error {
  constructor() {
    super('Generation cancelled');
    this.name = 'CancelledError';
  }
}
