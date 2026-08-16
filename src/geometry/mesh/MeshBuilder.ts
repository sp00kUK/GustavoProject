import type { PrintableMesh } from '../../types';
import { MAX_TRIANGLES } from '../constants';

/**
 * Growable indexed triangle mesh accumulator.
 *
 * Vertices are added with an explicit integer `key`. The kernel always knows
 * the exact lattice a vertex sits on (angular index, height index, radius
 * level), so identity is decided by that integer - never by hashing floating
 * point coordinates. That is what makes the output watertight by construction
 * rather than by a post-hoc weld pass.
 *
 * Pass `key = -1` for vertices that are deliberately unshared.
 */
export class MeshBuilder {
  private px: Float64Array;
  private py: Float64Array;
  private pz: Float64Array;
  private vertexCount = 0;

  private idx: Uint32Array;
  private indexCount = 0;

  private readonly keyToIndex = new Map<number, number>();

  constructor(vertexCapacity = 1024, triangleCapacity = 2048) {
    this.px = new Float64Array(vertexCapacity);
    this.py = new Float64Array(vertexCapacity);
    this.pz = new Float64Array(vertexCapacity);
    this.idx = new Uint32Array(triangleCapacity * 3);
  }

  get vertices(): number {
    return this.vertexCount;
  }

  get triangles(): number {
    return this.indexCount / 3;
  }

  /** Add (or reuse) a vertex identified by `key`. Returns its index. */
  vertex(key: number, x: number, y: number, z: number): number {
    if (key >= 0) {
      const existing = this.keyToIndex.get(key);
      if (existing !== undefined) return existing;
    }
    const i = this.vertexCount;
    if (i >= this.px.length) this.growVertices();
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vertexCount = i + 1;
    if (key >= 0) this.keyToIndex.set(key, i);
    return i;
  }

  /** Look up a previously added keyed vertex, or -1. */
  find(key: number): number {
    const v = this.keyToIndex.get(key);
    return v === undefined ? -1 : v;
  }

  triangle(a: number, b: number, c: number): void {
    if (a === b || b === c || a === c) return; // topologically degenerate
    const n = this.indexCount;
    if (n + 3 > this.idx.length) this.growIndices();
    this.idx[n] = a;
    this.idx[n + 1] = b;
    this.idx[n + 2] = c;
    this.indexCount = n + 3;
  }

  /** Quad a-b-c-d wound counter-clockwise when seen from outside. */
  quad(a: number, b: number, c: number, d: number): void {
    this.triangle(a, b, c);
    this.triangle(a, c, d);
  }

  private growVertices(): void {
    const next = Math.max(16, this.px.length * 2);
    const nx = new Float64Array(next);
    const ny = new Float64Array(next);
    const nz = new Float64Array(next);
    nx.set(this.px);
    ny.set(this.py);
    nz.set(this.pz);
    this.px = nx;
    this.py = ny;
    this.pz = nz;
  }

  private growIndices(): void {
    const next = Math.max(48, this.idx.length * 2);
    if (next / 3 > MAX_TRIANGLES) {
      throw new Error(
        `Mesh exceeded the ${MAX_TRIANGLES.toLocaleString()} triangle safety ceiling. ` +
          `Reduce mesh detail, cylinder size, or pattern repeats.`,
      );
    }
    const ni = new Uint32Array(next);
    ni.set(this.idx);
    this.idx = ni;
  }

  /**
   * Emit the finished mesh. Positions are narrowed to Float32 here - all
   * arithmetic up to this point ran in full double precision.
   */
  build(): PrintableMesh {
    const positions = new Float32Array(this.vertexCount * 3);
    for (let i = 0; i < this.vertexCount; i++) {
      positions[i * 3] = this.px[i];
      positions[i * 3 + 1] = this.py[i];
      positions[i * 3 + 2] = this.pz[i];
    }
    const indices = new Uint32Array(this.indexCount);
    indices.set(this.idx.subarray(0, this.indexCount));
    return { positions, indices };
  }
}
