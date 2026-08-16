/// <reference lib="webworker" />
import { generateCylinderRelief } from '../geometry/generateCylinderRelief';
import { computeCreasedNormals, computeSmoothNormals } from '../geometry/normals/creasedNormals';
import { orientMesh } from '../geometry/mesh/meshOps';
import { resolveResolution, spacingForPreset } from '../geometry/quality';
import { validateSettings } from '../geometry/constraints';
import { summarise } from '../geometry/constraints';
import { patternSignature, processPattern } from '../pattern/process';
import { createPatternSampler, tileSizeMm } from '../pattern/sampler';
import { constantSampler } from '../pattern/procedural';
import { STLExporter } from '../exporters/stl';
import { ThreeMFExporter } from '../exporters/threemf';
import type { ProcessedPattern, RawPattern } from '../pattern/types';
import type { PatternSampler, ProjectSettings } from '../types';
import type { WorkerRequest, WorkerResponse } from './protocol';

/**
 * All expensive work happens here: image processing, mesh generation, manifold
 * validation and file serialisation. The UI thread never blocks on any of it.
 *
 * Cancellation is by termination, driven from the client. A synchronous mesh
 * build cannot poll a message queue, and SharedArrayBuffer needs cross-origin
 * isolation headers that a static host may not provide - so the client kills
 * the worker outright and re-seeds a fresh one from its own cached pattern.
 * That is unconditionally reliable, which matters more here than elegance.
 */

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** Kept so repeated jobs never re-upload or re-decode the artwork. */
let currentPattern: RawPattern | null = null;
/** Cache keyed by the processing signature: changing depth alone reuses this. */
let processedCache: ProcessedPattern | null = null;

/** Above this, splitting vertices for creased normals costs more than it gains. */
const MAX_CREASED_TRIANGLES = 1_500_000;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  switch (message.type) {
    case 'SET_PATTERN': {
      const p = message.pattern;
      currentPattern = {
        id: p.id,
        name: p.name,
        kind: 'raster',
        width: p.width,
        height: p.height,
        luminance: new Uint8Array(p.luminance),
        alpha: p.alpha ? new Uint8Array(p.alpha) : null,
        originalWidth: p.originalWidth,
        originalHeight: p.originalHeight,
      };
      processedCache = null;
      break;
    }
    case 'CLEAR_PATTERN':
      currentPattern = null;
      processedCache = null;
      break;
    case 'GENERATE':
      void runJob(message);
      break;
  }
};

async function runJob(
  message: Extract<WorkerRequest, { type: 'GENERATE' }>,
): Promise<void> {
  const { jobId, purpose, settings, patternId, filename } = message;
  const started = performance.now();

  const post = (response: WorkerResponse, transfer?: Transferable[]) =>
    ctx.postMessage(response, transfer ?? []);

  try {
    const check = validateSettings(settings.cylinder, settings.relief);
    if (!check.canGenerate) {
      const blocker = check.issues.find((i) => i.severity === 'error')!;
      post({ type: 'ERROR', jobId, code: blocker.code, message: blocker.message });
      return;
    }

    post({ type: 'PROGRESS', jobId, progress: 0.02, stage: 'pattern' });

    const sampler = buildSampler(settings, patternId);

    const preset =
      purpose === 'export' ? settings.quality.export : settings.quality.preview;
    const resolution = resolveResolution(
      settings.cylinder.diameter,
      settings.cylinder.height,
      spacingForPreset(preset, settings.quality.customSpacing),
    );

    const result = generateCylinderRelief({
      cylinder: settings.cylinder,
      relief: settings.relief,
      mode: settings.pattern.mode,
      patternSampler: sampler,
      resolution,
      validate: true,
      onProgress: (progress, stage) =>
        post({
          type: 'PROGRESS',
          jobId,
          progress: progress * (purpose === 'export' ? 0.75 : 1),
          stage,
        }),
    });

    if (purpose === 'export') {
      const oriented = orientMesh(result.mesh, settings.export.orientation);
      post({ type: 'PROGRESS', jobId, progress: 0.8, stage: 'writing' });

      const exporter =
        settings.export.format === '3mf' ? new ThreeMFExporter() : new STLExporter();
      const blob = await exporter.export(oriented, {
        settings,
        onProgress: (f) =>
          post({ type: 'PROGRESS', jobId, progress: 0.8 + f * 0.2, stage: 'writing' }),
      });

      post({
        type: 'FILE',
        jobId,
        blob,
        filename: filename ?? `roller.${exporter.extension}`,
        elapsedMs: performance.now() - started,
      });
      return;
    }

    // Preview: attach display normals. Binary relief needs creases preserved
    // or every engraved step reads as a soft bump; continuous relief wants the
    // opposite, so it gets plain smooth normals.
    const wantsCreases =
      settings.pattern.mode === 'binary' && settings.relief.edgeTreatment === 'sharp';

    let positions = result.mesh.positions;
    let indices = result.mesh.indices;
    let normals: Float32Array;

    if (wantsCreases && result.stats.triangleCount <= MAX_CREASED_TRIANGLES) {
      const shaded = computeCreasedNormals(result.mesh);
      positions = shaded.positions;
      indices = shaded.indices;
      normals = shaded.normals!;
    } else {
      normals = computeSmoothNormals(result.mesh);
    }

    post(
      {
        type: 'MESH',
        jobId,
        purpose,
        mesh: {
          positions: positions.buffer as ArrayBuffer,
          indices: indices.buffer as ArrayBuffer,
          normals: normals.buffer as ArrayBuffer,
        },
        stats: result.stats,
        validation: result.validation,
        resolution: result.resolution,
        pinchFixes: result.pinchFixes ?? 0,
        elapsedMs: performance.now() - started,
      },
      [positions.buffer as ArrayBuffer, indices.buffer as ArrayBuffer, normals.buffer as ArrayBuffer],
    );
  } catch (error) {
    const err = error as Error;
    post({
      type: 'ERROR',
      jobId,
      code: err.name === 'CancelledError' ? 'CANCELLED' : 'GENERATION_FAILED',
      message: err.message || String(error),
    });
  }
}

function buildSampler(settings: ProjectSettings, patternId: string | null): PatternSampler {
  if (!currentPattern || patternId !== currentPattern.id) {
    // A blank roller is a valid model, not an error state.
    return constantSampler(0);
  }

  const softenPx =
    settings.pattern.mode === 'binary' && settings.relief.edgeTreatment === 'soft'
      ? softnessInPixels(settings, currentPattern.width)
      : 0;

  const processed = getProcessed(settings, softenPx);

  const { circumference, usableHeight } = summarise(settings.cylinder, settings.relief);
  const tile = tileSizeMm(
    circumference,
    usableHeight,
    settings.pattern.columns,
    settings.pattern.rows,
  );

  return createPatternSampler(processed, settings.pattern, {
    tileWidthMm: tile.width,
    tileHeightMm: tile.height,
  });
}

function getProcessed(settings: ProjectSettings, softenPx: number): ProcessedPattern {
  const pattern = currentPattern!;
  // Compare signatures *before* doing the work, so adjusting depth or mesh
  // detail costs nothing on the image side.
  const wanted = patternSignature(pattern, settings.pattern, softenPx);
  if (processedCache && processedCache.signature === wanted) return processedCache;
  processedCache = processPattern(pattern, settings.pattern, { softenPx });
  return processedCache;
}

/** Convert an edge softness in millimetres into source pixels. */
function softnessInPixels(settings: ProjectSettings, patternWidth: number): number {
  const { circumference, usableHeight } = summarise(settings.cylinder, settings.relief);
  const tile = tileSizeMm(
    circumference,
    usableHeight,
    settings.pattern.columns,
    settings.pattern.rows,
  );
  const mmPerPixel = tile.width / Math.max(1, patternWidth);
  return Math.max(0, settings.relief.edgeSoftness / Math.max(1e-6, mmPerPixel));
}
