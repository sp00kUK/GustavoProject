import { QuantizedPointMap } from './meshIndex';

const QUANTISE = 1e5;
const SAFETY_CAP = (typeof navigator !== 'undefined' && (navigator as any).deviceMemory >= 8)
  ? 32_000_000
  : 16_000_000;

interface VertStore {
  cap: number;
  count: number;
  pos: Float64Array;
  nrm: Float64Array;
  wgt: Float64Array | null;
  canon: Int32Array | null;
  grow: () => void;
}

function makeVertStore(initialCap: number, hasWeights: boolean, hasCanon: boolean): VertStore {
  return {
    cap: initialCap,
    count: 0,
    pos: new Float64Array(initialCap * 3),
    nrm: new Float64Array(initialCap * 3),
    wgt: hasWeights ? new Float64Array(initialCap) : null,
    canon: hasCanon ? new Int32Array(initialCap) : null,
    grow() {
      this.cap *= 2;
      const np = new Float64Array(this.cap * 3); np.set(this.pos); this.pos = np;
      const nn = new Float64Array(this.cap * 3); nn.set(this.nrm); this.nrm = nn;
      if (this.wgt) { const nw = new Float64Array(this.cap); nw.set(this.wgt); this.wgt = nw; }
      if (this.canon) { const nc = new Int32Array(this.cap); nc.set(this.canon); this.canon = nc; }
    },
  };
}

export interface SubdivideInput {
  positions: Float32Array;
  indices: Uint32Array; // Always indexed input
}

export interface SubdivideOutput {
  positions: Float32Array;
  normals: Float32Array;
  excludeWeights: Float32Array | null;
  safetyCapHit: boolean;
  faceParentId: Int32Array;
}

export async function subdivide(
  geometry: SubdivideInput,
  maxEdgeLength: number,
  onProgress?: (progress: number, triCount: number, longestEdge: number) => void,
  faceWeights: Float32Array | null = null,
  options: { fast?: boolean } = {}
): Promise<SubdivideOutput> {
  const { fast = false } = options;

  let initialFaceExcluded: Uint8Array | null = null;
  if (faceWeights) {
    const triCount = geometry.indices.length / 3;
    initialFaceExcluded = new Uint8Array(triCount);
    for (let i = 0; i < triCount; i++) {
      if (faceWeights[i] > 0.99) initialFaceExcluded[i] = 1;
    }
  }

  // Convert our indexed input into the internal indexed format with canons and averaged normals
  const indexed = fast
    ? toIndexedFast(geometry, faceWeights)
    : toIndexed(geometry, faceWeights);
    
  const { verts, indices } = indexed;
  const posCanonMap = (indexed as any).posCanonMap || null;

  const maxIterations = 12;
  let currentIndices = indices;
  let currentFaceExcluded = initialFaceExcluded;
  let safetyCapHit = false;

  const initialTriCount = indices.length / 3;
  let currentFaceParentId = new Int32Array(initialTriCount);
  for (let i = 0; i < initialTriCount; i++) currentFaceParentId[i] = i;

  for (let iter = 0; iter < maxIterations; iter++) {
    const triCount = currentIndices.length / 3;
    if (triCount >= SAFETY_CAP) {
      safetyCapHit = true;
      break;
    }

    const { newIndices, newFaceExcluded, newFaceParentId, changed, capped } = subdividePass(
      verts, currentIndices, maxEdgeLength, SAFETY_CAP, currentFaceExcluded,
      posCanonMap, currentFaceParentId
    );
    
    currentIndices = newIndices as any;
    if (newFaceExcluded) currentFaceExcluded = newFaceExcluded;
    if (newFaceParentId) currentFaceParentId = newFaceParentId as any;

    if (capped || newIndices.length / 3 >= SAFETY_CAP) safetyCapHit = true;

    const positions = verts.pos;
    let maxEdgeLenSq = 0;
    for (let t = 0; t < currentIndices.length; t += 3) {
      const a = currentIndices[t], b = currentIndices[t + 1], c = currentIndices[t + 2];
      const ab = edgeLenSq(positions, a, b);
      const bc = edgeLenSq(positions, b, c);
      const ca = edgeLenSq(positions, c, a);
      if (ab > maxEdgeLenSq) maxEdgeLenSq = ab;
      if (bc > maxEdgeLenSq) maxEdgeLenSq = bc;
      if (ca > maxEdgeLenSq) maxEdgeLenSq = ca;
    }
    const longestEdge = Math.sqrt(maxEdgeLenSq);

    const newTriCount = newIndices.length / 3;
    if (onProgress) onProgress(Math.min(0.95, (iter + 1) / maxIterations), newTriCount, longestEdge);
    await new Promise(r => setTimeout(r, 0));
    
    if (!changed || safetyCapHit) break;
  }

  const result = toNonIndexed(verts, currentIndices, currentFaceExcluded);
  
  return {
    positions: result.positions,
    normals: result.normals,
    excludeWeights: result.excludeWeights,
    safetyCapHit,
    faceParentId: new Int32Array(currentFaceParentId),
  };
}

function subdividePass(
  verts: VertStore, 
  indices: Uint32Array, 
  maxEdgeLength: number, 
  safetyCap: number, 
  faceExcluded: Uint8Array | null, 
  posCanonMap: QuantizedPointMap | null, 
  faceParentId: Int32Array | null
) {
  const maxSq = maxEdgeLength * maxEdgeLength;
  const midCache = new QuantizedPointMap(1, 1 << 16);
  const positions = verts.pos;
  const canonIdx  = verts.canon;

  const splitEdges = new QuantizedPointMap(1, 1 << 16);
  const markEdge = (a: number, b: number) => {
    const u = canonIdx ? canonIdx[a] : a, v = canonIdx ? canonIdx[b] : b;
    if (u < v) splitEdges.getOrSet(u, v, 0, 1);
    else       splitEdges.getOrSet(v, u, 0, 1);
  };
  const isMarked = (a: number, b: number) => {
    const u = canonIdx ? canonIdx[a] : a, v = canonIdx ? canonIdx[b] : b;
    return (u < v ? splitEdges.get(u, v, 0) : splitEdges.get(v, u, 0)) !== -1;
  };

  for (let t = 0; t < indices.length; t += 3) {
    if (faceExcluded && faceExcluded[t / 3]) continue;
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    if (edgeLenSq(positions, a, b) > maxSq) markEdge(a, b);
    if (edgeLenSq(positions, b, c) > maxSq) markEdge(b, c);
    if (edgeLenSq(positions, c, a) > maxSq) markEdge(c, a);
  }

  if (splitEdges.size === 0) return { newIndices: indices, newFaceExcluded: faceExcluded, newFaceParentId: faceParentId, changed: false, capped: false };

  let predictedTris = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    const sAB = isMarked(a, b);
    const sBC = isMarked(b, c);
    const sCA = isMarked(c, a);
    const n   = (sAB ? 1 : 0) + (sBC ? 1 : 0) + (sCA ? 1 : 0);
    predictedTris += n === 0 ? 1 : n + 1;
  }
  
  if (predictedTris > safetyCap) {
    return { newIndices: indices, newFaceExcluded: faceExcluded, newFaceParentId: faceParentId, changed: false, capped: true };
  }

  const nextIndices = new Uint32Array(predictedTris * 3);
  const nextFaceExcluded = faceExcluded ? new Uint8Array(predictedTris) : null;
  const nextFaceParentId = faceParentId ? new Int32Array(predictedTris) : null;
  let wi = 0;
  let fi = 0;

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    const fIdx = t / 3;
    const excl = faceExcluded ? faceExcluded[fIdx] : 0;
    const pid  = faceParentId ? faceParentId[fIdx] : 0;
    const sAB = isMarked(a, b);
    const sBC = isMarked(b, c);
    const sCA = isMarked(c, a);
    const n   = (sAB ? 1 : 0) + (sBC ? 1 : 0) + (sCA ? 1 : 0);

    if (n === 0) {
      nextIndices[wi++] = a; nextIndices[wi++] = b; nextIndices[wi++] = c;
      if (nextFaceExcluded) nextFaceExcluded[fi] = excl;
      if (nextFaceParentId) nextFaceParentId[fi] = pid;
      fi++;
    } else if (n === 3) {
      const mAB = getMidpoint(verts, midCache, a, b, posCanonMap);
      const mBC = getMidpoint(verts, midCache, b, c, posCanonMap);
      const mCA = getMidpoint(verts, midCache, c, a, posCanonMap);
      nextIndices[wi++] = a;   nextIndices[wi++] = mAB; nextIndices[wi++] = mCA;
      nextIndices[wi++] = mAB; nextIndices[wi++] = b;   nextIndices[wi++] = mBC;
      nextIndices[wi++] = mCA; nextIndices[wi++] = mBC; nextIndices[wi++] = c;
      nextIndices[wi++] = mAB; nextIndices[wi++] = mBC; nextIndices[wi++] = mCA;
      for (let k = 0; k < 4; k++) {
        if (nextFaceExcluded) nextFaceExcluded[fi] = excl;
        if (nextFaceParentId) nextFaceParentId[fi] = pid;
        fi++;
      }
    } else if (n === 1) {
      if (sAB) {
        const m = getMidpoint(verts, midCache, a, b, posCanonMap);
        nextIndices[wi++] = a; nextIndices[wi++] = m; nextIndices[wi++] = c;
        nextIndices[wi++] = m; nextIndices[wi++] = b; nextIndices[wi++] = c;
      } else if (sBC) {
        const m = getMidpoint(verts, midCache, b, c, posCanonMap);
        nextIndices[wi++] = a; nextIndices[wi++] = b; nextIndices[wi++] = m;
        nextIndices[wi++] = a; nextIndices[wi++] = m; nextIndices[wi++] = c;
      } else {
        const m = getMidpoint(verts, midCache, c, a, posCanonMap);
        nextIndices[wi++] = a; nextIndices[wi++] = b; nextIndices[wi++] = m;
        nextIndices[wi++] = m; nextIndices[wi++] = b; nextIndices[wi++] = c;
      }
      for (let k = 0; k < 2; k++) {
        if (nextFaceExcluded) nextFaceExcluded[fi] = excl;
        if (nextFaceParentId) nextFaceParentId[fi] = pid;
        fi++;
      }
    } else {
      if (!sAB) {
        const mBC = getMidpoint(verts, midCache, b, c, posCanonMap);
        const mCA = getMidpoint(verts, midCache, c, a, posCanonMap);
        nextIndices[wi++] = a;   nextIndices[wi++] = b;   nextIndices[wi++] = mBC;
        nextIndices[wi++] = a;   nextIndices[wi++] = mBC; nextIndices[wi++] = mCA;
        nextIndices[wi++] = c;   nextIndices[wi++] = mCA; nextIndices[wi++] = mBC;
      } else if (!sBC) {
        const mAB = getMidpoint(verts, midCache, a, b, posCanonMap);
        const mCA = getMidpoint(verts, midCache, c, a, posCanonMap);
        nextIndices[wi++] = a;   nextIndices[wi++] = mAB; nextIndices[wi++] = mCA;
        nextIndices[wi++] = mAB; nextIndices[wi++] = b;   nextIndices[wi++] = c;
        nextIndices[wi++] = mAB; nextIndices[wi++] = c;   nextIndices[wi++] = mCA;
      } else {
        const mAB = getMidpoint(verts, midCache, a, b, posCanonMap);
        const mBC = getMidpoint(verts, midCache, b, c, posCanonMap);
        nextIndices[wi++] = b;   nextIndices[wi++] = mBC; nextIndices[wi++] = mAB;
        nextIndices[wi++] = a;   nextIndices[wi++] = mAB; nextIndices[wi++] = mBC;
        nextIndices[wi++] = a;   nextIndices[wi++] = mBC; nextIndices[wi++] = c;
      }
      for (let k = 0; k < 3; k++) {
        if (nextFaceExcluded) nextFaceExcluded[fi] = excl;
        if (nextFaceParentId) nextFaceParentId[fi] = pid;
        fi++;
      }
    }
  }

  return { newIndices: nextIndices, newFaceExcluded: nextFaceExcluded, newFaceParentId: nextFaceParentId, changed: true, capped: false };
}

function edgeLenSq(pos: Float64Array, a: number, b: number): number {
  const dx = pos[a*3]   - pos[b*3];
  const dy = pos[a*3+1] - pos[b*3+1];
  const dz = pos[a*3+2] - pos[b*3+2];
  return dx*dx + dy*dy + dz*dz;
}

function getMidpoint(verts: VertStore, cache: QuantizedPointMap, a: number, b: number, posCanonMap: QuantizedPointMap | null): number {
  const lo = a < b ? a : b, hi = a < b ? b : a;
  const cached = cache.get(lo, hi, 0);
  if (cached !== -1) return cached;

  const pos = verts.pos, nrm = verts.nrm;

  const mx = (pos[a*3]   + pos[b*3])   / 2;
  const my = (pos[a*3+1] + pos[b*3+1]) / 2;
  const mz = (pos[a*3+2] + pos[b*3+2]) / 2;

  const nx = nrm[a*3]   + nrm[b*3];
  const ny = nrm[a*3+1] + nrm[b*3+1];
  const nz = nrm[a*3+2] + nrm[b*3+2];
  const nl = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;

  const idx = verts.count;
  if (idx === verts.cap) verts.grow();
  verts.pos[idx*3] = mx; verts.pos[idx*3+1] = my; verts.pos[idx*3+2] = mz;
  verts.nrm[idx*3] = nx / nl; verts.nrm[idx*3+1] = ny / nl; verts.nrm[idx*3+2] = nz / nl;
  if (verts.wgt) verts.wgt[idx] = (verts.wgt[a] + verts.wgt[b]) / 2;

  if (verts.canon && posCanonMap) {
    verts.canon[idx] = posCanonMap.getOrSet(mx, my, mz, idx);
  }
  verts.count = idx + 1;

  cache.getOrSet(lo, hi, 0, idx);
  return idx;
}

function toIndexedFast(geometry: SubdivideInput, faceWeights: Float32Array | null) {
  // fast mode doesn't build canon map or split sharp edges
  // but wait, since our input is already indexed, we can just rebuild 
  // the vertex store using the provided indices and positions to ensure
  // normals are accumulated correctly, OR we can just use it directly!
  // BUT we need to accumulate normals per-vertex.
  
  const posAttr = geometry.positions;
  const inIndices = geometry.indices;
  const n = posAttr.length / 3;
  const triCount = inIndices.length / 3;
  
  const verts = makeVertStore(Math.max(16, Math.min(1 << 16, n)), !!faceWeights, false);
  const indices = new Uint32Array(triCount * 3);
  
  // Initialize vertices directly from the input positions
  for (let i = 0; i < n; i++) {
    verts.pos[i*3] = posAttr[i*3];
    verts.pos[i*3+1] = posAttr[i*3+1];
    verts.pos[i*3+2] = posAttr[i*3+2];
  }
  verts.count = n;
  
  // Accumulate normals from faces
  for (let t = 0; t < triCount; t++) {
    const a = inIndices[t*3], b = inIndices[t*3+1], c = inIndices[t*3+2];
    indices[t*3] = a; indices[t*3+1] = b; indices[t*3+2] = c;
    
    const ax = posAttr[a*3], ay = posAttr[a*3+1], az = posAttr[a*3+2];
    const bx = posAttr[b*3], by = posAttr[b*3+1], bz = posAttr[b*3+2];
    const cx = posAttr[c*3], cy = posAttr[c*3+1], cz = posAttr[c*3+2];
    
    const rx = (by-ay)*(cz-az) - (bz-az)*(cy-ay);
    const ry = (bz-az)*(cx-ax) - (bx-ax)*(cz-az);
    const rz = (bx-ax)*(cy-ay) - (by-ay)*(cx-ax);
    
    verts.nrm[a*3] += rx; verts.nrm[a*3+1] += ry; verts.nrm[a*3+2] += rz;
    verts.nrm[b*3] += rx; verts.nrm[b*3+1] += ry; verts.nrm[b*3+2] += rz;
    verts.nrm[c*3] += rx; verts.nrm[c*3+1] += ry; verts.nrm[c*3+2] += rz;
    
    if (verts.wgt && faceWeights) {
      if (faceWeights[t] > verts.wgt[a]) verts.wgt[a] = faceWeights[t];
      if (faceWeights[t] > verts.wgt[b]) verts.wgt[b] = faceWeights[t];
      if (faceWeights[t] > verts.wgt[c]) verts.wgt[c] = faceWeights[t];
    }
  }

  normalizeStoreNormals(verts);
  return { verts, indices };
}

function normalizeStoreNormals(verts: VertStore) {
  const nrm = verts.nrm;
  for (let i = 0; i < verts.count; i++) {
    const nx = nrm[i * 3];
    const ny = nrm[i * 3 + 1];
    const nz = nrm[i * 3 + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nrm[i * 3]     = nx / len;
    nrm[i * 3 + 1] = ny / len;
    nrm[i * 3 + 2] = nz / len;
  }
}

function toIndexed(geometry: SubdivideInput, faceWeights: Float32Array | null) {
  const posAttr = geometry.positions;
  const inIndices = geometry.indices;
  const numVertices = posAttr.length / 3;
  const triCount = inIndices.length / 3;

  const faceNrmUnit = new Float32Array(triCount * 3);
  const faceNrmRaw  = new Float32Array(triCount * 3);
  
  for (let t = 0; t < triCount; t++) {
    const a = inIndices[t*3], b = inIndices[t*3+1], c = inIndices[t*3+2];
    const ax = posAttr[a*3], ay = posAttr[a*3+1], az = posAttr[a*3+2];
    const bx = posAttr[b*3], by = posAttr[b*3+1], bz = posAttr[b*3+2];
    const cx = posAttr[c*3], cy = posAttr[c*3+1], cz = posAttr[c*3+2];
    const rx = (by-ay)*(cz-az) - (bz-az)*(cy-ay);
    const ry = (bz-az)*(cx-ax) - (bx-ax)*(cz-az);
    const rz = (bx-ax)*(cy-ay) - (by-ay)*(cx-ax);
    const len = Math.sqrt(rx*rx + ry*ry + rz*rz) || 1;
    const ux = rx/len, uy = ry/len, uz = rz/len;
    
    faceNrmUnit[t*3] = ux; faceNrmUnit[t*3+1] = uy; faceNrmUnit[t*3+2] = uz;
    faceNrmRaw[t*3] = rx; faceNrmRaw[t*3+1] = ry; faceNrmRaw[t*3+2] = rz;
  }

  const SHARP_COS = Math.cos(30 * Math.PI / 180);

  const indices = new Uint32Array(triCount * 3);
  const verts = makeVertStore(Math.max(16, Math.min(1 << 16, numVertices * 1.5)), !!faceWeights, true);
  const posCanonMap = new QuantizedPointMap(QUANTISE, Math.min(numVertices, 1 << 22));
  
  const clustersByCanon = new Map<number, Array<{idx: number, fnU: [number, number, number]}>>();

  for (let t = 0; t < triCount; t++) {
    const fnUx = faceNrmUnit[t*3], fnUy = faceNrmUnit[t*3+1], fnUz = faceNrmUnit[t*3+2];
    const fnRx = faceNrmRaw[t*3],  fnRy = faceNrmRaw[t*3+1],  fnRz = faceNrmRaw[t*3+2];
    const faceW = faceWeights ? faceWeights[t] : 0;
    
    for (let v = 0; v < 3; v++) {
      const origV = inIndices[t*3 + v];
      const px = posAttr[origV*3], py = posAttr[origV*3+1], pz = posAttr[origV*3+2];
      
      const canonId = posCanonMap.getOrSet(px, py, pz, verts.count);
      const clusters = posCanonMap.inserted ? undefined : clustersByCanon.get(canonId);
      
      if (clusters) {
        let matched = false;
        for (const cl of clusters) {
          const dot = cl.fnU[0]*fnUx + cl.fnU[1]*fnUy + cl.fnU[2]*fnUz;
          if (dot >= SHARP_COS) {
            const idx = cl.idx;
            verts.nrm[idx*3]   += fnRx;
            verts.nrm[idx*3+1] += fnRy;
            verts.nrm[idx*3+2] += fnRz;
            if (verts.wgt && faceW > verts.wgt[idx]) verts.wgt[idx] = faceW;
            
            cl.fnU[0] += fnUx; cl.fnU[1] += fnUy; cl.fnU[2] += fnUz;
            const rl = Math.sqrt(cl.fnU[0]*cl.fnU[0] + cl.fnU[1]*cl.fnU[1] + cl.fnU[2]*cl.fnU[2]) || 1;
            cl.fnU[0] /= rl; cl.fnU[1] /= rl; cl.fnU[2] /= rl;
            
            indices[t*3+v] = idx;
            matched = true;
            break;
          }
        }
        if (!matched) {
          const idx = verts.count;
          if (idx === verts.cap) verts.grow();
          verts.pos[idx*3] = px;   verts.pos[idx*3+1] = py;   verts.pos[idx*3+2] = pz;
          verts.nrm[idx*3] = fnRx; verts.nrm[idx*3+1] = fnRy; verts.nrm[idx*3+2] = fnRz;
          if (verts.wgt) verts.wgt[idx] = faceW;
          if (verts.canon) verts.canon[idx] = canonId;
          verts.count++;
          clusters.push({idx, fnU: [fnUx, fnUy, fnUz]});
          indices[t*3+v] = idx;
        }
      } else {
        const idx = verts.count;
        if (idx === verts.cap) verts.grow();
        verts.pos[idx*3] = px;   verts.pos[idx*3+1] = py;   verts.pos[idx*3+2] = pz;
        verts.nrm[idx*3] = fnRx; verts.nrm[idx*3+1] = fnRy; verts.nrm[idx*3+2] = fnRz;
        if (verts.wgt) verts.wgt[idx] = faceW;
        if (verts.canon) verts.canon[idx] = canonId;
        verts.count++;
        clustersByCanon.set(canonId, [{idx, fnU: [fnUx, fnUy, fnUz]}]);
        indices[t*3+v] = idx;
      }
    }
  }

  normalizeStoreNormals(verts);
  return { verts, indices, posCanonMap };
}

function toNonIndexed(verts: VertStore, indices: Uint32Array, faceExcluded: Uint8Array | null) {
  const positions = verts.pos, normals = verts.nrm, weights = verts.wgt;
  const triCount  = indices.length / 3;
  const posArray  = new Float32Array(triCount * 9);
  const nrmArray  = new Float32Array(triCount * 9);
  const wgtArray  = (faceExcluded || weights) ? new Float32Array(triCount * 3) : null;

  for (let t = 0; t < triCount; t++) {
    const faceW = faceExcluded ? (faceExcluded[t] ? 1.0 : 0.0) : null;
    for (let v = 0; v < 3; v++) {
      const vidx = indices[t * 3 + v];
      posArray[t * 9 + v * 3]     = positions[vidx * 3];
      posArray[t * 9 + v * 3 + 1] = positions[vidx * 3 + 1];
      posArray[t * 9 + v * 3 + 2] = positions[vidx * 3 + 2];

      nrmArray[t * 9 + v * 3]     = normals[vidx * 3];
      nrmArray[t * 9 + v * 3 + 1] = normals[vidx * 3 + 1];
      nrmArray[t * 9 + v * 3 + 2] = normals[vidx * 3 + 2];

      if (wgtArray) wgtArray[t * 3 + v] = faceW !== null ? faceW : (weights ? weights[vidx] : 0);
    }
  }

  return { positions: posArray, normals: nrmArray, excludeWeights: wgtArray };
}
