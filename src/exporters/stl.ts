import type { PrintableMesh } from '../types';
import type { ExportContext, MeshExporter } from './types';
import { APP_VERSION } from '../types';

/**
 * ============================================================================
 * BINARY STL
 * ============================================================================
 *
 * Layout: 80 byte header, uint32 triangle count, then 50 bytes per facet -
 * a float32 normal, three float32 vertices, and a uint16 attribute word.
 *
 * STL carries no unit information, so the contract is simply that one unit
 * equals one millimetre. A 50 mm roller therefore exports with a 50 unit
 * bounding box, which every slicer reads as 50 mm.
 *
 * Facet normals are recomputed from the triangle itself rather than copied
 * from any display normal, so the file describes the geometry and not the
 * shading.
 */
export class STLExporter implements MeshExporter {
  readonly extension = 'stl';
  readonly mimeType = 'model/stl';

  async export(mesh: PrintableMesh, context: ExportContext): Promise<Blob> {
    return new Blob([writeBinarySTL(mesh, context)], { type: this.mimeType });
  }
}

export function writeBinarySTL(mesh: PrintableMesh, context?: ExportContext): ArrayBuffer {
  const { positions, indices } = mesh;
  const triangleCount = indices.length / 3;
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const header = `Cylindrical Pattern Debosser v${APP_VERSION} - units: millimetres`;
  for (let i = 0; i < Math.min(79, header.length); i++) {
    bytes[i] = header.charCodeAt(i) & 0x7f;
  }

  view.setUint32(80, triangleCount, true);

  let offset = 84;
  const reportEvery = Math.max(1, Math.floor(triangleCount / 50));

  for (let t = 0; t < triangleCount; t++) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;

    const ax = positions[a];
    const ay = positions[a + 1];
    const az = positions[a + 2];
    const bx = positions[b];
    const by = positions[b + 1];
    const bz = positions[b + 2];
    const cx = positions[c];
    const cy = positions[c + 1];
    const cz = positions[c + 2];

    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 0) {
      nx /= len;
      ny /= len;
      nz /= len;
    } else {
      nx = ny = nz = 0;
    }

    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);
    view.setFloat32(offset + 12, ax, true);
    view.setFloat32(offset + 16, ay, true);
    view.setFloat32(offset + 20, az, true);
    view.setFloat32(offset + 24, bx, true);
    view.setFloat32(offset + 28, by, true);
    view.setFloat32(offset + 32, bz, true);
    view.setFloat32(offset + 36, cx, true);
    view.setFloat32(offset + 40, cy, true);
    view.setFloat32(offset + 44, cz, true);
    view.setUint16(offset + 48, 0, true);
    offset += 50;

    if (t % reportEvery === 0) {
      context?.onProgress?.(t / triangleCount);
      if (context?.shouldCancel?.()) throw new Error('Export cancelled');
    }
  }

  context?.onProgress?.(1);
  return buffer;
}
