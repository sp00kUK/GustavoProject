import * as THREE from 'three';
import { FontLoader, type Font, type FontData } from 'three/examples/jsm/loaders/FontLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import helvetikerRegular from 'three/examples/fonts/helvetiker_regular.typeface.json';
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json';
import optimerRegular from 'three/examples/fonts/optimer_regular.typeface.json';
import type {
  OperationSettings,
  PatternSampler,
  PrintableMesh,
  PrintablePart,
  ProjectSettings,
} from '../../types';
import type { ProcessedPattern } from '../../pattern/types';
import { sampleProcessedPattern } from '../../pattern/sampler';
import { constantSampler } from '../../pattern/procedural';
import type { Resolution } from '../quality';
import {
  generateCylinderRelief,
  type GenerateCylinderReliefResult,
  type GenerationStage,
} from '../generateCylinderRelief';
import { MeshBuilder } from '../mesh/MeshBuilder';
import { cleanMesh, computeMeshStats, flipWinding, mergeMeshes } from '../mesh/meshOps';
import { validateMesh } from '../validation/validateMesh';
import { getMoldHandle1L, getMoldHandle600ml } from './moldHandles';
import {
  BASE_PROFILE_1L,
  BASE_PROFILE_600ML,
  buildLatheAccent,
  RIM_PROFILE_1L,
  RIM_PROFILE_600ML,
} from './moldAccents';

export interface GenerateMoldAssemblyOptions {
  settings: ProjectSettings;
  patternSampler: PatternSampler;
  operationSamplers?: Record<string, PatternSampler>;
  /** Primary processed art, used for the optional planar handle projection. */
  handlePattern: ProcessedPattern | null;
  /** Independently uploaded and processed bottom-logo artwork. */
  bottomLogoPattern: ProcessedPattern | null;
  /** Pre-parsed imported mesh if baseMesh.type === 'imported'. */
  importedMesh?: PrintableMesh | null;
  resolution: Resolution;
  validate?: boolean;
  onProgress?: (fraction: number, stage: GenerationStage) => void;
}

function displaceLatheMesh(
  mesh: PrintableMesh,
  sampler: PatternSampler,
  depth: number,
  isDeboss: boolean,
  op?: OperationSettings,
): PrintableMesh {
  if (depth <= 0) return mesh;
  const pos = new Float32Array(mesh.positions);
  const nVerts = pos.length / 3;
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < nVerts; i++) {
    const y = pos[i * 3 + 1];
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const ySpan = Math.max(1e-6, yMax - yMin);
  const effectiveDepth = isDeboss ? -Math.abs(depth) : Math.abs(depth);

  const cols = op ? Math.max(1, op.columns || 16) : 16;
  const rows = op ? Math.max(1, op.rows || 2) : 2;
  const scaleX = op ? Math.max(0.01, op.scaleX || 1) : 1;
  const scaleY = op ? Math.max(0.01, op.scaleY || 1) : 1;
  const offsetX = op ? op.offsetX || 0 : 0;
  const offsetY = op ? op.offsetY || 0 : 0;

  for (let i = 0; i < nVerts; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue; // Skip center caps

    const theta = Math.atan2(z, x);
    let u = ((theta / (2 * Math.PI)) + 0.5 + offsetX) * cols * scaleX;
    let v = (((y - yMin) / ySpan) + offsetY) * rows * scaleY;

    u = u - Math.floor(u);
    v = v - Math.floor(v);

    const s = sampler.sample(u, v);
    const amount = (s - 0.5) * effectiveDepth;
    const newR = Math.max(0.1, r + amount);
    pos[i * 3] = (x / r) * newR;
    pos[i * 3 + 2] = (z / r) * newR;
  }

  return cleanMesh({ positions: pos, indices: mesh.indices }).mesh;
}

export interface GenerateMoldAssemblyResult extends GenerateCylinderReliefResult {
  parts: PrintablePart[];
}

export type MoldModelKind = 'mold600ml' | 'mold1l' | 'generic';

export function detectMoldKind(settings: ProjectSettings): MoldModelKind {
  if (!settings.assembly.enabled) return 'generic';
  const { diameter, height } = settings.cylinder;
  if (Math.abs(diameter - 95) <= 2 && Math.abs(height - 105) <= 2) {
    return 'mold600ml';
  }
  if (Math.abs(diameter - 112.74) <= 2 && Math.abs(height - 126.73) <= 2) {
    return 'mold1l';
  }
  return 'generic';
}

/**
 * Generate an assembled preview while preserving independently printable
 * closed shells. No part is welded or boolean-unioned with another part.
 */
export function generateMoldAssembly(
  options: GenerateMoldAssemblyOptions,
): GenerateMoldAssemblyResult {
  const { settings, resolution, validate = true, onProgress } = options;
  const moldKind = detectMoldKind(settings);
  const target = settings.assembly.enabled ? settings.assembly.projectionTarget : 'body';
  
  const hasOps = Boolean(settings.operations && settings.operations.length > 0);
  const bodyOp = hasOps
    ? settings.operations.find((op) => op.visible && (op.targetPart === 'body' || op.targetPart === 'all'))
    : null;
  const bodyUsesPattern = hasOps
    ? !!bodyOp
    : (target === 'body' || target === 'both');

  const bodyDepth = bodyOp ? bodyOp.depth : settings.relief.depth;
  const bodySampler = bodyOp
    ? (options.operationSamplers?.[bodyOp.id] ?? (bodyOp.patternId ? options.operationSamplers?.[bodyOp.patternId] : null) ?? options.patternSampler)
    : (bodyUsesPattern ? options.patternSampler : constantSampler(0));

  const isBodyDeboss = bodyOp ? bodyOp.type === 'deboss' : settings.relief.direction === 'deboss';
  const bodyDirection = isBodyDeboss ? 'deboss' : 'emboss';

  const isSoft = (bodyOp?.smoothing ?? 0) > 0 || (settings.pattern.blur ?? 0) > 0 || settings.relief.edgeTreatment === 'soft' || settings.pattern.mode === 'grayscale';
  const effectiveMode = isSoft ? 'grayscale' : settings.pattern.mode;
  const effectiveEdgeTreatment = isSoft ? 'soft' : settings.relief.edgeTreatment;

  const bodyRelief: GenerateCylinderReliefResult = options.importedMesh
    ? {
        mesh: options.importedMesh,
        stats: computeMeshStats(options.importedMesh),
        validation: validate ? validateMesh(options.importedMesh, computeMeshStats(options.importedMesh).volume) : {
          closed: true,
          consistentWinding: true,
          outwardWinding: true,
          nonManifoldEdges: 0,
          boundaryEdges: 0,
          degenerateTriangles: 0,
          duplicateTriangles: 0,
          isolatedVertices: 0,
          nonFiniteVertices: 0,
          issues: [],
          ok: true
        },
        resolution: resolution
      }
    : generateCylinderRelief({
        cylinder: settings.cylinder,
        relief: { ...settings.relief, depth: bodyDepth, direction: bodyDirection, edgeTreatment: effectiveEdgeTreatment },
        mode: effectiveMode,
        patternSampler: bodyUsesPattern ? bodySampler : constantSampler(0),
        resolution,
        validate,
        onProgress: (fraction, stage) => onProgress?.(fraction * 0.78, stage),
      });

  let topRimMesh: PrintableMesh | null = null;
  let bottomRimMesh: PrintableMesh | null = null;

  if (moldKind === 'mold600ml') {
    bottomRimMesh = buildLatheAccent(BASE_PROFILE_600ML, resolution.radialSegments);
    topRimMesh = buildLatheAccent(RIM_PROFILE_600ML, resolution.radialSegments);
  } else if (moldKind === 'mold1l') {
    bottomRimMesh = buildLatheAccent(BASE_PROFILE_1L, resolution.radialSegments);
    topRimMesh = buildLatheAccent(RIM_PROFILE_1L, resolution.radialSegments);
  }

  // Check for operation-targeted displacement on rims
  if (settings.operations && settings.operations.length > 0) {
    for (const op of settings.operations) {
      if (!op.visible) continue;
      const sampler = options.operationSamplers?.[op.id] ?? (op.patternId ? options.operationSamplers?.[op.patternId] : null) ?? options.patternSampler;

      if ((op.targetPart === 'topRim' || op.targetPart === 'all') && topRimMesh) {
        topRimMesh = displaceLatheMesh(topRimMesh, sampler, op.depth, op.type === 'deboss', op);
      }
      if ((op.targetPart === 'bottomRim' || op.targetPart === 'all') && bottomRimMesh) {
        bottomRimMesh = displaceLatheMesh(bottomRimMesh, sampler, op.depth, op.type === 'deboss', op);
      }
    }
  }

  const bodyMeshes = [bodyRelief.mesh];
  if (bottomRimMesh) bodyMeshes.push(bottomRimMesh);
  if (topRimMesh) bodyMeshes.push(topRimMesh);

  const parts: PrintablePart[] = [
    {
      id: 'body',
      name: 'Body',
      mesh: bodyMeshes.length > 1 ? mergeMeshes(bodyMeshes) : bodyRelief.mesh,
    },
  ];

  if (settings.assembly.enabled) {
    onProgress?.(0.8, 'surface');
    const handleMeshes: PrintableMesh[] = [];

    let handleMesh: PrintableMesh = moldKind === 'mold600ml'
      ? getMoldHandle600ml()
      : moldKind === 'mold1l'
        ? getMoldHandle1L()
        : buildHandle(settings);

    const handleUsesPattern = target === 'handle' || target === 'both';

    // Apply operation displacement (cylindrical / triplanar / etc)
    if (hasOps) {
      for (const op of settings.operations) {
        if (!op.visible) continue;
        if (op.targetPart === 'handle' || op.targetPart === 'all') {
          const sampler = options.operationSamplers?.[op.id] ?? (op.patternId ? options.operationSamplers?.[op.patternId] : null) ?? options.patternSampler;
          if (sampler) {
            handleMesh = displaceHandleMesh(handleMesh, sampler, op.depth, op.type === 'deboss', op, resolution, settings.cylinder);
          }
        }
      }
    } else if (handleUsesPattern && (options.handlePattern || options.patternSampler)) {
      const sampler = options.patternSampler;
      handleMesh = displaceHandleMesh(handleMesh, sampler, settings.relief.depth, settings.relief.direction === 'deboss', undefined, resolution, settings.cylinder);
    }

    handleMeshes.push(handleMesh);

    const nameMesh = buildHandleName(settings, moldKind);
    if (nameMesh) handleMeshes.push(nameMesh);

    parts.push({
      id: 'handle',
      name: 'Handle',
      mesh: handleMeshes.length > 1 ? mergeMeshes(handleMeshes) : handleMeshes[0],
    });
  }

  if (settings.bottomLogo.enabled && options.bottomLogoPattern) {
    onProgress?.(0.87, 'surface');
    parts.push({
      id: 'bottomLogo',
      name: 'Bottom logo insert',
      mesh: buildBottomLogoInsert(settings, moldKind, options.bottomLogoPattern, resolution),
    });
  }

  onProgress?.(0.92, 'cleanup');
  const mesh = mergeMeshes(parts.map((part) => part.mesh));
  const stats = computeMeshStats(mesh);
  const validation = validate ? validateMesh(mesh, stats.volume) : bodyRelief.validation;
  onProgress?.(1, 'done');

  return {
    ...bodyRelief,
    mesh,
    stats,
    validation,
    parts,
  };
}

interface HandlePlacement {
  xOuter: number;
  yBottom: number;
  yTop: number;
  bar: number;
  depth: number;
}

function getHandlePlacement(settings: ProjectSettings, moldKind: MoldModelKind): HandlePlacement {
  if (moldKind === 'mold600ml') {
    return {
      xOuter: 90.42,
      yBottom: -52.57,
      yTop: 52.12,
      bar: 13,
      depth: 25.0,
    };
  }
  if (moldKind === 'mold1l') {
    return {
      xOuter: 111.69,
      yBottom: -62.79,
      yTop: 62.4,
      bar: 15,
      depth: 29.7,
    };
  }
  const radius = settings.cylinder.diameter / 2;
  const gap = Math.max(0.05, settings.assembly.partGap);
  const xInner = radius + gap;
  const yExtent = settings.cylinder.height * 0.36;
  const requestedBar = Math.max(2, settings.assembly.handleBarWidth);
  const extension = Math.max(requestedBar * 2.4, settings.assembly.handleExtension);
  const bar = Math.min(requestedBar, extension * 0.38, yExtent * 0.72);
  return {
    xOuter: xInner + extension,
    yBottom: -yExtent,
    yTop: yExtent,
    bar,
    depth: Math.max(2, settings.assembly.handleDepth),
  };
}

/** A watertight generic C/U-shaped prism for custom cylinder dimensions. */
function buildHandle(settings: ProjectSettings): PrintableMesh {
  const radius = settings.cylinder.diameter / 2;
  const gap = Math.max(0.05, settings.assembly.partGap);
  const xInner = radius + gap;
  const yExtent = settings.cylinder.height * 0.36;
  const requestedBar = Math.max(2, settings.assembly.handleBarWidth);
  const extension = Math.max(requestedBar * 2.4, settings.assembly.handleExtension);
  const bar = Math.min(requestedBar, extension * 0.38, yExtent * 0.72);
  const xOuter = xInner + extension;
  const depth = Math.max(2, settings.assembly.handleDepth);

  const shape = new THREE.Shape();
  shape.moveTo(xInner, yExtent);
  shape.lineTo(xOuter, yExtent);
  shape.lineTo(xOuter, -yExtent);
  shape.lineTo(xInner, -yExtent);
  shape.lineTo(xInner, -yExtent + bar);
  shape.lineTo(xOuter - bar, -yExtent + bar);
  shape.lineTo(xOuter - bar, yExtent - bar);
  shape.lineTo(xInner, yExtent - bar);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return printableFromGeometry(geometry);
}

function subdivideHandleMesh(mesh: PrintableMesh, maxEdgeLength: number = 0.85, maxIters: number = 4): PrintableMesh {
  let positions = Array.from(mesh.positions);
  let indices = Array.from(mesh.indices);
  const maxEdgeLenSq = maxEdgeLength * maxEdgeLength;

  for (let iter = 0; iter < maxIters; iter++) {
    let splitCount = 0;
    const nextIndices: number[] = [];
    const midMap = new Map<string, number>();

    const getMidpoint = (i1: number, i2: number): number => {
      const a = Math.min(i1, i2);
      const b = Math.max(i1, i2);
      const key = `${a}_${b}`;
      const existing = midMap.get(key);
      if (existing !== undefined) return existing;

      const idx = positions.length / 3;
      positions.push(
        (positions[a * 3] + positions[b * 3]) * 0.5,
        (positions[a * 3 + 1] + positions[b * 3 + 1]) * 0.5,
        (positions[a * 3 + 2] + positions[b * 3 + 2]) * 0.5,
      );
      midMap.set(key, idx);
      splitCount++;
      return idx;
    };

    for (let t = 0; t < indices.length; t += 3) {
      const i0 = indices[t];
      const i1 = indices[t + 1];
      const i2 = indices[t + 2];

      const x0 = positions[i0 * 3], y0 = positions[i0 * 3 + 1], z0 = positions[i0 * 3 + 2];
      const x1 = positions[i1 * 3], y1 = positions[i1 * 3 + 1], z1 = positions[i1 * 3 + 2];
      const x2 = positions[i2 * 3], y2 = positions[i2 * 3 + 1], z2 = positions[i2 * 3 + 2];

      const d01Sq = (x1 - x0) ** 2 + (y1 - y0) ** 2 + (z1 - z0) ** 2;
      const d12Sq = (x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2;
      const d20Sq = (x0 - x2) ** 2 + (y0 - y2) ** 2 + (z0 - z2) ** 2;

      const s01 = d01Sq > maxEdgeLenSq;
      const s12 = d12Sq > maxEdgeLenSq;
      const s20 = d20Sq > maxEdgeLenSq;

      if (s01 && s12 && s20) {
        const m01 = getMidpoint(i0, i1);
        const m12 = getMidpoint(i1, i2);
        const m20 = getMidpoint(i2, i0);
        nextIndices.push(
          i0, m01, m20,
          m01, i1, m12,
          m20, m12, i2,
          m01, m12, m20
        );
      } else if (s01 && s12) {
        const m01 = getMidpoint(i0, i1);
        const m12 = getMidpoint(i1, i2);
        nextIndices.push(
          i0, m01, i2,
          m01, m12, i2,
          m01, i1, m12
        );
      } else if (s12 && s20) {
        const m12 = getMidpoint(i1, i2);
        const m20 = getMidpoint(i2, i0);
        nextIndices.push(
          i1, m12, i0,
          m12, m20, i0,
          m12, i2, m20
        );
      } else if (s20 && s01) {
        const m20 = getMidpoint(i2, i0);
        const m01 = getMidpoint(i0, i1);
        nextIndices.push(
          i2, m20, i1,
          m20, m01, i1,
          m20, i0, m01
        );
      } else if (s01) {
        const m01 = getMidpoint(i0, i1);
        nextIndices.push(i0, m01, i2, m01, i1, i2);
      } else if (s12) {
        const m12 = getMidpoint(i1, i2);
        nextIndices.push(i1, m12, i0, m12, i2, i0);
      } else if (s20) {
        const m20 = getMidpoint(i2, i0);
        nextIndices.push(i2, m20, i1, m20, i0, i1);
      } else {
        nextIndices.push(i0, i1, i2);
      }
    }

    indices = nextIndices;
    if (splitCount === 0) break;
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

function displaceHandleMesh(
  mesh: PrintableMesh,
  sampler: PatternSampler,
  depth: number,
  isDeboss: boolean,
  op?: OperationSettings,
  resolution?: Resolution,
  cylinderDim: { diameter: number; height: number } = { diameter: 95, height: 105 },
): PrintableMesh {
  if (depth <= 0) return mesh;

  const targetEdge = resolution ? Math.max(0.4, Math.min(1.2, resolution.spacingMm * 1.2)) : 0.85;
  const subdivided = subdivideHandleMesh(mesh, targetEdge, 5);
  const pos = new Float32Array(subdivided.positions);
  const ind = subdivided.indices;
  const nVerts = pos.length / 3;
  const nTris = ind.length / 3;

  // Compute smooth vertex normals
  const nrm = new Float32Array(nVerts * 3);
  for (let t = 0; t < nTris; t++) {
    const i0 = ind[t * 3];
    const i1 = ind[t * 3 + 1];
    const i2 = ind[t * 3 + 2];

    const ax = pos[i1 * 3] - pos[i0 * 3];
    const ay = pos[i1 * 3 + 1] - pos[i0 * 3 + 1];
    const az = pos[i1 * 3 + 2] - pos[i0 * 3 + 2];

    const bx = pos[i2 * 3] - pos[i0 * 3];
    const by = pos[i2 * 3 + 1] - pos[i0 * 3 + 1];
    const bz = pos[i2 * 3 + 2] - pos[i0 * 3 + 2];

    const fnx = ay * bz - az * by;
    const fny = az * bx - ax * bz;
    const fnz = ax * by - ay * bx;

    nrm[i0 * 3] += fnx; nrm[i0 * 3 + 1] += fny; nrm[i0 * 3 + 2] += fnz;
    nrm[i1 * 3] += fnx; nrm[i1 * 3 + 1] += fny; nrm[i1 * 3 + 2] += fnz;
    nrm[i2 * 3] += fnx; nrm[i2 * 3 + 1] += fny; nrm[i2 * 3 + 2] += fnz;
  }

  for (let i = 0; i < nVerts; i++) {
    const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
    const len = Math.hypot(nx, ny, nz) || 1e-6;
    nrm[i * 3] = nx / len;
    nrm[i * 3 + 1] = ny / len;
    nrm[i * 3 + 2] = nz / len;
  }

  // Compute bounds
  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  let zMin = Infinity, zMax = -Infinity;
  for (let i = 0; i < nVerts; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (x < xMin) xMin = x; if (x > xMax) xMax = x;
    if (y < yMin) yMin = y; if (y > yMax) yMax = y;
    if (z < zMin) zMin = z; if (z > zMax) zMax = z;
  }

  const effectiveDepth = isDeboss ? -Math.abs(depth) : Math.abs(depth);
  const cols = op ? Math.max(1, op.columns || 6) : 6;
  const rows = op ? Math.max(1, op.rows || 6) : 6;
  const scaleX = op ? Math.max(0.01, op.scaleX || 1) : 1;
  const scaleY = op ? Math.max(0.01, op.scaleY || 1) : 1;
  const offsetX = op ? op.offsetX || 0 : 0;
  const offsetY = op ? op.offsetY || 0 : 0;
  const rotRad = (op?.rotation || 0) * Math.PI / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  const mode = op?.projectionMode || 'triplanar';

  // Physical tile metric size in mm matching Bumpmesh isotropic scaling
  const circ = Math.PI * cylinderDim.diameter;
  const tileWidthMm = circ / (cols * scaleX);
  const triTileMm = Math.max(tileWidthMm, 1);

  const transformUV = (u: number, v: number): [number, number] => {
    let uu = u + offsetX;
    let vv = v + offsetY;
    if (cosR !== 1 || sinR !== 0) {
      const cu = uu - 0.5;
      const cv = vv - 0.5;
      uu = cu * cosR - cv * sinR + 0.5;
      vv = cu * sinR + cv * cosR + 0.5;
    }
    return [uu - Math.floor(uu), vv - Math.floor(vv)];
  };

  for (let i = 0; i < nVerts; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const nx = nrm[i * 3];
    const ny = nrm[i * 3 + 1];
    const nz = nrm[i * 3 + 2];

    // Smooth falloff where handle connects to tankard body at xMin
    const attachDist = x - xMin;
    const blendZone = 3.0; // 3mm smooth transition from tankard body
    const blendFactor = Math.min(1, Math.max(0, attachDist / blendZone));
    if (blendFactor <= 0) continue;

    let sampleVal = 0.5;

    if (mode === 'triplanar' || mode === 'cubic') {
      // Bumpmesh cubic blending: n^4 weights
      const ax = Math.abs(nx);
      const ay = Math.abs(ny);
      const az = Math.abs(nz);
      const bx = ax ** 4;
      const by = ay ** 4;
      const bz = az ** 4;
      const sum = bx + by + bz + 1e-6;
      const wx = bx / sum;
      const wy = by / sum;
      const wz = bz / sum;

      // Exact Bumpmesh triplanar projection coordinate math:
      // Side (YZ plane): U is Y (or -Y if normal.x < 0), V is Z
      let yzU = (y - yMin) / triTileMm;
      if (nx < 0) yzU = -yzU;
      const yzV = (z - zMin) / triTileMm;

      // Top/Bottom (XZ plane): U is X (or -X if normal.y > 0), V is Z
      let xzU = (x - xMin) / triTileMm;
      if (ny > 0) xzU = -xzU;
      const xzV = (z - zMin) / triTileMm;

      // Front/Back (XY plane): U is X (or -X if normal.z < 0), V is Y
      let xyU = (x - xMin) / triTileMm;
      if (nz < 0) xyU = -xyU;
      const xyV = (y - yMin) / triTileMm;

      const [tYZ_u, tYZ_v] = transformUV(yzU, yzV);
      const [tXZ_u, tXZ_v] = transformUV(xzU, xzV);
      const [tXY_u, tXY_v] = transformUV(xyU, xyV);

      const sYZ = sampler.sample(tYZ_u, tYZ_v);
      const sXZ = sampler.sample(tXZ_u, tXZ_v);
      const sXY = sampler.sample(tXY_u, tXY_v);

      sampleVal = wx * sYZ + wy * sXZ + wz * sXY;
    } else if (mode === 'cylindrical') {
      // Cylindrical projection around tankard body center (0, 0)
      const theta = Math.atan2(z, x);
      const uCyl = (theta / (2 * Math.PI)) + 0.5;
      const vCyl = (y - (-cylinderDim.height / 2)) / cylinderDim.height;
      const [uu, vv] = transformUV(uCyl * cols * scaleX, vCyl * rows * scaleY);
      sampleVal = sampler.sample(uu, vv);
    } else if (mode === 'planar_xy') {
      const [uXY, vXY] = transformUV((x - xMin) / triTileMm, (y - yMin) / triTileMm);
      sampleVal = sampler.sample(uXY, vXY);
    } else if (mode === 'planar_xz') {
      const [uXZ, vXZ] = transformUV((x - xMin) / triTileMm, (z - zMin) / triTileMm);
      sampleVal = sampler.sample(uXZ, vXZ);
    } else if (mode === 'planar_yz') {
      const [uYZ, vYZ] = transformUV((z - zMin) / triTileMm, (y - yMin) / triTileMm);
      sampleVal = sampler.sample(uYZ, vYZ);
    }

    const disp = (sampleVal - 0.5) * effectiveDepth * blendFactor;
    pos[i * 3] += nx * disp;
    pos[i * 3 + 1] += ny * disp;
    pos[i * 3 + 2] += nz * disp;
  }

  return cleanMesh({
    positions: pos,
    indices: ind,
  }).mesh;
}

const fontLoader = new FontLoader();
const FONTS: Record<ProjectSettings['handleName']['font'], Font> = {
  modern: fontLoader.parse(helvetikerRegular as unknown as FontData),
  bold: fontLoader.parse(helvetikerBold as unknown as FontData),
  classic: fontLoader.parse(optimerRegular as unknown as FontData),
};

/**
 * Filter zero-length and microscopic curve segments from font outlines.
 * Three.js FontLoader path generation occasionally produces zero-length curve
 * segments at closed loop endpoints which break planar triangulation and create
 * open boundary edges in ExtrudeGeometry.
 */
function sanitizeShape(shape: THREE.Shape): THREE.Shape {
  const clean = new THREE.Shape();
  clean.curves = shape.curves.filter((curve) => {
    const p1 = curve.getPoint(0);
    const p2 = curve.getPoint(1);
    return Math.hypot(p2.x - p1.x, p2.y - p1.y) > 1e-5;
  });
  clean.holes = shape.holes.map((hole) => {
    const cleanHole = new THREE.Path();
    cleanHole.curves = hole.curves.filter((curve) => {
      const p1 = curve.getPoint(0);
      const p2 = curve.getPoint(1);
      return Math.hypot(p2.x - p1.x, p2.y - p1.y) > 1e-5;
    });
    return cleanHole;
  });
  return clean;
}

function buildHandleName(
  settings: ProjectSettings,
  moldKind: MoldModelKind,
): PrintableMesh | null {
  const text = settings.handleName.text.replace(/[^a-zA-Z0-9 ._-]/g, '').trim().slice(0, 24);
  if (!settings.handleName.enabled || !text) return null;
  const { xOuter, yBottom, yTop, bar, depth } = getHandlePlacement(settings, moldKind);

  const font = FONTS[settings.handleName.font];
  const rawShapes = font.generateShapes(text, 10);
  const shapes = rawShapes.map(sanitizeShape);

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: Math.max(0.2, settings.handleName.depth),
    curveSegments: 2,
    bevelEnabled: false,
    steps: 1,
  });

  // Vertical lettering fits along the handle's outside vertical bar.
  geometry.rotateZ(Math.PI / 2);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return null;
  const width = Math.max(1e-6, box.max.x - box.min.x);
  const height = Math.max(1e-6, box.max.y - box.min.y);
  const availableHeight = Math.max(bar, (yTop - yBottom) * 0.72);
  const scale = Math.min((bar * 0.65) / width, availableHeight / height);
  geometry.scale(scale, scale, 1);
  geometry.computeBoundingBox();
  const scaled = geometry.boundingBox!;
  const centerX = (scaled.min.x + scaled.max.x) / 2;
  const centerY = (scaled.min.y + scaled.max.y) / 2;
  geometry.translate(
    xOuter - bar * 0.45 - centerX,
    (yBottom + yTop) / 2 - centerY,
    depth / 2 - 0.12,
  );
  return printableFromGeometry(geometry);
}

/** Circular, independently printable bottom stamp with an image-derived face. */
function buildBottomLogoInsert(
  settings: ProjectSettings,
  moldKind: MoldModelKind,
  pattern: ProcessedPattern,
  resolution: Resolution,
): PrintableMesh {
  const radius = Math.max(2, settings.bottomLogo.diameter / 2);
  const rings = clampInt(Math.ceil(radius / resolution.spacingMm), 8, 128);
  const segments = clampInt(Math.ceil((Math.PI * 2 * radius) / resolution.spacingMm), 48, 512);
  const relief = Math.max(0.05, settings.bottomLogo.reliefDepth);

  let baseFloor = -settings.cylinder.height / 2;
  if (moldKind === 'mold600ml') {
    baseFloor = -87.59;
  } else if (moldKind === 'mold1l') {
    baseFloor = -103.47;
  }

  const topBase = baseFloor - settings.bottomLogo.previewGap - relief;
  const bottomY = topBase - Math.max(0.4, settings.bottomLogo.plateThickness);
  const builder = new MeshBuilder(
    rings * segments + segments + 2,
    rings * segments * 2 + segments * 3,
  );

  const maskAt = (x: number, z: number) =>
    sampleProcessedPattern(
      pattern,
      clampUv(x / (radius * 2) + 0.5),
      clampUv(z / (radius * 2) + 0.5),
    );

  const topCenter = builder.vertex(-1, 0, topBase + relief * maskAt(0, 0), 0);
  const topRings: Uint32Array[] = [];
  for (let ring = 1; ring <= rings; ring++) {
    const rr = (radius * ring) / rings;
    const vertices = new Uint32Array(segments);
    for (let i = 0; i < segments; i++) {
      const angle = (Math.PI * 2 * i) / segments;
      const x = Math.cos(angle) * rr;
      const z = Math.sin(angle) * rr;
      vertices[i] = builder.vertex(-1, x, topBase + relief * maskAt(x, z), z);
    }
    topRings.push(vertices);
  }

  const first = topRings[0];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    builder.triangle(topCenter, first[next], first[i]);
  }
  for (let ring = 1; ring < topRings.length; ring++) {
    const inner = topRings[ring - 1];
    const outer = topRings[ring];
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      builder.quad(inner[i], inner[next], outer[next], outer[i]);
    }
  }

  const bottomCenter = builder.vertex(-1, 0, bottomY, 0);
  const bottomRing = new Uint32Array(segments);
  const outerTop = topRings[topRings.length - 1];
  for (let i = 0; i < segments; i++) {
    const angle = (Math.PI * 2 * i) / segments;
    bottomRing[i] = builder.vertex(
      -1,
      Math.cos(angle) * radius,
      bottomY,
      Math.sin(angle) * radius,
    );
  }
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    builder.triangle(bottomCenter, bottomRing[i], bottomRing[next]);
    builder.quad(outerTop[i], outerTop[next], bottomRing[next], bottomRing[i]);
  }

  return ensureOutward(cleanMesh(builder.build()).mesh);
}

function printableFromGeometry(geometry: THREE.BufferGeometry): PrintableMesh {
  for (const attribute of Object.keys(geometry.attributes)) {
    if (attribute !== 'position') geometry.deleteAttribute(attribute);
  }
  const welded = mergeVertices(geometry, 1e-4);
  const position = welded.getAttribute('position');
  const index = welded.getIndex();
  const positions = new Float32Array(position.array.length);
  positions.set(position.array as ArrayLike<number>);
  const indices = index
    ? new Uint32Array(index.array as ArrayLike<number>)
    : Uint32Array.from({ length: position.count }, (_, i) => i);
  geometry.dispose();
  welded.dispose();
  return ensureOutward(cleanMesh({ positions, indices }).mesh);
}

function ensureOutward(mesh: PrintableMesh): PrintableMesh {
  if (computeMeshStats(mesh).volume < 0) flipWinding(mesh);
  return mesh;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampUv(value: number): number {
  return Math.max(0, Math.min(1 - 1e-9, value));
}
