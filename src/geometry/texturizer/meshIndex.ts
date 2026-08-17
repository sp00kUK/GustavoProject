/**
 * meshIndex.ts — shared vertex welding for the mesh pipeline.
 *
 * Every pipeline stage needs the same primitive: map a 3D position, quantised
 * onto a grid, to a small integer id so that bit-different copies of "the same
 * point" (non-indexed triangle soup, float round-trip noise) collapse to one
 * vertex.
 *
 * QuantizedPointMap replaces string map with an open-addressing hash table over
 * typed arrays: zero allocation per lookup, exact integer key comparison.
 * Quantised components are stored as Float64 (integers are exact in f64), so
 * coordinates of any magnitude behave identically to the old string keys.
 *
 * Values must be integers in [0, 2^31-1] (vertex/canonical ids). -1 is the
 * internal "empty" sentinel and is returned by get() on a miss.
 */

export class QuantizedPointMap {
  public quant: number;
  public inserted: boolean;
  private _size: number;
  private _cap!: number;
  private _mask!: number;
  private _qx!: Float64Array;
  private _qy!: Float64Array;
  private _qz!: Float64Array;
  private _val!: Int32Array;

  /**
   * @param quant     – grid multiplier (e.g. 1e5 → 10 µm cells)
   * @param expected  – expected number of unique points (sizing hint)
   */
  constructor(quant: number, expected: number = 256) {
    this.quant = quant;
    this.inserted = false;
    this._size = 0;
    let cap = 16;
    const target = Math.max(16, Math.ceil(expected / 0.6));
    while (cap < target) cap *= 2;
    this._alloc(cap);
  }

  get size(): number {
    return this._size;
  }

  private _alloc(cap: number): void {
    this._cap = cap;
    this._mask = cap - 1;
    this._qx = new Float64Array(cap);
    this._qy = new Float64Array(cap);
    this._qz = new Float64Array(cap);
    this._val = new Int32Array(cap).fill(-1);
  }

  private _slot(qx: number, qy: number, qz: number): number {
    // Mix the (wrapped-to-32-bit) quantised components; equality is checked
    // against the exact f64-stored values, so hash wrapping is harmless.
    let h = Math.imul(qx | 0, 0x9E3779B1) ^ Math.imul(qy | 0, 0x85EBCA77) ^ Math.imul(qz | 0, 0xC2B2AE3D);
    h ^= h >>> 15;
    let i = h & this._mask;
    const qxA = this._qx, qyA = this._qy, qzA = this._qz, val = this._val, mask = this._mask;
    while (val[i] !== -1) {
      if (qxA[i] === qx && qyA[i] === qy && qzA[i] === qz) return i;
      i = (i + 1) & mask;
    }
    return i;
  }

  private _grow(): void {
    const oqx = this._qx, oqy = this._qy, oqz = this._qz, oval = this._val, ocap = this._cap;
    this._alloc(ocap * 2);
    for (let i = 0; i < ocap; i++) {
      if (oval[i] === -1) continue;
      const s = this._slot(oqx[i], oqy[i], oqz[i]);
      this._qx[s] = oqx[i];
      this._qy[s] = oqy[i];
      this._qz[s] = oqz[i];
      this._val[s] = oval[i];
    }
  }

  /** Value stored for (x,y,z)'s grid cell, or -1 if absent. */
  public get(x: number, y: number, z: number): number {
    const q = this.quant;
    const i = this._slot(Math.round(x * q), Math.round(y * q), Math.round(z * q));
    return this._val[i];
  }

  /**
   * Return the value already stored for (x,y,z)'s grid cell; if absent, store
   * `value` and return it.  `this.inserted` tells which case occurred.
   */
  public getOrSet(x: number, y: number, z: number, value: number): number {
    const q = this.quant;
    const qx = Math.round(x * q), qy = Math.round(y * q), qz = Math.round(z * q);
    const i = this._slot(qx, qy, qz);
    const existing = this._val[i];
    if (existing !== -1) {
      this.inserted = false;
      return existing;
    }
    this._qx[i] = qx;
    this._qy[i] = qy;
    this._qz[i] = qz;
    this._val[i] = value;
    this.inserted = true;
    if (++this._size > this._cap * 0.7) this._grow();
    return value;
  }
}

/**
 * Weld a non-indexed position buffer: assign each vertex the sequential id of
 * its quantised position (first occurrence wins).
 *
 * @param pos  – flat [x,y,z,...] positions
 * @param count                   – vertex count (pos.length / 3)
 * @param quant                   – grid multiplier
 * @returns {{ vertexId: Uint32Array, uniqueCount: number }}
 */
export function weldVertices(pos: Float32Array | Float64Array, count: number, quant: number): { vertexId: Uint32Array; uniqueCount: number } {
  const map = new QuantizedPointMap(quant, Math.min(count, 1 << 22));
  const vertexId = new Uint32Array(count);
  let nextId = 0;
  for (let i = 0; i < count; i++) {
    const id = map.getOrSet(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nextId);
    if (map.inserted) nextId++;
    vertexId[i] = id;
  }
  return { vertexId, uniqueCount: nextId };
}
