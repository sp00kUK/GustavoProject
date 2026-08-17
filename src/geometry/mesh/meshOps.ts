import type {
  ExportOrientation,
  MeshStats,
  PrintableMesh,
  PrintablePart,
} from '../../types';
import { DEGENERATE_AREA_EPSILON } from '../constants';

/** Bounding box, signed volume, surface area and radial extents. */
export function computeMeshStats(mesh: PrintableMesh): MeshStats {
  const { positions, indices } = mesh;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  let minR = Infinity;
  let maxR = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
    const r = Math.hypot(x, z);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
  }

  let volume6 = 0;
  let area2 = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const ax = positions[a];
    const ay = positions[a + 1];
    const az = positions[a + 2];
    const bx = positions[b];
    const by = positions[b + 1];
    const bz = positions[b + 2];
    const cx = positions[c];
    const cy = positions[c + 1];
    const cz = positions[c + 2];

    // 6 * signed volume of the tetrahedron (origin, a, b, c)
    volume6 +=
      ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);

    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    area2 += Math.hypot(nx, ny, nz);
  }

  if (positions.length === 0) {
    min[0] = min[1] = min[2] = 0;
    max[0] = max[1] = max[2] = 0;
    minR = 0;
    maxR = 0;
  }

  return {
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    bounds: { min, max },
    volume: volume6 / 6,
    surfaceArea: area2 / 2,
    minOuterRadius: minR,
    maxOuterRadius: maxR,
  };
}

/**
 * Drop zero-area and non-finite triangles, then drop vertices no triangle
 * references. Returns the cleaned mesh plus what was removed.
 *
 * This is a safety net, not the primary correctness mechanism: the relief
 * generators are written not to emit degenerate faces in the first place.
 */
export function cleanMesh(mesh: PrintableMesh): {
  mesh: PrintableMesh;
  removedTriangles: number;
  removedVertices: number;
} {
  const { positions, indices } = mesh;
  const keep = new Uint32Array(indices.length);
  let keepCount = 0;

  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t];
    const ib = indices[t + 1];
    const ic = indices[t + 2];
    if (ia === ib || ib === ic || ia === ic) continue;

    const a = ia * 3;
    const b = ib * 3;
    const c = ic * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const area2 = Math.hypot(nx, ny, nz);
    if (!Number.isFinite(area2) || area2 * 0.5 < DEGENERATE_AREA_EPSILON) continue;

    keep[keepCount++] = ia;
    keep[keepCount++] = ib;
    keep[keepCount++] = ic;
  }

  const removedTriangles = (indices.length - keepCount) / 3;

  // Compact vertices
  const vertexCount = positions.length / 3;
  const remap = new Int32Array(vertexCount).fill(-1);
  let newVertexCount = 0;
  for (let i = 0; i < keepCount; i++) {
    const v = keep[i];
    if (remap[v] === -1) remap[v] = newVertexCount++;
  }

  if (newVertexCount === vertexCount && removedTriangles === 0) {
    return { mesh, removedTriangles: 0, removedVertices: 0 };
  }

  const newPositions = new Float32Array(newVertexCount * 3);
  for (let v = 0; v < vertexCount; v++) {
    const n = remap[v];
    if (n === -1) continue;
    newPositions[n * 3] = positions[v * 3];
    newPositions[n * 3 + 1] = positions[v * 3 + 1];
    newPositions[n * 3 + 2] = positions[v * 3 + 2];
  }
  const newIndices = new Uint32Array(keepCount);
  for (let i = 0; i < keepCount; i++) newIndices[i] = remap[keep[i]];

  return {
    mesh: { positions: newPositions, indices: newIndices },
    removedTriangles,
    removedVertices: vertexCount - newVertexCount,
  };
}

/** Reverse every triangle's winding in place. */
export function flipWinding(mesh: PrintableMesh): void {
  const { indices } = mesh;
  for (let t = 0; t < indices.length; t += 3) {
    const tmp = indices[t + 1];
    indices[t + 1] = indices[t + 2];
    indices[t + 2] = tmp;
  }
}

export type Orientation = ExportOrientation;

/**
 * Convert kernel space into export space and lay the part on the bed.
 *
 * The kernel builds Y-up (cylinder axis = +Y, centred on the origin) because
 * that is what the WebGL viewport wants. Slicers are Z-up. Every transform
 * below is a proper rotation (det = +1) so triangle winding - and therefore
 * every outward normal - survives unchanged.
 *
 *   vertical     rotate +90 deg about X  -> axis lands on +Z (stands on end)
 *   horizontalX  cyclic permutation      -> axis lands on +X (lies down)
 *   horizontalY  identity                -> axis lands on +Y (lies down)
 *
 * Finally the model is translated so its lowest point sits at Z = 0, which is
 * where a slicer expects to find the bed.
 */
export function orientMesh(mesh: PrintableMesh, orientation: Orientation): PrintableMesh {
  const transformed = rotateForExport(mesh, orientation);
  translateMeshesToBed([transformed]);
  return transformed;
}

/**
 * Orient every independently printable object with one shared bed offset.
 * Unlike calling `orientMesh` repeatedly, this preserves the assembled
 * relationship between body, handle and bottom insert in a 3MF package.
 */
export function orientPartsTogether(
  parts: PrintablePart[],
  orientation: Orientation,
): PrintablePart[] {
  const oriented = parts.map((part) => ({
    ...part,
    mesh: rotateForExport(part.mesh, orientation),
  }));
  translateMeshesToBed(oriented.map((part) => part.mesh));
  return oriented;
}

function rotateForExport(mesh: PrintableMesh, orientation: Orientation): PrintableMesh {
  const src = mesh.positions;
  const out = new Float32Array(src.length);

  for (let i = 0; i < src.length; i += 3) {
    const x = src[i];
    const y = src[i + 1];
    const z = src[i + 2];
    switch (orientation) {
      case 'vertical':
        out[i] = x;
        out[i + 1] = -z;
        out[i + 2] = y;
        break;
      case 'horizontalX':
        out[i] = y;
        out[i + 1] = z;
        out[i + 2] = x;
        break;
      case 'horizontalY':
        out[i] = x;
        out[i + 1] = y;
        out[i + 2] = z;
        break;
    }
  }

  return { positions: out, indices: mesh.indices };
}

function translateMeshesToBed(meshes: PrintableMesh[]): void {
  let minZ = Infinity;
  for (const mesh of meshes) {
    for (let i = 2; i < mesh.positions.length; i += 3) {
      if (mesh.positions[i] < minZ) minZ = mesh.positions[i];
    }
  }
  if (!Number.isFinite(minZ) || minZ === 0) return;
  for (const mesh of meshes) {
    for (let i = 2; i < mesh.positions.length; i += 3) mesh.positions[i] -= minZ;
  }
}

/** Concatenate closed shells without welding or boolean-unioning them. */
export function mergeMeshes(meshes: PrintableMesh[]): PrintableMesh {
  const valid = meshes.filter((mesh) => mesh.positions.length > 0 && mesh.indices.length > 0);
  const vertexCount = valid.reduce((sum, mesh) => sum + mesh.positions.length / 3, 0);
  const indexCount = valid.reduce((sum, mesh) => sum + mesh.indices.length, 0);
  const positions = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount);
  let positionOffset = 0;
  let indexOffset = 0;
  let vertexOffset = 0;

  for (const mesh of valid) {
    positions.set(mesh.positions, positionOffset);
    for (let i = 0; i < mesh.indices.length; i++) {
      indices[indexOffset + i] = mesh.indices[i] + vertexOffset;
    }
    positionOffset += mesh.positions.length;
    indexOffset += mesh.indices.length;
    vertexOffset += mesh.positions.length / 3;
  }

  return { positions, indices };
}
