import { MeshBuilder } from '../mesh/MeshBuilder';
import { TWO_PI } from '../constants';

export interface BoreOptions {
  segments: number;
  radius: number;
  yBottom: number;
  yTop: number;
  /** Key of the bore vertex at angular index i on the bottom rim. */
  bottomKey: (i: number) => number;
  /** Key of the bore vertex at angular index i on the top rim. */
  topKey: (i: number) => number;
}

/**
 * The axle hole wall.
 *
 * This is real geometry, not a boolean subtraction: the hole exists because
 * the shell has an inward-facing cylindrical surface, and the caps are
 * annuli that terminate on it.
 *
 * Normals point *toward the axis*, because "outward from the material" for a
 * hole means into the empty space. Getting this backwards is the single most
 * common cause of slicers demanding a repair, so the winding below is derived
 * rather than guessed: for a quad (b_i, b_i+1, t_i+1, t_i) at increasing
 * theta with yTop > yBottom, the cross product resolves to -radial.
 */
export function buildBore(b: MeshBuilder, opts: BoreOptions): void {
  const { segments, radius, yBottom, yTop, bottomKey, topKey } = opts;

  const bottom = new Int32Array(segments);
  const top = new Int32Array(segments);
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * TWO_PI;
    const x = radius * Math.cos(theta);
    const z = radius * Math.sin(theta);
    bottom[i] = b.vertex(bottomKey(i), x, yBottom, z);
    top[i] = b.vertex(topKey(i), x, yTop, z);
  }

  for (let i = 0; i < segments; i++) {
    const n = (i + 1) % segments;
    b.quad(bottom[i], bottom[n], top[n], top[i]);
  }
}
