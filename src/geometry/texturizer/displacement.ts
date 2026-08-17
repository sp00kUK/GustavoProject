import { computeUV, getCubicBlendWeights, scaleMmToRelative, Bounds, MappingSettings,  } from './mapping';
import { QuantizedPointMap } from './meshIndex';
import { SubdivideOutput } from './subdivision';

/**
 * Apply displacement to every vertex of a non-indexed mesh.
 *
 * For each vertex:
 *   1. Compute UV with the same math used in the GLSL preview shader (mapping.ts).
 *   2. Bilinear-sample the greyscale ImageData at that UV.
 *   3. Move the vertex along its normal by:  (grey − 0.5) × 2 × amplitude
 *      so 50% grey = no displacement, white = outward, black = inward.
 *
 * @param geometry  – non-indexed (from subdivide())
 * @param imageData – raw pixel data (RGBA) from Canvas2D or another source
 * @param 
 * @param 
 * @param settings  – { mappingMode, scaleU, scaleV, amplitude, offsetU, offsetV, ... }
 * @param bounds    – { min, max, center, size }
 * @param onProgress
 * @returns new non-indexed geometry with displaced positions
 */
export function applyDisplacement(
  geometry: SubdivideOutput,
  sampler: import("../../types").PatternSampler,
  
  
  settings: MappingSettings & { 
    mappingMode: number; 
    amplitude: number; 
    boundaryFalloff?: number; 
    bottomAngleLimit?: number; 
    topAngleLimit?: number; 
    symmetricDisplacement?: boolean; 
    noDownwardZ?: boolean; 
    blendNormalSmoothing?: number;
    boundaryFalloffCurve?: 'linear' | 'ease' | 'scurve';
  },
  bounds: Bounds,
  onProgress?: (progress: number) => void
): { positions: Float32Array; normals: Float32Array } {
  const posAttr = geometry.positions;
  const nrmAttr = geometry.normals;
  const count   = posAttr.length / 3;

  const newPos = new Float32Array(count * 3);
  const newNrm = new Float32Array(count * 3);

  // Texture aspect correction so non-square textures keep their proportions.
  
  const aspectU = 1;
  const aspectV = 1;
  const settingsWithAspect = { ...settings, textureAspectU: aspectU, textureAspectV: aspectV };

  // 10 µm vertex-dedup cells
  const QUANT = 1e5;

  const needIdPositions = (settings.boundaryFalloff ?? 0) > 0;
  const _dedupMap = new QuantizedPointMap(QUANT, Math.min(count, 1 << 22));
  let _nextId = 0;
  const vertexId = new Uint32Array(count);
  const idPosX = needIdPositions ? new Float64Array(count) : null;
  const idPosY = needIdPositions ? new Float64Array(count) : null;
  const idPosZ = needIdPositions ? new Float64Array(count) : null;
  
  for (let i = 0; i < count; i++) {
    const x = posAttr[i*3], y = posAttr[i*3+1], z = posAttr[i*3+2];
    const id = _dedupMap.getOrSet(x, y, z, _nextId);
    if (_dedupMap.inserted) {
      _nextId++;
      if (needIdPositions && idPosX && idPosY && idPosZ) {
        idPosX[id] = x; idPosY[id] = y; idPosZ[id] = z;
      }
    }
    vertexId[i] = id;
  }
  const uniqueCount = _nextId;

  const smoothNrmX = new Float64Array(uniqueCount);
  const smoothNrmY = new Float64Array(uniqueCount);
  const smoothNrmZ = new Float64Array(uniqueCount);

  const zoneAreaX = new Float64Array(uniqueCount);
  const zoneAreaY = new Float64Array(uniqueCount);
  const zoneAreaZ = new Float64Array(uniqueCount);

  const maskedFracMasked = new Float64Array(uniqueCount);
  const maskedFracTotal  = new Float64Array(uniqueCount);

  const ewAttr = geometry.excludeWeights;
  const userExcludedFaces = ewAttr ? new Uint8Array(count / 3) : null;
  const excludedPos = ewAttr ? new Uint8Array(uniqueCount) : null;

  const dispCacheVal = new Float64Array(uniqueCount);
  const dispCacheSet = new Uint8Array(uniqueCount);

  for (let t = 0; t < count; t += 3) {
    const ax = posAttr[t*3],   ay = posAttr[t*3+1],   az = posAttr[t*3+2];
    const bx = posAttr[t*3+3], by = posAttr[t*3+4],   bz = posAttr[t*3+5];
    const cx = posAttr[t*3+6], cy = posAttr[t*3+7],   cz = posAttr[t*3+8];
    
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    
    const fnx = e1y * e2z - e1z * e2y;
    const fny = e1z * e2x - e1x * e2z;
    const fnz = e1x * e2y - e1y * e2x;
    
    const faceArea = Math.sqrt(fnx*fnx + fny*fny + fnz*fnz);
    const faceNzNorm = faceArea > 1e-12 ? fnz / faceArea : 0;
    const faceAngle  = Math.acos(Math.abs(faceNzNorm)) * (180 / Math.PI);
    const angleMasked = faceNzNorm < 0
      ? ((settings.bottomAngleLimit ?? 0) > 0 && faceAngle <= (settings.bottomAngleLimit ?? 0))
      : ((settings.topAngleLimit ?? 0) > 0 && faceAngle <= (settings.topAngleLimit ?? 0));
      
    const userExcluded = ewAttr
      ? (ewAttr[t] + ewAttr[t + 1] + ewAttr[t + 2]) / 3 > 0.99
      : false;
      
    const faceMasked = angleMasked;
    if (userExcluded && userExcludedFaces) userExcludedFaces[t / 3] = 1;

    let czX = 0, czY = 0, czZ = 0;
    if (settings.mappingMode === 6 && faceArea > 1e-12) {
      const cubicBlend = settings.mappingBlend ?? 0;
      const cubicBandWidth = settings.seamBandWidth ?? 0.35;
      const unitFaceNrm = { x: fnx / faceArea, y: fny / faceArea, z: fnz / faceArea };
      const w = getCubicBlendWeights(unitFaceNrm, cubicBlend, cubicBandWidth);
      czX = w.x * faceArea;
      czY = w.y * faceArea;
      czZ = w.z * faceArea;
    }

    for (let v = 0; v < 3; v++) {
      const vid = vertexId[t + v];
      if (userExcluded && excludedPos) excludedPos[vid] = 1;
      
      const nx = nrmAttr[(t+v)*3];
      const ny = nrmAttr[(t+v)*3+1];
      const nz = nrmAttr[(t+v)*3+2];
      
      smoothNrmX[vid] += nx * faceArea;
      smoothNrmY[vid] += ny * faceArea;
      smoothNrmZ[vid] += nz * faceArea;
      if (czX > 1e-12 || czY > 1e-12 || czZ > 1e-12) {
        zoneAreaX[vid] += czX;
        zoneAreaY[vid] += czY;
        zoneAreaZ[vid] += czZ;
      }
      if (faceMasked) maskedFracMasked[vid] += faceArea;
      maskedFracTotal[vid] += faceArea;
    }
  }

  const smoothNrmReliability = new Float64Array(uniqueCount);
  for (let id = 0; id < uniqueCount; id++) {
    const len = Math.sqrt(smoothNrmX[id]*smoothNrmX[id] + smoothNrmY[id]*smoothNrmY[id] + smoothNrmZ[id]*smoothNrmZ[id]);
    const tA  = maskedFracTotal[id];
    smoothNrmReliability[id] = (len > 0 && tA > 0) ? len / tA : 0;
    const inv = len > 0 ? 1 / len : 1;
    smoothNrmX[id] *= inv; smoothNrmY[id] *= inv; smoothNrmZ[id] *= inv;
  }

  const blendNrmIters = Math.max(0, Math.floor(settings.blendNormalSmoothing ?? 0));
  let blendNrmX = smoothNrmX, blendNrmY = smoothNrmY, blendNrmZ = smoothNrmZ;
  if (blendNrmIters > 0) {
    const degree = new Uint32Array(uniqueCount);
    for (let t = 0; t < count; t += 3) {
      const a = vertexId[t], b = vertexId[t + 1], c = vertexId[t + 2];
      if (a !== b) { degree[a]++; degree[b]++; }
      if (b !== c) { degree[b]++; degree[c]++; }
      if (c !== a) { degree[c]++; degree[a]++; }
    }
    const csrStart = new Uint32Array(uniqueCount + 1);
    for (let id = 0; id < uniqueCount; id++) csrStart[id + 1] = csrStart[id] + degree[id];
    const totalEdges = csrStart[uniqueCount];
    const neighbors = new Uint32Array(totalEdges);
    const cursor = new Uint32Array(uniqueCount);
    for (let t = 0; t < count; t += 3) {
      const a = vertexId[t], b = vertexId[t + 1], c = vertexId[t + 2];
      if (a !== b) { neighbors[csrStart[a] + cursor[a]++] = b; neighbors[csrStart[b] + cursor[b]++] = a; }
      if (b !== c) { neighbors[csrStart[b] + cursor[b]++] = c; neighbors[csrStart[c] + cursor[c]++] = b; }
      if (c !== a) { neighbors[csrStart[c] + cursor[c]++] = a; neighbors[csrStart[a] + cursor[a]++] = c; }
    }

    let curX = new Float64Array(smoothNrmX);
    let curY = new Float64Array(smoothNrmY);
    let curZ = new Float64Array(smoothNrmZ);
    let nxtX = new Float64Array(uniqueCount);
    let nxtY = new Float64Array(uniqueCount);
    let nxtZ = new Float64Array(uniqueCount);

    for (let iter = 0; iter < blendNrmIters; iter++) {
      for (let id = 0; id < uniqueCount; id++) {
        const s = csrStart[id], e = csrStart[id + 1];
        if (e === s) {
          nxtX[id] = curX[id]; nxtY[id] = curY[id]; nxtZ[id] = curZ[id];
          continue;
        }
        let sx = 0, sy = 0, sz = 0;
        for (let k = s; k < e; k++) {
          const nb = neighbors[k];
          sx += curX[nb]; sy += curY[nb]; sz += curZ[nb];
        }
        const inv = 1 / (e - s);
        sx *= inv; sy *= inv; sz *= inv;
        const len = Math.sqrt(sx*sx + sy*sy + sz*sz);
        if (len > 1e-12) {
          const r = 1 / len;
          nxtX[id] = sx * r; nxtY[id] = sy * r; nxtZ[id] = sz * r;
        } else {
          nxtX[id] = curX[id]; nxtY[id] = curY[id]; nxtZ[id] = curZ[id];
        }
      }
      const tx = curX, ty = curY, tz = curZ;
      curX = nxtX; curY = nxtY; curZ = nxtZ;
      nxtX = tx;   nxtY = ty;   nxtZ = tz;
    }
    blendNrmX = curX; blendNrmY = curY; blendNrmZ = curZ;
  }

  const boundaryFalloff = settings.boundaryFalloff ?? 0;
  let falloffArr: Float64Array | null = null;

  if (boundaryFalloff > 0 && idPosX && idPosY && idPosZ) {
    const bpXFull = new Float64Array(uniqueCount);
    const bpYFull = new Float64Array(uniqueCount);
    const bpZFull = new Float64Array(uniqueCount);
    let bpCount = 0;
    let gMinX = Infinity, gMinY = Infinity, gMinZ = Infinity;
    let gMaxX = -Infinity, gMaxY = -Infinity, gMaxZ = -Infinity;
    for (let id = 0; id < uniqueCount; id++) {
      const mfTotal = maskedFracTotal[id];
      const maskedFrac = mfTotal > 0 ? maskedFracMasked[id] / mfTotal : 0;
      const isOnExclBoundary = excludedPos && excludedPos[id] === 1;
      if (isOnExclBoundary || (maskedFrac > 0 && maskedFrac < 1)) {
        const x = idPosX[id], y = idPosY[id], z = idPosZ[id];
        bpXFull[bpCount] = x; bpYFull[bpCount] = y; bpZFull[bpCount] = z;
        if (x < gMinX) gMinX = x; if (x > gMaxX) gMaxX = x;
        if (y < gMinY) gMinY = y; if (y > gMaxY) gMaxY = y;
        if (z < gMinZ) gMinZ = z; if (z > gMaxZ) gMaxZ = z;
        bpCount++;
      }
    }

    if (bpCount > 0) {
      const bpX = bpXFull.subarray(0, bpCount);
      const bpY = bpYFull.subarray(0, bpCount);
      const bpZ = bpZFull.subarray(0, bpCount);

      const gPad = boundaryFalloff + 1e-3;
      gMinX -= gPad; gMinY -= gPad; gMinZ -= gPad;
      gMaxX += gPad; gMaxY += gPad; gMaxZ += gPad;

      const gRes = Math.max(4, Math.min(128, Math.ceil(Math.cbrt(bpCount) * 2)));
      const gDx = (gMaxX - gMinX) / gRes || 1;
      const gDy = (gMaxY - gMinY) / gRes || 1;
      const gDz = (gMaxZ - gMinZ) / gRes || 1;
      const invDx = 1 / gDx, invDy = 1 / gDy, invDz = 1 / gDz;
      const gridSize = gRes * gRes * gRes;
      const gResMax = gRes - 1;

      const cellCount = new Uint32Array(gridSize);
      const bpCell = new Uint32Array(bpCount);
      for (let i = 0; i < bpCount; i++) {
        let ix = (bpX[i] - gMinX) * invDx | 0; if (ix < 0) ix = 0; else if (ix > gResMax) ix = gResMax;
        let iy = (bpY[i] - gMinY) * invDy | 0; if (iy < 0) iy = 0; else if (iy > gResMax) iy = gResMax;
        let iz = (bpZ[i] - gMinZ) * invDz | 0; if (iz < 0) iz = 0; else if (iz > gResMax) iz = gResMax;
        const ck = (ix * gRes + iy) * gRes + iz;
        bpCell[i] = ck;
        cellCount[ck]++;
      }
      const cellStart = new Uint32Array(gridSize + 1);
      for (let c = 0; c < gridSize; c++) cellStart[c + 1] = cellStart[c] + cellCount[c];
      const cursor = new Uint32Array(gridSize);
      const cellIdx = new Uint32Array(bpCount);
      for (let i = 0; i < bpCount; i++) {
        const ck = bpCell[i];
        cellIdx[cellStart[ck] + cursor[ck]++] = i;
      }

      const searchX = Math.ceil(boundaryFalloff * invDx);
      const searchY = Math.ceil(boundaryFalloff * invDy);
      const searchZ = Math.ceil(boundaryFalloff * invDz);
      const maxDist2 = boundaryFalloff * boundaryFalloff;
      const invFalloff = 1 / boundaryFalloff;
      const falloffCurve = settings.boundaryFalloffCurve ?? 'linear';

      falloffArr = new Float64Array(uniqueCount);
      falloffArr.fill(1); 
      for (let id = 0; id < uniqueCount; id++) {
        const mfTotal = maskedFracTotal[id];
        const maskedFrac = mfTotal > 0 ? maskedFracMasked[id] / mfTotal : 0;
        const isOnExclBoundary = excludedPos && excludedPos[id] === 1;
        if (maskedFrac > 0 || isOnExclBoundary) continue;

        const px = idPosX[id], py = idPosY[id], pz = idPosZ[id];
        let cix = (px - gMinX) * invDx | 0; if (cix < 0) cix = 0; else if (cix > gResMax) cix = gResMax;
        let ciy = (py - gMinY) * invDy | 0; if (ciy < 0) ciy = 0; else if (ciy > gResMax) ciy = gResMax;
        let ciz = (pz - gMinZ) * invDz | 0; if (ciz < 0) ciz = 0; else if (ciz > gResMax) ciz = gResMax;

        const nixLo = Math.max(0, cix - searchX), nixHi = Math.min(gResMax, cix + searchX);
        const niyLo = Math.max(0, ciy - searchY), niyHi = Math.min(gResMax, ciy + searchY);
        const nizLo = Math.max(0, ciz - searchZ), nizHi = Math.min(gResMax, ciz + searchZ);

        let minDist2 = maxDist2;
        for (let nix = nixLo; nix <= nixHi; nix++) {
          const baseX = nix * gRes;
          for (let niy = niyLo; niy <= niyHi; niy++) {
            const baseXY = (baseX + niy) * gRes;
            for (let niz = nizLo; niz <= nizHi; niz++) {
              const ck = baseXY + niz;
              const end = cellStart[ck + 1];
              for (let k = cellStart[ck]; k < end; k++) {
                const idx = cellIdx[k];
                const dx = px - bpX[idx], dy = py - bpY[idx], dz = pz - bpZ[idx];
                const d2 = dx * dx + dy * dy + dz * dz;
                if (d2 < minDist2) minDist2 = d2;
              }
            }
          }
        }
        if (minDist2 < maxDist2) {
          const t = Math.sqrt(minDist2) * invFalloff;
          falloffArr[id] = falloffCurve === 'scurve' ? t * t * (3 - 2 * t)
                         : falloffCurve === 'ease'   ? t * t
                         : t;
        }
      }
    }
  }

  for (let i = 0; i < count; i++) {
    const vid = vertexId[i];
    if (dispCacheSet[vid]) continue;
    dispCacheSet[vid] = 1;

    const tmpPos = { x: posAttr[i*3], y: posAttr[i*3+1], z: posAttr[i*3+2] };

    if (settings.mappingMode === 6 /* MODE_CUBIC */) {
      const md = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 1e-6);
      const relScale = scaleMmToRelative(6, settings, bounds);
      const rotRad = (settings.rotation ?? 0) * Math.PI / 180;
      const cubicBlend = settings.mappingBlend ?? 0;
      const cubicBandWidth = settings.seamBandWidth ?? 0.35;

      let wX = 0, wY = 0, wZ = 0;
      if (smoothNrmReliability[vid] > 0.5) {
        const sn = { x: blendNrmX[vid], y: blendNrmY[vid], z: blendNrmZ[vid] };
        const w = getCubicBlendWeights(sn, cubicBlend, cubicBandWidth);
        wX = w.x; wY = w.y; wZ = w.z;
      } else {
        const zaX = zoneAreaX[vid], zaY = zoneAreaY[vid], zaZ = zoneAreaZ[vid];
        const total = zaX + zaY + zaZ;
        if (total > 0) { wX = zaX/total; wY = zaY/total; wZ = zaZ/total; }
      }

      if (wX + wY + wZ > 0) {
        let grey = 0;
        if (wX > 0) {
          let rawU = (tmpPos.y-bounds.min.y)/md;
          if (smoothNrmX[vid] < 0) rawU = -rawU;
          const uv = _cubicUV(rawU, (tmpPos.z-bounds.min.z)/md, relScale, settings, rotRad, aspectU, aspectV);
          grey += sampler.sample(uv.u, uv.v) * wX;
        }
        if (wY > 0) {
          let rawU = (tmpPos.x-bounds.min.x)/md;
          if (smoothNrmY[vid] > 0) rawU = -rawU;
          const uv = _cubicUV(rawU, (tmpPos.z-bounds.min.z)/md, relScale, settings, rotRad, aspectU, aspectV);
          grey += sampler.sample(uv.u, uv.v) * wY;
        }
        if (wZ > 0) {
          let rawU = (tmpPos.x-bounds.min.x)/md;
          if (smoothNrmZ[vid] < 0) rawU = -rawU;
          const uv = _cubicUV(rawU, (tmpPos.y-bounds.min.y)/md, relScale, settings, rotRad, aspectU, aspectV);
          grey += sampler.sample(uv.u, uv.v) * wZ;
        }
        dispCacheVal[vid] = grey;
        continue;
      }
    }

    const tmpNrm = { x: blendNrmX[vid], y: blendNrmY[vid], z: blendNrmZ[vid] };
    const uvResult = computeUV(tmpPos, tmpNrm, settings.mappingMode, settingsWithAspect, bounds);
    let grey;
    if (uvResult.triplanar && uvResult.samples) {
      grey = 0;
      for (const s of uvResult.samples) {
        grey += sampler.sample(s.u, s.v) * s.w;
      }
    } else {
      grey = sampler.sample(uvResult.u!, uvResult.v!);
    }
    dispCacheVal[vid] = grey;
  }

  const REPORT_EVERY = 5000;

  for (let i = 0; i < count; i++) {
    const pX = posAttr[i*3], pY = posAttr[i*3+1], pZ = posAttr[i*3+2];
    const vid  = vertexId[i];
    const grey = dispCacheVal[vid];

    const isFaceExcluded = userExcludedFaces && userExcludedFaces[Math.floor(i / 3)];
    const isSealedBoundary = !isFaceExcluded && excludedPos && excludedPos[vid] === 1;
    const mfTotal = maskedFracTotal[vid];
    const maskedFrac = mfTotal > 0 ? maskedFracMasked[vid] / mfTotal : 0;
    const centeredGrey = settings.symmetricDisplacement ? (grey - 0.5) : grey;
    const falloffFactor = falloffArr ? falloffArr[vid] : 1.0;
    const disp = (isFaceExcluded || isSealedBoundary) ? 0 : falloffFactor * (1 - maskedFrac) * centeredGrey * settings.amplitude;

    const newX = pX + smoothNrmX[vid] * disp;
    const newY = pY + smoothNrmY[vid] * disp;
    let   newZ = pZ + smoothNrmZ[vid] * disp;

    if (maskedFrac > 0) {
      if ((settings.bottomAngleLimit ?? 0) > 0 && newZ < pZ) newZ = pZ;
      if ((settings.topAngleLimit ?? 0)    > 0 && newZ > pZ) newZ = pZ;
    }

    if (settings.noDownwardZ && newZ < pZ) newZ = pZ;

    if (settings.noDownwardZ && pZ <= bounds.min.z + 1e-5) {
      newZ = pZ;
    }

    newPos[i*3]   = newX;
    newPos[i*3+1] = newY;
    newPos[i*3+2] = newZ;

    newNrm[i*3]   = nrmAttr[i*3];
    newNrm[i*3+1] = nrmAttr[i*3+1];
    newNrm[i*3+2] = nrmAttr[i*3+2];

    if (onProgress && i % REPORT_EVERY === 0) onProgress(i / count);
  }

  for (let t = 0; t < count; t += 3) {
    const ax = newPos[t*3],   ay = newPos[t*3+1],   az = newPos[t*3+2];
    const bx = newPos[t*3+3], by = newPos[t*3+4],   bz = newPos[t*3+5];
    const cx = newPos[t*3+6], cy = newPos[t*3+7],   cz = newPos[t*3+8];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    let fnx = e1y * e2z - e1z * e2y;
    let fny = e1z * e2x - e1x * e2z;
    let fnz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(fnx*fnx + fny*fny + fnz*fnz) || 1;
    fnx /= len; fny /= len; fnz /= len;
    for (let v = 0; v < 3; v++) {
      newNrm[(t + v) * 3]     = fnx;
      newNrm[(t + v) * 3 + 1] = fny;
      newNrm[(t + v) * 3 + 2] = fnz;
    }
  }

  return { positions: newPos, normals: newNrm };
}



function _cubicUV(rawU: number, rawV: number, relScale: {u: number, v: number}, settings: MappingSettings, rotRad: number, aspectU: number, aspectV: number) {
  let u = (rawU * aspectU) / relScale.u + settings.offsetU;
  let v = (rawV * aspectV) / relScale.v + settings.offsetV;
  if (rotRad !== 0) {
    const c = Math.cos(rotRad), s = Math.sin(rotRad);
    u -= 0.5; v -= 0.5;
    const ru = c*u - s*v, rv = s*u + c*v;
    u = ru + 0.5; v = rv + 0.5;
  }
  return { u: u - Math.floor(u), v: v - Math.floor(v) };
}
