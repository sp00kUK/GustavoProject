import { MeshBuilder } from '../mesh/MeshBuilder';
import { TWO_PI } from '../constants';

/**
 * End cap construction.
 *
 * A cap is always built as a band from an existing ring of vertices down to
 * either a bore ring or a single centre point. The caller supplies the ring
 * vertex indices, so the same code closes a smooth grayscale rim (radius
 * varies per angular index) and a stepped binary rim (radius is constant per
 * angular *sector*, with radial jogs between sectors) - see `capCollar`.
 *
 * Winding convention, derived once and relied on everywhere:
 *
 *   For points p0, p1 at increasing theta on a plane y = const, and an inner
 *   point q, the triangle (q, p0, p1) has normal -Y and (q, p1, p0) has +Y.
 *
 * So the bottom cap walks sectors in increasing theta and the top cap walks
 * them reversed.
 */

export interface CapKeyspace {
  /** Key of the bore ring vertex at angular index i on this cap. */
  bore(i: number): number;
  /** Key of the single centre vertex (solid rollers only). */
  centre: number;
}

export interface CapOptions {
  segments: number;
  /** Plane of the cap. */
  y: number;
  /** true for the +Y cap. */
  isTop: boolean;
  /** Ring vertex index at angular index i, i in [0, segments). */
  ringVertex: (i: number) => number;
  /** Bore radius, or null for a solid roller. */
  boreRadius: number | null;
  keys: CapKeyspace;
}

/**
 * Close a cap from `ringVertex` inward to the bore (or the axis).
 *
 * Every radial edge at angle theta_i is shared by exactly the two sectors
 * that meet there, because both reference the identical two vertex indices.
 * That is the whole reason this is manifold by construction.
 */
export function buildCap(b: MeshBuilder, opts: CapOptions): void {
  const { segments, y, isTop, ringVertex, boreRadius, keys } = opts;

  const inner = new Int32Array(segments);
  if (boreRadius !== null) {
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * TWO_PI;
      inner[i] = b.vertex(
        keys.bore(i),
        boreRadius * Math.cos(theta),
        y,
        boreRadius * Math.sin(theta),
      );
    }
  } else {
    const centre = b.vertex(keys.centre, 0, y, 0);
    inner.fill(centre);
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const o0 = ringVertex(i);
    const o1 = ringVertex(next);
    const i0 = inner[i];
    const i1 = inner[next];

    if (boreRadius === null) {
      // Fan to the axis: one triangle per sector.
      if (isTop) b.triangle(i0, o1, o0);
      else b.triangle(i0, o0, o1);
    } else if (isTop) {
      b.quad(i1, o1, o0, i0);
    } else {
      b.quad(i0, o0, o1, i1);
    }
  }
}

export interface CollarOptions {
  segments: number;
  y: number;
  isTop: boolean;
  /** Outer vertex index at the *start* of sector i (angle i). */
  outerStart: (i: number) => number;
  /** Outer vertex index at the *end* of sector i (angle i+1). */
  outerEnd: (i: number) => number;
  /** Collar vertex index at angular index i, all at the same radius. */
  collarVertex: (i: number) => number;
  /** true when sector i actually needs a collar band. */
  hasBand: (i: number) => boolean;
}

/**
 * Bridge a stepped rim down to a constant-radius collar ring.
 *
 * Binary relief gives each angular sector one of two radii, so the rim of the
 * cap is a staircase. Rather than triangulating that staircase straight to the
 * bore - which produces T-junctions where neighbouring sectors disagree about
 * where their shared radial edge ends - we first flatten it onto a collar ring
 * at the *minimum* rim radius. Sectors already at that radius contribute
 * nothing, so a plain unpatterned cylinder gets no extra geometry at all.
 *
 * The collar band's radial side edges coincide exactly with the bottom (or
 * top) edges of the relief's vertical cavity walls, which is what closes the
 * seam between the cap and the patterned barrel.
 */
export function buildCapCollar(b: MeshBuilder, opts: CollarOptions): void {
  const { segments, isTop, outerStart, outerEnd, collarVertex, hasBand } = opts;

  for (let i = 0; i < segments; i++) {
    if (!hasBand(i)) continue;
    const next = (i + 1) % segments;
    const o0 = outerStart(i);
    const o1 = outerEnd(i);
    const c0 = collarVertex(i);
    const c1 = collarVertex(next);
    if (isTop) b.quad(c1, o1, o0, c0);
    else b.quad(c0, o0, o1, c1);
  }
}
