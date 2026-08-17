/*
 * Copyright (c) 2026 CNCKitchen (Stefan Hermann) and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as THREE from 'three';
import { QuantizedPointMap } from './meshIndex';

const QUANT_DEFAULT = 1e6;
const FLIP_DOT      = 0.2;  // cos ~78° — reject collapse if new normal deviates more
const FLIP_DOT_SQ   = FLIP_DOT * FLIP_DOT;
const CREASE_COS    = 0.5;  // cos 60° — edges sharper than this are treated as creases
const CREASE_WEIGHT = 1e4;  // quadric penalty weight for crease edges

const DEFAULT_HARVEST_TOL = 0.005;  // mm; harvestCeil = tol²

let _lastYieldTime = 0;
function _shouldYield(): boolean {
  const now = performance.now();
  if (now - _lastYieldTime < 100) return false;
  _lastYieldTime = now;
  return true;
}
function _yieldFrame(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

export async function decimate(
  geometry: THREE.BufferGeometry,
  targetTriangles: number,
  onProgress?: (progress: number) => void,
  harvestFlat = true,
  harvestTol = DEFAULT_HARVEST_TOL,
  lockedFaces: Uint8Array | null = null
): Promise<THREE.BufferGeometry> {
  const { positions, faces, vertCount, faceCount } = buildIndexed(geometry);

  if (faceCount <= targetTriangles && !harvestFlat) {
    return buildOutput(positions, faces, faceCount);
  }

  let lockedVert: Uint8Array | null = null;
  let lockedFaceCount = 0;
  if (lockedFaces) {
    lockedVert = new Uint8Array(vertCount);
    for (let f = 0; f < faceCount; f++) {
      if (!lockedFaces[f]) continue;
      lockedFaceCount++;
      lockedVert[faces[f * 3]]     = 1;
      lockedVert[faces[f * 3 + 1]] = 1;
      lockedVert[faces[f * 3 + 2]] = 1;
    }
  }

  const lockedOverBudget = lockedVert !== null && faceCount > targetTriangles
    && lockedFaceCount >= targetTriangles;
  
  if (lockedOverBudget && !harvestFlat) {
    if (onProgress) onProgress(1);
    const out = buildOutput(positions, faces, faceCount);
    out.userData.lockedOverBudget = true;
    return out;
  }

  const quadrics = new Float64Array(vertCount * 10);
  initQuadrics(quadrics, positions, faces, faceCount);
  addCreaseQuadrics(quadrics, positions, faces, faceCount);

  const { vfHead, slotFace, slotVert, slotNext, slotPrev, faceSlot } =
    buildLinkedAdj(faces, faceCount, vertCount);

  const active  = new Uint8Array(vertCount).fill(1);
  const version = new Uint32Array(vertCount);
  const nbStamp = new Uint32Array(vertCount);
  let   epoch   = 1;
  const lkStamp = new Uint32Array(vertCount);
  let   lkEpoch = 1;
  let   activeFaces = faceCount;

  const heap     = new SoAHeap(Math.min(faceCount * 3, 1 << 24));
  const seedSeen = new QuantizedPointMap(1, Math.min(faceCount * 3, 1 << 22));
  for (let f = 0; f < faceCount; f++) {
    if (faces[f * 3] < 0) continue;
    for (let e = 0; e < 3; e++) {
      const va = faces[f * 3 + e];
      const vb = faces[f * 3 + ((e + 1) % 3)];
      if (lockedVert && (lockedVert[va] || lockedVert[vb])) continue;
      const lo = va < vb ? va : vb, hi = va < vb ? vb : va;
      seedSeen.getOrSet(lo, hi, 0, 1);
      if (seedSeen.inserted) pushEdge(heap, quadrics, positions, version, va, vb);
    }
  }

  const initFaces  = activeFaces;
  const toRemove   = Math.max(1, initFaces - targetTriangles);
  let   lastProg   = 0;
  let   iterations = 0;

  const harvestCeil   = harvestTol * harvestTol;
  let   reachedTarget = lockedOverBudget;

  while (heap.size() > 0) {
    if (activeFaces <= targetTriangles) {
      if (!harvestFlat) break;
      reachedTarget = true;
    }

    const idx = heap.pop();
    if (idx < 0) break;
    const cost = heap.getCost(idx);

    if (reachedTarget && cost > harvestCeil) break;

    ++iterations;
    if (_shouldYield()) {
      await _yieldFrame();
      if (onProgress) {
        const p = Math.min(1, (initFaces - activeFaces) / toRemove);
        if (p - lastProg > 0.005) { onProgress(p); lastProg = p; }
      }
    }

    const v1 = heap.getV1(idx), v2 = heap.getV2(idx);
    const ver1 = heap.getVer1(idx), ver2 = heap.getVer2(idx);
    const px = heap.getPx(idx), py = heap.getPy(idx), pz = heap.getPz(idx);

    if (!active[v1] || !active[v2]) continue;
    if (version[v1] !== ver1 || version[v2] !== ver2) continue;

    const nsh = sharedFaceCount(faces, vfHead, slotFace, slotNext, v1, v2);
    if (nsh < 2) continue;

    lkEpoch += 2;
    if (hasLinkViolation(faces, vfHead, slotFace, slotNext, v1, v2, lkStamp, lkEpoch)) continue;
    if (checkFlipped(positions, vfHead, slotFace, slotNext, faces, v1, v2, px, py, pz)) continue;
    if (checkFlipped(positions, vfHead, slotFace, slotNext, faces, v2, v1, px, py, pz)) continue;

    positions[v1 * 3]     = px;
    positions[v1 * 3 + 1] = py;
    positions[v1 * 3 + 2] = pz;
    mergeQuadric(quadrics, v1, v2);
    version[v1]++;

    let s = vfHead[v2];
    while (s >= 0) {
      const f     = slotFace[s];
      const sNext = slotNext[s];
      if (faces[f * 3] >= 0) {
        const cv2 = faces[f*3] === v2 ? 0 : faces[f*3+1] === v2 ? 1 : 2;
        faces[f * 3 + cv2] = v1;
        const fa = faces[f*3], fb = faces[f*3+1], fc = faces[f*3+2];
        if (fa === fb || fb === fc || fa === fc) {
          for (let k = 0; k < 3; k++) {
            const sk = faceSlot[f*3+k];
            if (sk >= 0) { _unlinkSlot(sk, vfHead, slotNext, slotPrev, slotVert); faceSlot[f*3+k] = -1; }
          }
          faces[f*3] = faces[f*3+1] = faces[f*3+2] = -1;
          activeFaces--;
        } else {
          _moveSlot(s, v1, vfHead, slotNext, slotPrev, slotVert);
        }
      }
      s = sNext;
    }
    active[v2] = 0;

    epoch++;
    for (let sv = vfHead[v1]; sv >= 0; sv = slotNext[sv]) {
      const f = slotFace[sv];
      if (faces[f*3] < 0) continue;
      for (let k = 0; k < 3; k++) {
        const nb = faces[f*3+k];
        if (nb !== v1 && nbStamp[nb] !== epoch) {
          nbStamp[nb] = epoch;
          if (active[nb] && !(lockedVert && lockedVert[nb])) {
            pushEdge(heap, quadrics, positions, version, v1, nb);
          }
        }
      }
    }
  }

  if (onProgress) onProgress(1);
  const out = buildOutput(positions, faces, faceCount);
  if (lockedOverBudget) out.userData.lockedOverBudget = true;
  return out;
}

function buildLinkedAdj(faces: Int32Array, faceCount: number, vertCount: number) {
  const S        = faceCount * 3;
  const vfHead   = new Int32Array(vertCount).fill(-1);
  const slotFace = new Int32Array(S);
  const slotVert = new Int32Array(S);
  const slotNext = new Int32Array(S).fill(-1);
  const slotPrev = new Int32Array(S).fill(-1);
  const faceSlot = new Int32Array(S).fill(-1);
  for (let f = 0; f < faceCount; f++) {
    if (faces[f * 3] < 0) continue;
    for (let k = 0; k < 3; k++) {
      const v = faces[f * 3 + k];
      const s = f * 3 + k;
      slotFace[s] = f;
      slotVert[s] = v;
      const h = vfHead[v];
      slotNext[s] = h;
      slotPrev[s] = -1;
      if (h >= 0) slotPrev[h] = s;
      vfHead[v] = s;
      faceSlot[f * 3 + k] = s;
    }
  }
  return { vfHead, slotFace, slotVert, slotNext, slotPrev, faceSlot };
}

function _unlinkSlot(
  s: number, 
  vfHead: Int32Array, 
  slotNext: Int32Array, 
  slotPrev: Int32Array, 
  slotVert: Int32Array
) {
  const v = slotVert[s], p = slotPrev[s], n = slotNext[s];
  if (p < 0) vfHead[v] = n; else slotNext[p] = n;
  if (n >= 0) slotPrev[n] = p;
}

function _moveSlot(
  s: number, 
  nv: number, 
  vfHead: Int32Array, 
  slotNext: Int32Array, 
  slotPrev: Int32Array, 
  slotVert: Int32Array
) {
  _unlinkSlot(s, vfHead, slotNext, slotPrev, slotVert);
  const h = vfHead[nv];
  slotNext[s] = h;
  slotPrev[s] = -1;
  if (h >= 0) slotPrev[h] = s;
  vfHead[nv] = s;
  slotVert[s] = nv;
}

function sharedFaceCount(
  faces: Int32Array, 
  vfHead: Int32Array, 
  slotFace: Int32Array, 
  slotNext: Int32Array, 
  v1: number, 
  v2: number
): number {
  let count = 0;
  for (let s = vfHead[v1]; s >= 0; s = slotNext[s]) {
    const f = slotFace[s];
    if (faces[f * 3] < 0) continue;
    const fa = faces[f*3], fb = faces[f*3+1], fc = faces[f*3+2];
    if (fa === v2 || fb === v2 || fc === v2) { if (++count >= 2) return 2; }
  }
  return count;
}

function hasLinkViolation(
  faces: Int32Array, 
  vfHead: Int32Array, 
  slotFace: Int32Array, 
  slotNext: Int32Array, 
  v1: number, 
  v2: number, 
  lkStamp: Uint32Array, 
  ep: number
): boolean {
  for (let s = vfHead[v1]; s >= 0; s = slotNext[s]) {
    const f = slotFace[s]; if (faces[f*3] < 0) continue;
    const a = faces[f*3], b = faces[f*3+1], c = faces[f*3+2];
    if (a !== v1) lkStamp[a] = ep;
    if (b !== v1) lkStamp[b] = ep;
    if (c !== v1) lkStamp[c] = ep;
  }
  let shared = 0;
  for (let s = vfHead[v1]; s >= 0; s = slotNext[s]) {
    const f = slotFace[s]; if (faces[f*3] < 0) continue;
    const a = faces[f*3], b = faces[f*3+1], c = faces[f*3+2];
    if (a === v2 || b === v2 || c === v2) {
      shared++;
      const apex = (a !== v1 && a !== v2) ? a : (b !== v1 && b !== v2) ? b : c;
      lkStamp[apex] = ep + 1;
    }
  }
  if (shared > 2) return true;
  for (let s = vfHead[v2]; s >= 0; s = slotNext[s]) {
    const f = slotFace[s]; if (faces[f*3] < 0) continue;
    const a = faces[f*3], b = faces[f*3+1], c = faces[f*3+2];
    if (a !== v2 && a !== v1 && lkStamp[a] === ep) return true;
    if (b !== v2 && b !== v1 && lkStamp[b] === ep) return true;
    if (c !== v2 && c !== v1 && lkStamp[c] === ep) return true;
  }
  return false;
}

function checkFlipped(
  positions: Float64Array, 
  vfHead: Int32Array, 
  slotFace: Int32Array, 
  slotNext: Int32Array, 
  faces: Int32Array, 
  vc: number, 
  vo: number, 
  npx: number, 
  npy: number, 
  npz: number
): boolean {
  for (let s = vfHead[vc]; s >= 0; s = slotNext[s]) {
    const f = slotFace[s];
    if (faces[f * 3] < 0) continue;
    const fa = faces[f*3], fb = faces[f*3+1], fc = faces[f*3+2];
    if (fa === vo || fb === vo || fc === vo) continue;
    const oax = positions[fa*3], oay = positions[fa*3+1], oaz = positions[fa*3+2];
    const obx = positions[fb*3], oby = positions[fb*3+1], obz = positions[fb*3+2];
    const ocx = positions[fc*3], ocy = positions[fc*3+1], ocz = positions[fc*3+2];
    const oux = obx-oax, ouy = oby-oay, ouz = obz-oaz;
    const ovx = ocx-oax, ovy = ocy-oay, ovz = ocz-oaz;
    const onx = ouy*ovz - ouz*ovy;
    const ony = ouz*ovx - oux*ovz;
    const onz = oux*ovy - ouy*ovx;
    let nax, nay, naz, nbx, nby, nbz, ncx, ncy, ncz;
    if (fa === vc)      { nax = npx; nay = npy; naz = npz; nbx = obx; nby = oby; nbz = obz; ncx = ocx; ncy = ocy; ncz = ocz; }
    else if (fb === vc) { nax = oax; nay = oay; naz = oaz; nbx = npx; nby = npy; nbz = npz; ncx = ocx; ncy = ocy; ncz = ocz; }
    else                { nax = oax; nay = oay; naz = oaz; nbx = obx; nby = oby; nbz = obz; ncx = npx; ncy = npy; ncz = npz; }
    const nux = nbx-nax, nuy = nby-nay, nuz = nbz-naz;
    const nvx = ncx-nax, nvy = ncy-nay, nvz = ncz-naz;
    const nnx = nuy*nvz - nuz*nvy;
    const nny = nuz*nvx - nux*nvz;
    const nnz = nux*nvy - nuy*nvx;
    const rawDot = onx*nnx + ony*nny + onz*nnz;
    if (rawDot < 0) return true;
    if (rawDot * rawDot < FLIP_DOT_SQ * (onx*onx+ony*ony+onz*onz) * (nnx*nnx+nny*nny+nnz*nnz)) return true;
  }
  return false;
}

function addCreaseQuadrics(
  quadrics: Float64Array, 
  positions: Float64Array, 
  faces: Int32Array, 
  faceCount: number
) {
  const maxEdges = faceCount * 3;
  const edgeIdx = new QuantizedPointMap(1, Math.min(maxEdges, 1 << 22));
  const edgeVa  = new Int32Array(maxEdges);
  const edgeVb  = new Int32Array(maxEdges);
  const edgeF0  = new Int32Array(maxEdges);
  const edgeF1  = new Int32Array(maxEdges);
  const edgeNum = new Uint8Array(maxEdges);
  let edgeCount = 0;
  for (let f = 0; f < faceCount; f++) {
    if (faces[f * 3] < 0) continue;
    for (let e = 0; e < 3; e++) {
      const va = faces[f * 3 + e];
      const vb = faces[f * 3 + ((e + 1) % 3)];
      const lo = va < vb ? va : vb, hi = va < vb ? vb : va;
      const ei = edgeIdx.getOrSet(lo, hi, 0, edgeCount);
      if (edgeIdx.inserted) {
        edgeVa[ei] = lo; edgeVb[ei] = hi; edgeF0[ei] = f; edgeNum[ei] = 1;
        edgeCount++;
      } else if (edgeNum[ei] === 1) {
        edgeF1[ei] = f; edgeNum[ei] = 2;
      } else {
        edgeNum[ei] = 3;
      }
    }
  }

  const sqrtW = Math.sqrt(CREASE_WEIGHT);

  for (let ei = 0; ei < edgeCount; ei++) {
    if (edgeNum[ei] !== 2) continue;
    const f0 = edgeF0[ei];
    const f1 = edgeF1[ei];
    const v0a = faces[f0*3], v0b = faces[f0*3+1], v0c = faces[f0*3+2];
    const v1a = faces[f1*3], v1b = faces[f1*3+1], v1c = faces[f1*3+2];

    let ux = positions[v0b*3] - positions[v0a*3], uy = positions[v0b*3+1] - positions[v0a*3+1], uz = positions[v0b*3+2] - positions[v0a*3+2];
    let vx = positions[v0c*3] - positions[v0a*3], vy = positions[v0c*3+1] - positions[v0a*3+1], vz = positions[v0c*3+2] - positions[v0a*3+2];
    let cnx = uy * vz - uz * vy, cny = uz * vx - ux * vz, cnz = ux * vy - uy * vx;
    let clen = Math.sqrt(cnx * cnx + cny * cny + cnz * cnz) || 1;
    const n0x = cnx / clen, n0y = cny / clen, n0z = cnz / clen;

    ux = positions[v1b*3] - positions[v1a*3]; uy = positions[v1b*3+1] - positions[v1a*3+1]; uz = positions[v1b*3+2] - positions[v1a*3+2];
    vx = positions[v1c*3] - positions[v1a*3]; vy = positions[v1c*3+1] - positions[v1a*3+1]; vz = positions[v1c*3+2] - positions[v1a*3+2];
    cnx = uy * vz - uz * vy; cny = uz * vx - ux * vz; cnz = ux * vy - uy * vx;
    clen = Math.sqrt(cnx * cnx + cny * cny + cnz * cnz) || 1;
    const n1x = cnx / clen, n1y = cny / clen, n1z = cnz / clen;

    if (n0x*n1x + n0y*n1y + n0z*n1z >= CREASE_COS) continue;

    const va = edgeVa[ei];
    const vb = edgeVb[ei];

    const ex = positions[vb*3]   - positions[va*3];
    const ey = positions[vb*3+1] - positions[va*3+1];
    const ez = positions[vb*3+2] - positions[va*3+2];
    const elen = Math.sqrt(ex*ex + ey*ey + ez*ez) || 1;
    const edx = ex / elen, edy = ey / elen, edz = ez / elen;

    for (let pi = 0; pi < 2; pi++) {
      const nx = pi === 0 ? n0x : n1x, ny = pi === 0 ? n0y : n1y, nz = pi === 0 ? n0z : n1z;
      let px = ny*edz - nz*edy;
      let py = nz*edx - nx*edz;
      let pz = nx*edy - ny*edx;
      const plen = Math.sqrt(px*px + py*py + pz*pz);
      if (plen < 1e-10) continue;
      px /= plen; py /= plen; pz /= plen;
      const d = -(px*positions[va*3] + py*positions[va*3+1] + pz*positions[va*3+2]);
      addPlaneQ(quadrics, va, px*sqrtW, py*sqrtW, pz*sqrtW, d*sqrtW);
      addPlaneQ(quadrics, vb, px*sqrtW, py*sqrtW, pz*sqrtW, d*sqrtW);
    }
  }
}

function initQuadrics(
  quadrics: Float64Array, 
  positions: Float64Array, 
  faces: Int32Array, 
  faceCount: number
) {
  for (let f = 0; f < faceCount; f++) {
    if (faces[f * 3] < 0) continue;
    const fa = faces[f * 3], fb = faces[f * 3 + 1], fc = faces[f * 3 + 2];
    const ux = positions[fb*3] - positions[fa*3], uy = positions[fb*3+1] - positions[fa*3+1], uz = positions[fb*3+2] - positions[fa*3+2];
    const vx = positions[fc*3] - positions[fa*3], vy = positions[fc*3+1] - positions[fa*3+1], vz = positions[fc*3+2] - positions[fa*3+2];
    const cnx = uy * vz - uz * vy, cny = uz * vx - ux * vz, cnz = ux * vy - uy * vx;
    const len = Math.sqrt(cnx * cnx + cny * cny + cnz * cnz) || 1;
    const nx = cnx / len, ny = cny / len, nz = cnz / len;
    const d = -(nx * positions[fa*3] + ny * positions[fa*3+1] + nz * positions[fa*3+2]);
    addPlaneQ(quadrics, fa, nx, ny, nz, d);
    addPlaneQ(quadrics, fb, nx, ny, nz, d);
    addPlaneQ(quadrics, fc, nx, ny, nz, d);
  }
}

function addPlaneQ(q: Float64Array, v: number, a: number, b: number, c: number, d: number) {
  const o = v * 10;
  q[o]   += a*a; q[o+1] += a*b; q[o+2] += a*c; q[o+3] += a*d;
                 q[o+4] += b*b; q[o+5] += b*c; q[o+6] += b*d;
                                q[o+7] += c*c; q[o+8] += c*d;
                                               q[o+9] += d*d;
}

function mergeQuadric(q: Float64Array, v1: number, v2: number) {
  const o1 = v1 * 10, o2 = v2 * 10;
  for (let i = 0; i < 10; i++) q[o1 + i] += q[o2 + i];
}

function evalQ(q: Float64Array, v: number, x: number, y: number, z: number): number {
  const o = v * 10;
  return q[o]   * x*x + 2*q[o+1]*x*y + 2*q[o+2]*x*z + 2*q[o+3]*x
       + q[o+4] * y*y + 2*q[o+5]*y*z + 2*q[o+6]*y
       + q[o+7] * z*z + 2*q[o+8]*z
       + q[o+9];
}

function evalQSum(q: Float64Array, v1: number, v2: number, x: number, y: number, z: number): number {
  return evalQ(q, v1, x, y, z) + evalQ(q, v2, x, y, z);
}

const _s = new Float64Array(3);

function solveQ(q: Float64Array, v1: number, v2: number): boolean {
  const o1 = v1 * 10, o2 = v2 * 10;
  const a00 = q[o1]   + q[o2];
  const a01 = q[o1+1] + q[o2+1];
  const a02 = q[o1+2] + q[o2+2];
  const a11 = q[o1+4] + q[o2+4];
  const a12 = q[o1+5] + q[o2+5];
  const a22 = q[o1+7] + q[o2+7];
  const b0  = -(q[o1+3] + q[o2+3]);
  const b1  = -(q[o1+6] + q[o2+6]);
  const b2  = -(q[o1+8] + q[o2+8]);

  const det = a00*(a11*a22 - a12*a12) - a01*(a01*a22 - a12*a02) + a02*(a01*a12 - a11*a02);
  const maxEl = Math.max(Math.abs(a00), Math.abs(a01), Math.abs(a02), Math.abs(a11), Math.abs(a12), Math.abs(a22));
  const threshold = maxEl * maxEl * maxEl * 1e-10;
  if (Math.abs(det) < Math.max(threshold, 1e-30)) return false;

  const inv = 1 / det;
  _s[0] = inv * (b0*(a11*a22 - a12*a12) - a01*(b1*a22 - a12*b2) + a02*(b1*a12 - a11*b2));
  _s[1] = inv * (a00*(b1*a22 - a12*b2) - b0*(a01*a22 - a12*a02) + a02*(a01*b2 - b1*a02));
  _s[2] = inv * (a00*(a11*b2 - b1*a12) - a01*(a01*b2 - b1*a02) + b0*(a01*a12 - a11*a02));
  return true;
}

function pushEdge(
  heap: SoAHeap, 
  quadrics: Float64Array, 
  positions: Float64Array, 
  version: Uint32Array, 
  v1: number, 
  v2: number
) {
  let px, py, pz;

  if (solveQ(quadrics, v1, v2)) {
    px = _s[0]; py = _s[1]; pz = _s[2];
  } else {
    const mx = (positions[v1*3]   + positions[v2*3])   / 2;
    const my = (positions[v1*3+1] + positions[v2*3+1]) / 2;
    const mz = (positions[v1*3+2] + positions[v2*3+2]) / 2;
    const e1 = evalQSum(quadrics, v1, v2, positions[v1*3],   positions[v1*3+1], positions[v1*3+2]);
    const e2 = evalQSum(quadrics, v1, v2, positions[v2*3],   positions[v2*3+1], positions[v2*3+2]);
    const em = evalQSum(quadrics, v1, v2, mx, my, mz);
    const eMin = Math.min(e1, e2, em);
    const eTol = eMin * 1e-2 + 1e-12;
    if      (em <= eMin + eTol) { px = mx; py = my; pz = mz; }
    else if (e1 <= e2)          { px = positions[v1*3]; py = positions[v1*3+1]; pz = positions[v1*3+2]; }
    else                        { px = positions[v2*3]; py = positions[v2*3+1]; pz = positions[v2*3+2]; }
  }

  const cost = evalQSum(quadrics, v1, v2, px, py, pz);
  const dx = positions[v2*3] - positions[v1*3];
  const dy = positions[v2*3+1] - positions[v1*3+1];
  const dz = positions[v2*3+2] - positions[v1*3+2];
  heap.push(cost + (dx*dx + dy*dy + dz*dz) * 1e-8,
            v1, v2, version[v1], version[v2], px, py, pz);
}

function buildIndexed(geometry: THREE.BufferGeometry) {
  const QUANT = QUANT_DEFAULT;
  const posAttr = geometry.attributes.position;
  const n = posAttr.count;

  const positions  = new Float64Array(n * 3);
  const indexRemap = new Int32Array(n);
  let   vertCount  = 0;

  const vertMap = new QuantizedPointMap(QUANT, Math.min(n, 1 << 22));

  for (let i = 0; i < n; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    const idx = vertMap.getOrSet(x, y, z, vertCount);
    if (vertMap.inserted) {
      vertCount++;
      positions[idx * 3]     = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;
    }
    indexRemap[i] = idx;
  }

  const faceCount = n / 3;
  const faces = new Int32Array(faceCount * 3);
  for (let i = 0; i < n; i++) faces[i] = indexRemap[i];

  return { positions: positions.subarray(0, vertCount * 3), faces, vertCount, faceCount };
}

function buildOutput(
  positions: Float64Array, 
  faces: Int32Array, 
  faceCount: number
): THREE.BufferGeometry {
  let activeFaces = 0;
  for (let f = 0; f < faceCount; f++) {
    if (faces[f * 3] >= 0) activeFaces++;
  }

  const posArray = new Float32Array(activeFaces * 9);
  let out = 0;
  for (let f = 0; f < faceCount; f++) {
    if (faces[f * 3] < 0) continue;
    for (let v = 0; v < 3; v++) {
      const vi = faces[f * 3 + v];
      posArray[out++] = positions[vi * 3];
      posArray[out++] = positions[vi * 3 + 1];
      posArray[out++] = positions[vi * 3 + 2];
    }
  }

  const nrmArray = new Float32Array(posArray.length);
  for (let i = 0; i < posArray.length; i += 9) {
    const ax = posArray[i],   ay = posArray[i+1], az = posArray[i+2];
    const bx = posArray[i+3], by = posArray[i+4], bz = posArray[i+5];
    const cx = posArray[i+6], cy = posArray[i+7], cz = posArray[i+8];
    const ux = bx-ax, uy = by-ay, uz = bz-az;
    const vx = cx-ax, vy = cy-ay, vz = cz-az;
    const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
    nrmArray[i]   = nrmArray[i+3] = nrmArray[i+6] = nx / len;
    nrmArray[i+1] = nrmArray[i+4] = nrmArray[i+7] = ny / len;
    nrmArray[i+2] = nrmArray[i+5] = nrmArray[i+8] = nz / len;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(nrmArray, 3));
  return geo;
}

const SOA_GROW = 1.5;
class SoAHeap {
  _cap: number;
  _len: number;
  _cost: Float64Array;
  _v1: Int32Array;
  _v2: Int32Array;
  _ver1: Uint32Array;
  _ver2: Uint32Array;
  _px: Float64Array;
  _py: Float64Array;
  _pz: Float64Array;

  constructor(initialCap = 65536) {
    let cap = 2;
    while (cap <= initialCap) cap <<= 1;
    this._cap  = cap;
    this._len  = 0;
    this._cost = new Float64Array(cap);
    this._v1   = new Int32Array(cap);
    this._v2   = new Int32Array(cap);
    this._ver1 = new Uint32Array(cap);
    this._ver2 = new Uint32Array(cap);
    this._px   = new Float64Array(cap);
    this._py   = new Float64Array(cap);
    this._pz   = new Float64Array(cap);
  }

  size() { return this._len; }

  push(cost: number, v1: number, v2: number, ver1: number, ver2: number, px: number, py: number, pz: number) {
    let i = ++this._len;
    if (i >= this._cap) this._grow();
    this._cost[i] = cost; this._v1[i] = v1; this._v2[i] = v2;
    this._ver1[i] = ver1; this._ver2[i] = ver2;
    this._px[i] = px; this._py[i] = py; this._pz[i] = pz;
    this._bubbleUp(i);
  }

  pop() {
    if (this._len === 0) return -1;
    this._copySlot(0, 1);
    this._copySlot(1, this._len--);
    if (this._len > 0) this._sinkDown(1);
    return 0;
  }

  getCost(i: number) { return this._cost[i]; }
  getV1  (i: number) { return this._v1[i]; }
  getV2  (i: number) { return this._v2[i]; }
  getVer1(i: number) { return this._ver1[i]; }
  getVer2(i: number) { return this._ver2[i]; }
  getPx  (i: number) { return this._px[i]; }
  getPy  (i: number) { return this._py[i]; }
  getPz  (i: number) { return this._pz[i]; }

  _copySlot(dst: number, src: number) {
    this._cost[dst] = this._cost[src]; this._v1[dst] = this._v1[src]; this._v2[dst] = this._v2[src];
    this._ver1[dst] = this._ver1[src]; this._ver2[dst] = this._ver2[src];
    this._px[dst]   = this._px[src];   this._py[dst]   = this._py[src];   this._pz[dst]   = this._pz[src];
  }

  _bubbleUp(idx: number) {
    const cost = this._cost[idx];
    const v1 = this._v1[idx], v2 = this._v2[idx];
    const ver1 = this._ver1[idx], ver2 = this._ver2[idx];
    const px = this._px[idx], py = this._py[idx], pz = this._pz[idx];

    while (idx > 1) {
      const parent = idx >> 1;
      if (this._cost[parent] <= cost) break;
      this._cost[idx] = this._cost[parent];
      this._v1[idx] = this._v1[parent]; this._v2[idx] = this._v2[parent];
      this._ver1[idx] = this._ver1[parent]; this._ver2[idx] = this._ver2[parent];
      this._px[idx] = this._px[parent]; this._py[idx] = this._py[parent]; this._pz[idx] = this._pz[parent];
      idx = parent;
    }
    this._cost[idx] = cost;
    this._v1[idx] = v1; this._v2[idx] = v2;
    this._ver1[idx] = ver1; this._ver2[idx] = ver2;
    this._px[idx] = px; this._py[idx] = py; this._pz[idx] = pz;
  }

  _sinkDown(idx: number) {
    const n = this._len;
    const cost = this._cost[idx];
    const v1 = this._v1[idx], v2 = this._v2[idx];
    const ver1 = this._ver1[idx], ver2 = this._ver2[idx];
    const px = this._px[idx], py = this._py[idx], pz = this._pz[idx];

    while (true) {
      const l = idx << 1, r = l | 1;
      let child = -1;
      if (l <= n && this._cost[l] < cost) child = l;
      if (r <= n && this._cost[r] < (child >= 0 ? this._cost[child] : cost)) child = r;
      if (child < 0) break;
      this._cost[idx] = this._cost[child];
      this._v1[idx] = this._v1[child]; this._v2[idx] = this._v2[child];
      this._ver1[idx] = this._ver1[child]; this._ver2[idx] = this._ver2[child];
      this._px[idx] = this._px[child]; this._py[idx] = this._py[child]; this._pz[idx] = this._pz[child];
      idx = child;
    }
    this._cost[idx] = cost;
    this._v1[idx] = v1; this._v2[idx] = v2;
    this._ver1[idx] = ver1; this._ver2[idx] = ver2;
    this._px[idx] = px; this._py[idx] = py; this._pz[idx] = pz;
  }

  _grow() {
    const newCap = Math.ceil(this._cap * SOA_GROW) + 2;
    const resize = (old: any, Ctor: any) => { const n = new Ctor(newCap); n.set(old); return n; };
    this._cost = resize(this._cost, Float64Array);
    this._v1   = resize(this._v1,   Int32Array);
    this._v2   = resize(this._v2,   Int32Array);
    this._ver1 = resize(this._ver1, Uint32Array);
    this._ver2 = resize(this._ver2, Uint32Array);
    this._px   = resize(this._px,   Float64Array);
    this._py   = resize(this._py,   Float64Array);
    this._pz   = resize(this._pz,   Float64Array);
    this._cap  = newCap;
  }
}
