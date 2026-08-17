/*
 * Copyright (c) 2026 CNCKitchen (Stefan Hermann) and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as THREE from 'three';
import { QuantizedPointMap } from './meshIndex';

const QUANT = 1e4;

export interface AdjacencyNeighbor {
  neighbor: number;
  angle: number;
}

export interface AdjacencyData {
  adjacency: Array<Array<AdjacencyNeighbor>>;
  centroids: Float32Array;
  boundRadii: Float32Array;
  faceNormals: Float32Array;
  openEdgeCount: number;
  nonManifoldEdgeCount: number;
}

export function buildAdjacency(geometry: THREE.BufferGeometry): AdjacencyData {
  const posAttr  = geometry.attributes.position;
  const triCount = posAttr.count / 3;

  const faceNormals = new Float32Array(triCount * 3);
  const centroids   = new Float32Array(triCount * 3);
  const boundRadii  = new Float32Array(triCount); 

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const i = t * 3;
    vA.fromBufferAttribute(posAttr, i);
    vB.fromBufferAttribute(posAttr, i + 1);
    vC.fromBufferAttribute(posAttr, i + 2);

    e1.subVectors(vB, vA);
    e2.subVectors(vC, vA);
    fn.crossVectors(e1, e2).normalize();

    faceNormals[i]     = fn.x;
    faceNormals[i + 1] = fn.y;
    faceNormals[i + 2] = fn.z;

    const cx = (vA.x + vB.x + vC.x) / 3;
    const cy = (vA.y + vB.y + vC.y) / 3;
    const cz = (vA.z + vB.z + vC.z) / 3;
    centroids[i]     = cx;
    centroids[i + 1] = cy;
    centroids[i + 2] = cz;
    const dA = (vA.x-cx)**2 + (vA.y-cy)**2 + (vA.z-cz)**2;
    const dB = (vB.x-cx)**2 + (vB.y-cy)**2 + (vB.z-cz)**2;
    const dC = (vC.x-cx)**2 + (vC.y-cy)**2 + (vC.z-cz)**2;
    boundRadii[t] = Math.sqrt(Math.max(dA, dB, dC));
  }

  const posToId = new QuantizedPointMap(QUANT, Math.min(triCount * 3, 1 << 22));
  let nextId = 0;
  const vertId = new Uint32Array(triCount * 3);
  for (let i = 0; i < triCount * 3; i++) {
    const id = posToId.getOrSet(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i), nextId);
    if (posToId.inserted) nextId++;
    vertId[i] = id;
  }
  const numEdgeKey = (a: number, b: number) => a < b ? a * nextId + b : b * nextId + a;

  const edgeMap = new Map<number, number[]>();
  const edgePairs = [0, 1, 0, 2, 1, 2];

  for (let t = 0; t < triCount; t++) {
    const base = t * 3;
    for (let e = 0; e < 6; e += 2) {
      const ek = numEdgeKey(vertId[base + edgePairs[e]], vertId[base + edgePairs[e + 1]]);
      const entry = edgeMap.get(ek);
      if (entry) entry.push(t);
      else edgeMap.set(ek, [t]);
    }
  }

  const adjacency: Array<Array<AdjacencyNeighbor>> = new Array(triCount);
  for (let t = 0; t < triCount; t++) adjacency[t] = [];

  let openEdgeCount = 0;
  let nonManifoldEdgeCount = 0;

  for (const tris of edgeMap.values()) {
    if (tris.length === 1) { openEdgeCount++; continue; }
    if (tris.length > 2) nonManifoldEdgeCount++;
    const a = tris[0];
    const b = tris[1];
    const nAx = faceNormals[a * 3], nAy = faceNormals[a * 3 + 1], nAz = faceNormals[a * 3 + 2];
    const nBx = faceNormals[b * 3], nBy = faceNormals[b * 3 + 1], nBz = faceNormals[b * 3 + 2];
    const dot      = Math.max(-1, Math.min(1, nAx * nBx + nAy * nBy + nAz * nBz));
    const angleDeg = Math.acos(dot) * (180 / Math.PI);
    adjacency[a].push({ neighbor: b, angle: angleDeg });
    adjacency[b].push({ neighbor: a, angle: angleDeg });
  }

  return { adjacency, centroids, boundRadii, faceNormals, openEdgeCount, nonManifoldEdgeCount };
}

export function bucketFill(seedTriIdx: number, adjacency: Array<Array<AdjacencyNeighbor>>, thresholdDeg: number): Set<number> {
  const visited = new Set([seedTriIdx]);
  const queue   = [seedTriIdx];
  let head = 0;
  while (head < queue.length) {
    const cur       = queue[head++];
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

export function buildExclusionOverlayGeo(geometry: THREE.BufferGeometry, faceSet: Set<number> | Uint8Array, invert = false): THREE.BufferGeometry {
  const srcPos   = geometry.attributes.position.array as Float32Array;
  const srcNrm   = geometry.attributes.normal ? geometry.attributes.normal.array as Float32Array : null;
  const total    = srcPos.length / 9;
  const isArr    = faceSet instanceof Uint8Array;

  let setSize: number;
  if (isArr) {
    setSize = 0;
    for (let i = 0; i < (faceSet as Uint8Array).length; i++) if ((faceSet as Uint8Array)[i]) setSize++;
  } else {
    setSize = (faceSet as Set<number>).size;
  }
  
  const count    = invert ? total - setSize : setSize;
  const outPos   = new Float32Array(count * 9);
  const outNrm   = srcNrm ? new Float32Array(count * 9) : null;
  let dst = 0;
  
  if (invert) {
    for (let t = 0; t < total; t++) {
      if (isArr ? (faceSet as Uint8Array)[t] : (faceSet as Set<number>).has(t)) continue;
      const src = t * 9;
      outPos.set(srcPos.subarray(src, src + 9), dst);
      if (outNrm) outNrm.set(srcNrm!.subarray(src, src + 9), dst);
      dst += 9;
    }
  } else {
    if (isArr) {
      for (let t = 0; t < (faceSet as Uint8Array).length; t++) {
        if (!(faceSet as Uint8Array)[t]) continue;
        const src = t * 9;
        outPos.set(srcPos.subarray(src, src + 9), dst);
        if (outNrm) outNrm.set(srcNrm!.subarray(src, src + 9), dst);
        dst += 9;
      }
    } else {
      for (const t of (faceSet as Set<number>)) {
        const src = t * 9;
        outPos.set(srcPos.subarray(src, src + 9), dst);
        if (outNrm) outNrm.set(srcNrm!.subarray(src, src + 9), dst);
        dst += 9;
      }
    }
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
  if (outNrm) geo.setAttribute('normal', new THREE.BufferAttribute(outNrm, 3));
  return geo;
}

export function buildFaceWeights(geometry: THREE.BufferGeometry, excludedFaces: Set<number> | Uint8Array, invert = false): Float32Array {
  const count   = geometry.attributes.position.count;
  const weights = new Float32Array(count); 
  const isArr = excludedFaces instanceof Uint8Array;
  
  if (invert) {
    weights.fill(1.0);
    if (isArr) {
      for (let t = 0; t < (excludedFaces as Uint8Array).length; t++) {
        if ((excludedFaces as Uint8Array)[t]) {
          weights[t * 3]     = 0.0;
          weights[t * 3 + 1] = 0.0;
          weights[t * 3 + 2] = 0.0;
        }
      }
    } else {
      for (const t of (excludedFaces as Set<number>)) {
        weights[t * 3]     = 0.0;
        weights[t * 3 + 1] = 0.0;
        weights[t * 3 + 2] = 0.0;
      }
    }
  } else {
    if (isArr) {
      for (let t = 0; t < (excludedFaces as Uint8Array).length; t++) {
        if ((excludedFaces as Uint8Array)[t]) {
          weights[t * 3]     = 1.0;
          weights[t * 3 + 1] = 1.0;
          weights[t * 3 + 2] = 1.0;
        }
      }
    } else {
      for (const t of (excludedFaces as Set<number>)) {
        weights[t * 3]     = 1.0;
        weights[t * 3 + 1] = 1.0;
        weights[t * 3 + 2] = 1.0;
      }
    }
  }
  return weights;
}
