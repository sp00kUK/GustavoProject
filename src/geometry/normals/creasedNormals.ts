import type { PrintableMesh } from '../../types';
import { DEFAULT_CREASE_ANGLE } from '../constants';

/**
 * Display normals with hard creases preserved.
 *
 * Calling a single global "compute vertex normals" on this geometry looks
 * wrong: a cavity wall shares its top edge with the untouched surface, so
 * averaging across that edge rounds off exactly the crisp step the binary
 * relief exists to produce. Conversely, flat-shading the whole thing turns the
 * barrel into a faceted polygon.
 *
 * So: faces incident to a vertex are grouped into clusters whose normals lie
 * within `angleDeg` of each other. Each cluster gets its own copy of the
 * vertex. Round surfaces stay smooth, engraved steps stay sharp.
 *
 * This is preview-only. STL and 3MF are written from face geometry and never
 * depend on these.
 */
export function computeCreasedNormals(
  mesh: PrintableMesh,
  angleDeg: number = DEFAULT_CREASE_ANGLE,
): PrintableMesh {
  const { positions, indices } = mesh;
  const vertexCount = positions.length / 3;
  const faceCount = indices.length / 3;
  const cosLimit = Math.cos((angleDeg * Math.PI) / 180);

  // Face normals (unnormalised length carries the area weight).
  const fnx = new Float32Array(faceCount);
  const fny = new Float32Array(faceCount);
  const fnz = new Float32Array(faceCount);
  for (let f = 0; f < faceCount; f++) {
    const a = indices[f * 3] * 3;
    const b = indices[f * 3 + 1] * 3;
    const c = indices[f * 3 + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    fnx[f] = uy * vz - uz * vy;
    fny[f] = uz * vx - ux * vz;
    fnz[f] = ux * vy - uy * vx;
  }

  // Vertex -> incident faces, as a CSR adjacency (no per-vertex arrays).
  const counts = new Uint32Array(vertexCount + 1);
  for (let i = 0; i < indices.length; i++) counts[indices[i] + 1]++;
  for (let v = 0; v < vertexCount; v++) counts[v + 1] += counts[v];
  const offsets = counts;
  const cursor = new Uint32Array(vertexCount);
  const adjacency = new Uint32Array(indices.length);
  for (let f = 0; f < faceCount; f++) {
    for (let k = 0; k < 3; k++) {
      const v = indices[f * 3 + k];
      adjacency[offsets[v] + cursor[v]++] = f;
    }
  }

  // Cluster incident faces per vertex, allocating a new vertex per cluster.
  const outNormals: number[] = [];
  const outPositions: number[] = [];
  // For each (face, corner) the index of the emitted vertex.
  const cornerVertex = new Uint32Array(indices.length);

  const clusterNx: number[] = [];
  const clusterNy: number[] = [];
  const clusterNz: number[] = [];
  const clusterVertex: number[] = [];
  const faceCluster = new Map<number, number>();

  for (let v = 0; v < vertexCount; v++) {
    const start = offsets[v];
    const end = offsets[v + 1];
    if (start === end) continue;

    clusterNx.length = 0;
    clusterNy.length = 0;
    clusterNz.length = 0;
    clusterVertex.length = 0;
    faceCluster.clear();

    for (let a = start; a < end; a++) {
      const f = adjacency[a];
      let nx = fnx[f];
      let ny = fny[f];
      let nz = fnz[f];
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      let target = -1;
      for (let c = 0; c < clusterNx.length; c++) {
        const cl = Math.hypot(clusterNx[c], clusterNy[c], clusterNz[c]) || 1;
        const dot = (clusterNx[c] * nx + clusterNy[c] * ny + clusterNz[c] * nz) / cl;
        if (dot >= cosLimit) {
          target = c;
          break;
        }
      }
      if (target === -1) {
        target = clusterNx.length;
        clusterNx.push(0);
        clusterNy.push(0);
        clusterNz.push(0);
        const nv = outPositions.length / 3;
        outPositions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
        outNormals.push(0, 0, 0);
        clusterVertex.push(nv);
      }
      // Area-weighted accumulation: use the unnormalised face normal.
      clusterNx[target] += fnx[f];
      clusterNy[target] += fny[f];
      clusterNz[target] += fnz[f];
      faceCluster.set(f, target);
    }

    for (const [f, c] of faceCluster) {
      const nv = clusterVertex[c];
      for (let k = 0; k < 3; k++) {
        if (indices[f * 3 + k] === v) cornerVertex[f * 3 + k] = nv;
      }
    }
    for (let c = 0; c < clusterVertex.length; c++) {
      const nv = clusterVertex[c];
      const len = Math.hypot(clusterNx[c], clusterNy[c], clusterNz[c]) || 1;
      outNormals[nv * 3] = clusterNx[c] / len;
      outNormals[nv * 3 + 1] = clusterNy[c] / len;
      outNormals[nv * 3 + 2] = clusterNz[c] / len;
    }
  }

  return {
    positions: Float32Array.from(outPositions),
    indices: Uint32Array.from(cornerVertex),
    normals: Float32Array.from(outNormals),
  };
}

/** Cheap smooth normals, for grayscale relief where creases are unwanted. */
export function computeSmoothNormals(mesh: PrintableMesh): Float32Array {
  const { positions, indices } = mesh;
  const normals = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    normals[a] += nx;
    normals[a + 1] += ny;
    normals[a + 2] += nz;
    normals[b] += nx;
    normals[b + 1] += ny;
    normals[b + 2] += nz;
    normals[c] += nx;
    normals[c + 1] += ny;
    normals[c + 2] += nz;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= len;
    normals[i + 1] /= len;
    normals[i + 2] /= len;
  }
  return normals;
}
