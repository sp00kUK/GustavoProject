import { MeshBuilder } from '../mesh/MeshBuilder';
import { buildBore } from '../cylinder/bore';
import { buildCap } from '../cylinder/endCaps';
import { ReliefField, radiusForMask } from './reliefField';
import { TWO_PI } from '../constants';
import { CancelledError } from './binaryRelief';
import type { PrintableMesh, ReliefDirection } from '../../types';

export interface GrayscaleReliefParams {
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

export interface GrayscaleReliefResult {
  mesh: PrintableMesh;
  minRadius: number;
  maxRadius: number;
}

/**
 * ============================================================================
 * CONTINUOUS (HEIGHTMAP) RELIEF
 * ============================================================================
 *
 * The surface is generated directly from its parametric definition. For every
 * lattice point:
 *
 *     theta = 2*pi * i / Nu
 *     y     = -H/2 + H * j / Nv
 *     mask  = pattern(u, v)                  0 = untouched, 1 = full depth
 *     r     = R - depth * mask               (R + depth * mask when embossing)
 *     x     = r * cos(theta)
 *     z     = r * sin(theta)
 *
 * There is no cylinder to subtract from. The final radius is known at every
 * coordinate, so the final surface is what gets built.
 *
 * The circumference closes because the ring index wraps arithmetically -
 * column Nu-1 stitches to column 0 by index, not by hoping two floating point
 * positions compare equal. There is no duplicated seam column anywhere in this
 * file, which is precisely why there is no seam.
 */
export function buildGrayscaleRelief(
  params: GrayscaleReliefParams,
): GrayscaleReliefResult {
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
  const rings = nv + 1;

  const cos = new Float64Array(nu);
  const sin = new Float64Array(nu);
  for (let i = 0; i < nu; i++) {
    const theta = (i / nu) * TWO_PI;
    cos[i] = Math.cos(theta);
    sin[i] = Math.sin(theta);
  }

  const b = new MeshBuilder(nu * rings + nu * 2 + 2, nu * nv * 2 + nu * 4);

  let minRadius = Infinity;
  let maxRadius = -Infinity;

  // Grid vertices. key(i, j) = j * Nu + i, so the wrap is free.
  const grid = new Uint32Array(nu * rings);
  for (let j = 0; j < rings; j++) {
    const y = yBottom + j * dy;
    for (let i = 0; i < nu; i++) {
      const mask = field.maskAt(i / nu, y);
      const r = radiusForMask(radius, depth, direction, mask);
      if (r < minRadius) minRadius = r;
      if (r > maxRadius) maxRadius = r;
      grid[j * nu + i] = b.vertex(j * nu + i, r * cos[i], y, r * sin[i]);
    }
    if ((j & 31) === 0) {
      if (shouldCancel?.()) throw new CancelledError();
      onProgress?.((j / rings) * 0.6);
    }
  }

  // Barrel quads, wound outward.
  for (let j = 0; j < nv; j++) {
    const row = j * nu;
    const rowUp = (j + 1) * nu;
    for (let i = 0; i < nu; i++) {
      const n = (i + 1) % nu;
      b.quad(grid[row + i], grid[rowUp + i], grid[rowUp + n], grid[row + n]);
    }
    if ((j & 31) === 0) {
      if (shouldCancel?.()) throw new CancelledError();
      onProgress?.(0.6 + (j / nv) * 0.3);
    }
  }

  const boreKeyBase = nu * rings;
  const centreBottomKey = boreKeyBase + 2 * nu;
  const centreTopKey = centreBottomKey + 1;

  buildCap(b, {
    segments: nu,
    y: yBottom,
    isTop: false,
    ringVertex: (i) => grid[i],
    boreRadius,
    keys: { bore: (i) => boreKeyBase + i, centre: centreBottomKey },
  });

  buildCap(b, {
    segments: nu,
    y: yBottom + height,
    isTop: true,
    ringVertex: (i) => grid[nv * nu + i],
    boreRadius,
    keys: { bore: (i) => boreKeyBase + nu + i, centre: centreTopKey },
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

  return { mesh: b.build(), minRadius, maxRadius };
}
