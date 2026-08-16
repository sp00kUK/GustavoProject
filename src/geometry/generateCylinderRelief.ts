import type {
  CylinderSettings,
  GeneratedModel,
  PatternMode,
  PatternSampler,
  ReliefSettings,
} from '../types';
import { ReliefField } from './relief/reliefField';
import { buildBinaryRelief, CancelledError } from './relief/binaryRelief';
import { buildGrayscaleRelief } from './relief/grayscaleRelief';
import { cleanMesh, computeMeshStats } from './mesh/meshOps';
import { validateMesh } from './validation/validateMesh';
import type { Resolution } from './quality';

export { CancelledError };

export type GenerationStage =
  | 'pattern'
  | 'surface'
  | 'caps'
  | 'cleanup'
  | 'validation'
  | 'done';

export const STAGE_LABELS: Record<GenerationStage, string> = {
  pattern: 'Preparing pattern',
  surface: 'Generating cylindrical topology',
  caps: 'Closing end caps',
  cleanup: 'Cleaning geometry',
  validation: 'Validating mesh',
  done: 'Done',
};

export interface GenerateCylinderReliefOptions {
  cylinder: CylinderSettings;
  relief: ReliefSettings;
  mode: PatternMode;
  patternSampler: PatternSampler;
  resolution: Resolution;
  /** Skip the manifold audit (preview only). Defaults to true. */
  validate?: boolean;
  onProgress?: (fraction: number, stage: GenerationStage) => void;
  shouldCancel?: () => boolean;
}

export interface GenerateCylinderReliefResult extends GeneratedModel {
  /** Diagnostics from binary pinch resolution, absent in grayscale mode. */
  pinchFixes?: number;
  unresolvedPinches?: number;
}

/**
 * ============================================================================
 * THE ENTRY POINT
 * ============================================================================
 *
 * DO NOT subtract a texture from a cylinder. GENERATE the textured cylinder.
 *
 * The desired outer radius is a known function of (theta, y), so the surface
 * is emitted directly at that radius and then closed with real end caps and a
 * real bore wall. There is no CSG anywhere in this pipeline, which is why it
 * scales to millions of triangles without producing the self-intersections,
 * inverted normals and coplanar-face failures that repeated boolean
 * subtraction is famous for.
 *
 * Nothing in this file knows about React, Three.js, images or the DOM.
 */
export function generateCylinderRelief(
  opts: GenerateCylinderReliefOptions,
): GenerateCylinderReliefResult {
  const {
    cylinder,
    relief,
    mode,
    patternSampler,
    resolution,
    validate = true,
    onProgress,
    shouldCancel,
  } = opts;

  const report = (fraction: number, stage: GenerationStage) =>
    onProgress?.(Math.min(1, Math.max(0, fraction)), stage);

  report(0, 'pattern');

  const radius = cylinder.diameter / 2;
  const boreRadius = cylinder.boreEnabled ? cylinder.boreDiameter / 2 : null;

  const field = new ReliefField({
    height: cylinder.height,
    bottomMargin: relief.bottomMargin,
    topMargin: relief.topMargin,
    sampler: patternSampler,
  });

  // A binary pattern with softened edges is, by definition, no longer binary:
  // it is a continuous mask, so it is built by the continuous generator.
  const effectiveMode: PatternMode =
    mode === 'binary' && relief.edgeTreatment === 'soft' ? 'grayscale' : mode;

  const common = {
    radius,
    height: cylinder.height,
    depth: relief.depth,
    direction: relief.direction,
    boreRadius,
    radialSegments: resolution.radialSegments,
    verticalSegments: resolution.verticalSegments,
    field,
    shouldCancel,
    onProgress: (f: number) => report(0.05 + f * 0.6, f < 0.85 ? 'surface' : 'caps'),
  };

  let raw;
  let pinchFixes: number | undefined;
  let unresolvedPinches: number | undefined;

  if (effectiveMode === 'binary') {
    const result = buildBinaryRelief(common);
    raw = result.mesh;
    pinchFixes = result.pinchFixes;
    unresolvedPinches = result.unresolvedPinches;
  } else {
    raw = buildGrayscaleRelief(common).mesh;
  }

  if (shouldCancel?.()) throw new CancelledError();
  report(0.7, 'cleanup');

  const cleaned = cleanMesh(raw);
  const mesh = cleaned.mesh;
  const stats = computeMeshStats(mesh);

  report(0.8, 'validation');

  const validation = validate
    ? validateMesh(mesh, stats.volume)
    : {
        closed: true,
        consistentWinding: true,
        outwardWinding: stats.volume > 0,
        nonManifoldEdges: 0,
        boundaryEdges: 0,
        degenerateTriangles: 0,
        duplicateTriangles: 0,
        isolatedVertices: 0,
        nonFiniteVertices: 0,
        issues: [],
        ok: true,
      };

  if (unresolvedPinches && unresolvedPinches > 0) {
    validation.issues.push({
      severity: 'warning',
      code: 'UNRESOLVED_PINCH',
      message:
        `${unresolvedPinches} location(s) where the pattern is finer than a single ` +
        `mesh cell could not be separated. Increase Mesh Detail or reduce ` +
        `pattern repeats.`,
      detail: { count: unresolvedPinches },
    });
  }

  report(1, 'done');

  return {
    mesh,
    stats,
    validation,
    resolution: {
      radialSegments: resolution.radialSegments,
      verticalSegments: resolution.verticalSegments,
      spacingMm: resolution.spacingMm,
    },
    pinchFixes,
    unresolvedPinches,
  };
}
