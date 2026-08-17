/**
 * exclusion.ts — per-face exclusion masking
 *
 * Ported 1:1 from Bumpmesh (stlTexturizer) exclusion.js
 *
 * Provides:
 *  1. buildAdjacency   – inter-triangle adjacency list with dihedral angles
 *  2. bucketFill       – BFS flood fill respecting max dihedral-angle threshold
 *  3. buildExclusionOverlayGeo – compact geometry for the orange preview overlay
 *  4. buildFaceWeights – per-vertex exclusion weights for the subdivision pass
 */

import * as THREE from 'three';

// ── Adjacency & centroids ─────────────────────────────────────────────────────

export interface AdjacencyEntry {
  neighbor: number;
  angle: number;
}

export interface AdjacencyData {
  adjacency: AdjacencyEntry[][];
  centroids: Float32Array;
  boundRadii: Float32Array;
  faceNormals: Float32Array;
  openEdgeCount: number;
  nonManifoldEdgeCount: number;
}

const QUANT = 1e4;

/** Quantize a float coordinate into an integer grid cell. */
function quantize(v: number): number {
  return Math.round(v * QUANT);
}

/** Hash three quantized coordinates into a string key. */
function pointKey(x: number, y: number, z: number): string {
  return `${quantize(x)},${quantize(y)},${quantize(z)}`;
}

/**
 * Build inter-triangle adjacency data for a BufferGeometry.
 * Works on both indexed and non-indexed geometry.
 */
export function buildAdjacency(geometry: THREE.BufferGeometry): AdjacencyData {
  const posAttr = geometry.attributes.position;
  const indexAttr = geometry.index;

  // For indexed geometry, we need to work with faces
  const triCount = indexAttr
    ? indexAttr.count / 3
    : posAttr.count / 3;

  // Pre-allocate face normals, centroids, and per-triangle bounding radii
  const faceNormals = new Float32Array(triCount * 3);
  const centroids = new Float32Array(triCount * 3);
  const boundRadii = new Float32Array(triCount);

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();

  const getVertex = (faceIdx: number, vertInFace: number): number => {
    if (indexAttr) {
      return indexAttr.getX(faceIdx * 3 + vertInFace);
    }
    return faceIdx * 3 + vertInFace;
  };

  for (let t = 0; t < triCount; t++) {
    const i0 = getVertex(t, 0);
    const i1 = getVertex(t, 1);
    const i2 = getVertex(t, 2);

    vA.fromBufferAttribute(posAttr, i0);
    vB.fromBufferAttribute(posAttr, i1);
    vC.fromBufferAttribute(posAttr, i2);

    e1.subVectors(vB, vA);
    e2.subVectors(vC, vA);
    fn.crossVectors(e1, e2).normalize();

    const base = t * 3;
    faceNormals[base] = fn.x;
    faceNormals[base + 1] = fn.y;
    faceNormals[base + 2] = fn.z;

    const cx = (vA.x + vB.x + vC.x) / 3;
    const cy = (vA.y + vB.y + vC.y) / 3;
    const cz = (vA.z + vB.z + vC.z) / 3;
    centroids[base] = cx;
    centroids[base + 1] = cy;
    centroids[base + 2] = cz;

    const dA = (vA.x - cx) ** 2 + (vA.y - cy) ** 2 + (vA.z - cz) ** 2;
    const dB = (vB.x - cx) ** 2 + (vB.y - cy) ** 2 + (vB.z - cz) ** 2;
    const dC = (vC.x - cx) ** 2 + (vC.y - cy) ** 2 + (vC.z - cz) ** 2;
    boundRadii[t] = Math.sqrt(Math.max(dA, dB, dC));
  }

  // Build edge → triangle list
  // Vertex-dedup pass: assign a numeric ID to each unique quantised position
  const posToId = new Map<string, number>();
  let nextId = 0;
  const vertId = new Uint32Array(triCount * 3);

  for (let t = 0; t < triCount; t++) {
    for (let v = 0; v < 3; v++) {
      const vi = getVertex(t, v);
      const key = pointKey(
        posAttr.getX(vi),
        posAttr.getY(vi),
        posAttr.getZ(vi),
      );
      let id = posToId.get(key);
      if (id === undefined) {
        id = nextId++;
        posToId.set(key, id);
      }
      vertId[t * 3 + v] = id;
    }
  }

  const numEdgeKey = (a: number, b: number): number =>
    a < b ? a * nextId + b : b * nextId + a;

  const edgeMap = new Map<number, number[]>();
  const edgePairs = [0, 1, 0, 2, 1, 2]; // vertex-index pairs within triangle

  for (let t = 0; t < triCount; t++) {
    const base = t * 3;
    for (let ep = 0; ep < 6; ep += 2) {
      const ek = numEdgeKey(
        vertId[base + edgePairs[ep]],
        vertId[base + edgePairs[ep + 1]],
      );
      const entry = edgeMap.get(ek);
      if (entry) entry.push(t);
      else edgeMap.set(ek, [t]);
    }
  }

  // Convert edge map to adjacency list with per-edge dihedral angle
  const adjacency: AdjacencyEntry[][] = new Array(triCount);
  for (let t = 0; t < triCount; t++) adjacency[t] = [];

  let openEdgeCount = 0;
  let nonManifoldEdgeCount = 0;

  for (const [, tris] of edgeMap) {
    if (tris.length === 1) { openEdgeCount++; continue; }
    if (tris.length > 2) nonManifoldEdgeCount++;
    const [a, b] = tris;
    const nAx = faceNormals[a * 3], nAy = faceNormals[a * 3 + 1], nAz = faceNormals[a * 3 + 2];
    const nBx = faceNormals[b * 3], nBy = faceNormals[b * 3 + 1], nBz = faceNormals[b * 3 + 2];
    const dot = Math.max(-1, Math.min(1, nAx * nBx + nAy * nBy + nAz * nBz));
    const angleDeg = Math.acos(dot) * (180 / Math.PI);
    adjacency[a].push({ neighbor: b, angle: angleDeg });
    adjacency[b].push({ neighbor: a, angle: angleDeg });
  }

  return { adjacency, centroids, boundRadii, faceNormals, openEdgeCount, nonManifoldEdgeCount };
}

// ── Bucket fill ───────────────────────────────────────────────────────────────

/**
 * BFS flood fill starting from seedTriIdx.
 * Spreads across edges whose dihedral angle ≤ thresholdDeg.
 */
export function bucketFill(
  seedTriIdx: number,
  adjacency: AdjacencyEntry[][],
  thresholdDeg: number,
): Set<number> {
  const visited = new Set([seedTriIdx]);
  const queue = [seedTriIdx];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const neighbors = adjacency[cur];
    if (!neighbors) continue;
    for (const { neighbor, angle } of neighbors) {
      if (!visited.has(neighbor) && angle <= thresholdDeg) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

// ── Overlay geometry ──────────────────────────────────────────────────────────

/**
 * Build a compact non-indexed BufferGeometry for an overlay.
 * Works with both indexed and non-indexed source geometry.
 */
export function buildExclusionOverlayGeo(
  geometry: THREE.BufferGeometry,
  faceSet: Set<number>,
  invert = false,
): THREE.BufferGeometry {
  const posAttr = geometry.attributes.position;
  const normAttr = geometry.attributes.normal;
  const indexAttr = geometry.index;

  const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

  const count = invert ? triCount - faceSet.size : faceSet.size;
  const outPos = new Float32Array(count * 9);
  const outNrm = normAttr ? new Float32Array(count * 9) : null;

  let dst = 0;

  for (let t = 0; t < triCount; t++) {
    const include = faceSet.has(t);
    if (invert ? include : !include) continue;

    for (let v = 0; v < 3; v++) {
      const vi = indexAttr ? indexAttr.getX(t * 3 + v) : t * 3 + v;
      outPos[dst] = posAttr.getX(vi);
      outPos[dst + 1] = posAttr.getY(vi);
      outPos[dst + 2] = posAttr.getZ(vi);
      if (outNrm && normAttr) {
        outNrm[dst] = normAttr.getX(vi);
        outNrm[dst + 1] = normAttr.getY(vi);
        outNrm[dst + 2] = normAttr.getZ(vi);
      }
      dst += 3;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
  if (outNrm) geo.setAttribute('normal', new THREE.BufferAttribute(outNrm, 3));
  return geo;
}

// ── Radius brush helper ────────────────────────────────────────────────────────

/**
 * Find all triangles whose centroid is within `radius` of `hitPoint`.
 * Uses the pre-computed centroids array from buildAdjacency.
 */
export function radiusBrushSelect(
  hitPoint: THREE.Vector3,
  radius: number,
  centroids: Float32Array,
  triCount: number,
): Set<number> {
  const r2 = radius * radius;
  const result = new Set<number>();
  for (let t = 0; t < triCount; t++) {
    const base = t * 3;
    const dx = centroids[base] - hitPoint.x;
    const dy = centroids[base + 1] - hitPoint.y;
    const dz = centroids[base + 2] - hitPoint.z;
    if (dx * dx + dy * dy + dz * dz <= r2) {
      result.add(t);
    }
  }
  return result;
}

// ── Face-weight array for subdivision ────────────────────────────────────────

/**
 * Build a per-vertex exclusion weight array.
 * Excluded triangles get weight 1.0, all others 0.0.
 */
export function buildFaceWeights(
  geometry: THREE.BufferGeometry,
  excludedFaces: Set<number>,
  invert = false,
): Float32Array {
  const posAttr = geometry.attributes.position;
  const indexAttr = geometry.index;
  const count = posAttr.count;
  const weights = new Float32Array(count);

  if (invert) {
    weights.fill(1.0);
    for (const t of excludedFaces) {
      for (let v = 0; v < 3; v++) {
        const vi = indexAttr ? indexAttr.getX(t * 3 + v) : t * 3 + v;
        weights[vi] = 0.0;
      }
    }
  } else {
    for (const t of excludedFaces) {
      for (let v = 0; v < 3; v++) {
        const vi = indexAttr ? indexAttr.getX(t * 3 + v) : t * 3 + v;
        weights[vi] = 1.0;
      }
    }
  }
  return weights;
}
