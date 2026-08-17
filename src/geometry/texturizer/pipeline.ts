import * as THREE from 'three';
import { subdivide, SubdivideOutput, SubdivideInput } from './subdivision';
import { applyDisplacement } from './displacement';
import { decimate } from './decimation';
import { buildFaceWeights } from './exclusion';
import type { OperationSettings, PrintableMesh } from '../../types';
import type { PatternSampler } from '../../types';
import { 
  MODE_PLANAR_XY, 
  MODE_PLANAR_XZ, 
  MODE_PLANAR_YZ, 
  MODE_CYLINDRICAL, 
  MODE_SPHERICAL, 
  MODE_TRIPLANAR, 
  MODE_CUBIC, 
  type MappingSettings, 
  type Bounds 
} from './mapping';

export interface TexturizerOptions {
  baseMesh: PrintableMesh;
  operations: OperationSettings[];
  samplers: Record<string, PatternSampler>;
  masks: Record<string, Uint8Array>;
  targetTriangleCount?: number;
  onProgress?: (progress: number, stage: string) => void;
}

function computeBounds(positions: Float32Array): Bounds {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i+1], z = positions[i+2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: { x: (minX + maxX)/2, y: (minY + maxY)/2, z: (minZ + maxZ)/2 },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
  };
}

function toBufferGeometry(mesh: { positions: Float32Array, indices?: Uint32Array, normals?: Float32Array }): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  if (mesh.normals) geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  if (mesh.indices) geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return geo;
}

export async function applyTexturizerPipeline(options: TexturizerOptions): Promise<PrintableMesh> {
  let currentMesh: { positions: Float32Array, indices?: Uint32Array, normals?: Float32Array } = options.baseMesh;

  const hasActiveSamplers = options.operations.some(
    (op) => op.visible && op.patternId && options.samplers[op.patternId]
  );
  if (!hasActiveSamplers) {
    return options.baseMesh;
  }

  let subdivided: SubdivideOutput | null = null;

  for (let i = 0; i < options.operations.length; i++) {
    const op = options.operations[i];
    if (!op.visible) continue;
    
    options.onProgress?.(i / options.operations.length, 'Operation ' + (i+1));

    let faceWeights: Float32Array | null = null;
    if (op.maskId && options.masks[op.maskId]) {
      const geo = toBufferGeometry(currentMesh);
      const maskData = options.masks[op.maskId];
      faceWeights = buildFaceWeights(geo, maskData, false);
    }

    // Part-specific spatial masking if targeting a specific part
    if (op.targetPart && op.targetPart !== 'all') {
      const bounds = computeBounds(currentMesh.positions);
      const nFaces = currentMesh.indices ? currentMesh.indices.length / 3 : currentMesh.positions.length / 9;
      const partWeights = new Float32Array(nFaces);
      const pos = currentMesh.positions;
      const idx = currentMesh.indices;
      const radiusApprox = Math.max(bounds.size.x, bounds.size.y) * 0.48;

      for (let f = 0; f < nFaces; f++) {
        const i0 = idx ? idx[f * 3] : f * 3;
        const i1 = idx ? idx[f * 3 + 1] : f * 3 + 1;
        const i2 = idx ? idx[f * 3 + 2] : f * 3 + 2;
        const cx = (pos[i0 * 3] + pos[i1 * 3] + pos[i2 * 3]) / 3;
        const cy = (pos[i0 * 3 + 1] + pos[i1 * 3 + 1] + pos[i2 * 3 + 1]) / 3;

        const isHandle = cx > (bounds.center.x + radiusApprox + 0.5);
        const isTopRim = !isHandle && cy > bounds.max.y - 15;
        const isBottomRim = !isHandle && cy < bounds.min.y + 17;
        const isBody = !isHandle && !isTopRim && !isBottomRim;

        if (op.targetPart === 'handle' && isHandle) partWeights[f] = 1;
        else if (op.targetPart === 'topRim' && isTopRim) partWeights[f] = 1;
        else if (op.targetPart === 'bottomRim' && isBottomRim) partWeights[f] = 1;
        else if (op.targetPart === 'body' && isBody) partWeights[f] = 1;
      }

      if (faceWeights) {
        for (let f = 0; f < nFaces; f++) {
          faceWeights[f] *= partWeights[f];
        }
      } else {
        faceWeights = partWeights;
      }
    }

    const targetEdgeLength = 1.5; // Adaptive edge length
    
    if (!subdivided) {
      const input = currentMesh as SubdivideInput;
      const triCount = (input.indices?.length ?? input.positions.length / 3) / 3;
      if (triCount >= 50_000) {
        // Already dense mesh, use fast indexed conversion
        subdivided = {
          positions: input.positions,
          normals: (input as any).normals ?? new Float32Array(input.positions.length),
          excludeWeights: faceWeights,
          safetyCapHit: false,
          faceParentId: new Int32Array(triCount),
        };
      } else {
        subdivided = await subdivide(input, targetEdgeLength, (p: number) => {
          options.onProgress?.(i / options.operations.length + p * 0.25, 'Subdividing');
        }, faceWeights, { fast: true });
      }
    } else if (faceWeights) {
      subdivided.excludeWeights = faceWeights;
    }

    const sampler = op.patternId && options.samplers[op.patternId] ? options.samplers[op.patternId] : null;
    if (sampler && subdivided) {
      const bounds = computeBounds(subdivided.positions);
      const modeMap: Record<string, number> = {
        'planar': MODE_PLANAR_XY,
        'planar_xy': MODE_PLANAR_XY,
        'planar_xz': MODE_PLANAR_XZ,
        'planar_yz': MODE_PLANAR_YZ,
        'planar_z': MODE_PLANAR_XY,
        'planar_x': MODE_PLANAR_YZ,
        'planar_y': MODE_PLANAR_XZ,
        'cylindrical': MODE_CYLINDRICAL,
        'spherical': MODE_SPHERICAL,
        'triplanar': MODE_TRIPLANAR,
        'cubic': MODE_CUBIC,
      };
      
      const mode = modeMap[op.projectionMode] ?? MODE_CYLINDRICAL;
      const refR = Math.max(bounds.size.x, bounds.size.y) * 0.5;
      const circumference = 2 * Math.PI * refR;
      const height = bounds.size.z || Math.max(bounds.size.x, bounds.size.y);
      const cols = Math.max(1, op.columns || 4);
      const rows = Math.max(1, op.rows || 8);
      const scaleXMult = Math.max(0.01, op.scaleX || 1);
      const scaleYMult = Math.max(0.01, op.scaleY || 1);

      const scaleUMm = (circumference / cols) / scaleXMult;
      const scaleVMm = (height / rows) / scaleYMult;

      const mappingSettings: MappingSettings & any = {
        mappingMode: mode,
        scaleU: scaleUMm,
        scaleV: scaleVMm,
        offsetU: op.offsetX,
        offsetV: op.offsetY,
        rotation: op.rotation,
        amplitude: op.type === 'deboss' ? -Math.abs(op.depth) : Math.abs(op.depth),
        snapSeamlessWrap: op.snapSeamlessWrap ?? true,
        cylinderRadius: refR,
        cylinderCenterX: bounds.center.x,
        cylinderCenterY: bounds.center.y,
        boundaryFalloff: 0, 
        noDownwardZ: false
      };
      
      const dispOut = applyDisplacement(
        subdivided,
        sampler,
        mappingSettings,
        bounds,
        (p: number) => options.onProgress?.(i / options.operations.length + 0.25 + p * 0.25, 'Displacing')
      );
      
      subdivided.positions = dispOut.positions;
      subdivided.normals = dispOut.normals;
    }
  }

  if (!subdivided) {
    return options.baseMesh;
  }

  let outGeo = toBufferGeometry(subdivided);

  const maxTris = options.targetTriangleCount || 1000000;
  if (subdivided.positions.length / 9 > maxTris) {
    options.onProgress?.(0.9, 'Decimating');
    outGeo = await decimate(outGeo, maxTris, (p) => options.onProgress?.(0.9 + p * 0.1, 'Decimating'));
  }

  const p = outGeo.attributes.position.array as Float32Array;
  let idx: Uint32Array;
  if (outGeo.index) {
      idx = outGeo.index.array as Uint32Array;
  } else {
      idx = new Uint32Array(p.length / 3);
      for (let k = 0; k < idx.length; k++) idx[k] = k;
  }
  return { positions: p, indices: idx };
}
