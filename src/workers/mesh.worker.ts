/// <reference lib="webworker" />
import { computeCreasedNormals, computeSmoothNormals } from '../geometry/normals/creasedNormals';
import { orientMesh, orientPartsTogether } from '../geometry/mesh/meshOps';
import { resolveResolution, spacingForPreset } from '../geometry/quality';
import { validateSettings } from '../geometry/constraints';
import { summarise } from '../geometry/constraints';
import { patternSignature, processPattern } from '../pattern/process';
import { createRowPatternSampler, tileSizeMm } from '../pattern/sampler';
import { constantSampler } from '../pattern/procedural';
import { STLExporter } from '../exporters/stl';
import { ThreeMFExporter } from '../exporters/threemf';
import { createZip, type Bytes } from '../exporters/zip';
import { generateMoldAssembly } from '../geometry/assembly/generateMoldAssembly';
import type { ProcessedPattern, RawPattern } from '../pattern/types';
import type { PatternSampler, PrintablePart, ProjectSettings, PrintableMesh } from '../types';
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
let currentPatterns = new Map<string, RawPattern>();
/** Cache keyed by the processing signature: changing depth alone reuses this. */
let processedCache = new Map<string, ProcessedPattern>();

/** Above this, splitting vertices for creased normals costs more than it gains. */
const MAX_CREASED_TRIANGLES = 1_500_000;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  switch (message.type) {
    case 'SET_PATTERNS': {
      currentPatterns = new Map(
        message.patterns.map((p) => [
          p.id,
          {
            id: p.id,
            name: p.name,
            kind: p.kind,
            width: p.width,
            height: p.height,
            luminance: new Uint8Array(p.luminance),
            alpha: p.alpha ? new Uint8Array(p.alpha) : null,
            originalWidth: p.originalWidth,
            originalHeight: p.originalHeight,
          },
        ]),
      );
      processedCache.clear();
      break;
    }
    case 'CLEAR_PATTERNS':
      currentPatterns.clear();
      processedCache.clear();
      break;
    case 'GENERATE':
      void runJob(message);
      break;
  }
};

async function runJob(
  message: Extract<WorkerRequest, { type: 'GENERATE' }>,
): Promise<void> {
  const { jobId, purpose, settings, patternId, bottomLogoPatternId, filename } = message;
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

    const patternBundle = buildSampler(settings, patternId);
    const bottomLogoPattern = buildBottomLogoPattern(settings, bottomLogoPatternId);

    const preset =
      purpose === 'export' ? settings.quality.export : settings.quality.preview;
    const resolution = resolveResolution(
      settings.cylinder.diameter,
      settings.cylinder.height,
      spacingForPreset(preset, settings.quality.customSpacing),
    );

    let baseMesh: PrintableMesh | null = null;
    if (settings.baseMesh.type === 'imported' && settings.baseMesh.meshId) {
      post({ type: 'PROGRESS', jobId, progress: 0.1, stage: 'pattern' });
      // dynamically import to avoid breaking worker init if indexedDB fails early
      const { loadImportedMesh } = await import('../state/persistence');
      baseMesh = await loadImportedMesh(settings.baseMesh.meshId);

      if (baseMesh && settings.operations && settings.operations.length > 0) {
        const samplers: Record<string, PatternSampler> = {};
        for (const op of settings.operations) {
          if (op.patternId && !samplers[op.patternId]) {
            samplers[op.patternId] = buildSampler(settings, op.patternId).sampler;
          }
        }

        const masks: Record<string, Uint8Array> = {};
        const { loadMask } = await import('../state/persistence');
        for (const op of settings.operations) {
          if (op.maskId && !masks[op.maskId]) {
            const mask = await loadMask(op.maskId);
            if (mask) masks[op.maskId] = mask;
          }
        }

        const { applyTexturizerPipeline } = await import('../geometry/texturizer/pipeline');
        baseMesh = await applyTexturizerPipeline({
          baseMesh,
          operations: settings.operations,
          samplers,
          masks,
          targetTriangleCount: purpose === 'export' ? undefined : 1500000,
          onProgress: (p, stage) => post({ type: 'PROGRESS', jobId, progress: 0.1 + p * 0.5, stage: stage as any })
        });
      }
    }

    const operationSamplers: Record<string, PatternSampler> = {};
    if (settings.operations && settings.operations.length > 0) {
      for (const op of settings.operations) {
        const bundle = buildOperationSampler(settings, op);
        operationSamplers[op.id] = bundle.sampler;
        if (op.patternId && !operationSamplers[op.patternId]) {
          operationSamplers[op.patternId] = bundle.sampler;
        }
      }
    }

    const result = generateMoldAssembly({
      settings,
      patternSampler: patternBundle.sampler,
      operationSamplers,
      handlePattern: patternBundle.primary,
      bottomLogoPattern,
      importedMesh: baseMesh,
      resolution,
      validate: true,
      onProgress: (progress, stage) =>
        post({
          type: 'PROGRESS',
          jobId,
          progress: 0.6 + progress * (purpose === 'export' ? 0.2 : 0.4),
          stage,
        }),
    });

    if (purpose === 'export') {
      post({ type: 'PROGRESS', jobId, progress: 0.8, stage: 'writing' });

      const selected = selectExportParts(result.parts, settings);
      const exported = await exportParts(selected, settings, filename, (f) =>
        post({ type: 'PROGRESS', jobId, progress: 0.8 + f * 0.2, stage: 'writing' }),
      );

      post({
        type: 'FILE',
        jobId,
        blob: exported.blob,
        filename: exported.filename ?? filename ?? `model.${settings.export.format}`,
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
        partIds: result.parts.map((part) => part.id),
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

interface PatternBundle {
  sampler: PatternSampler;
  primary: ProcessedPattern | null;
}

function buildSampler(settings: ProjectSettings, patternId: string | null): PatternBundle {
  const primaryRaw = patternId ? currentPatterns.get(patternId) : null;
  if (!primaryRaw) {
    // A blank roller is a valid model, not an error state.
    return { sampler: constantSampler(0), primary: null };
  }

  const softenPx =
    settings.pattern.mode === 'binary' && settings.relief.edgeTreatment === 'soft'
      ? softnessInPixels(settings, primaryRaw.width)
      : 0;

  const wantedIds = new Set<string>([primaryRaw.id]);
  for (const id of settings.pattern.rowPatternIds) if (id) wantedIds.add(id);
  const processed = new Map<string, ProcessedPattern>();
  for (const id of wantedIds) {
    const raw = currentPatterns.get(id);
    if (raw) processed.set(id, getProcessed(raw, settings.pattern, softenPx));
  }

  const { circumference, usableHeight } = summarise(settings.cylinder, settings.relief);
  const tile = tileSizeMm(
    circumference,
    usableHeight,
    settings.pattern.columns,
    settings.pattern.rows,
  );

  return {
    sampler: createRowPatternSampler(processed, primaryRaw.id, settings.pattern, {
      tileWidthMm: tile.width,
      tileHeightMm: tile.height,
    }),
    primary: processed.get(primaryRaw.id) ?? null,
  };
}

function buildOperationSampler(
  settings: ProjectSettings,
  op: import('../types').OperationSettings,
): PatternBundle {
  const patternId = op.patternId || 'primary';
  const primaryRaw = currentPatterns.get(patternId) || (currentPatterns.size > 0 ? Array.from(currentPatterns.values())[0] : null);
  if (!primaryRaw) {
    return { sampler: constantSampler(0), primary: null };
  }

  const rowPatternIds = op.rowPatternIds ?? settings.pattern.rowPatternIds ?? [];
  const opPatternSettings: ProjectSettings['pattern'] = {
    ...settings.pattern,
    invert: op.invert !== undefined ? op.invert : settings.pattern.invert,
    columns: op.columns ?? settings.pattern.columns,
    rows: op.rows ?? settings.pattern.rows,
    scaleX: op.scaleX ?? settings.pattern.scaleX,
    scaleY: op.scaleY ?? settings.pattern.scaleY,
    offsetX: op.offsetX ?? settings.pattern.offsetX,
    offsetY: op.offsetY ?? settings.pattern.offsetY,
    rotation: op.rotation ?? settings.pattern.rotation,
    mirrorX: op.mirrorX ?? false,
    mirrorY: op.mirrorY ?? false,
    blur: op.smoothing ?? settings.pattern.blur ?? 0,
    rowPatternIds,
    rowAdjustments: op.rowAdjustments ?? settings.pattern.rowAdjustments,
  };

  const globalSmoothing = op.smoothing ?? settings.pattern.blur ?? 0;
  const processed = new Map<string, ProcessedPattern>();

  // Process primary
  const primaryProc = getProcessed(primaryRaw, opPatternSettings, globalSmoothing);
  processed.set(primaryRaw.id, primaryProc);

  // Process named patterns
  for (const [id, raw] of currentPatterns) {
    if (!processed.has(id)) {
      processed.set(id, getProcessed(raw, opPatternSettings, globalSmoothing));
    }
  }

  // Process per-row overrides
  const rowAdjustments = opPatternSettings.rowAdjustments || {};
  for (let r = 0; r < opPatternSettings.rows; r++) {
    const patternId = rowPatternIds[r];
    const raw = patternId ? (currentPatterns.get(patternId) || primaryRaw) : primaryRaw;
    const rowAdj = rowAdjustments[r];

    if (rowAdj) {
      const rowSmoothing = rowAdj.blur !== undefined ? rowAdj.blur : globalSmoothing;
      const rowPatternSettings: ProjectSettings['pattern'] = {
        ...opPatternSettings,
        brightness: rowAdj.brightness ?? opPatternSettings.brightness,
        contrast: rowAdj.contrast ?? opPatternSettings.contrast,
        gamma: rowAdj.gamma ?? opPatternSettings.gamma,
        blackPoint: rowAdj.blackPoint ?? opPatternSettings.blackPoint,
        whitePoint: rowAdj.whitePoint ?? opPatternSettings.whitePoint,
        blur: rowSmoothing,
        quantize: rowAdj.quantize ?? opPatternSettings.quantize,
        invert: rowAdj.invert !== undefined ? rowAdj.invert : opPatternSettings.invert,
      };
      const rowProc = getProcessedExplicit(raw, rowPatternSettings, rowSmoothing);
      processed.set(`row_${r}`, rowProc);
    }
  }

  const { circumference, usableHeight } = summarise(settings.cylinder, settings.relief);
  const tile = tileSizeMm(
    circumference,
    usableHeight,
    opPatternSettings.columns,
    opPatternSettings.rows,
  );

  return {
    sampler: createRowPatternSampler(processed, primaryRaw.id, opPatternSettings, {
      tileWidthMm: tile.width,
      tileHeightMm: tile.height,
    }),
    primary: primaryProc,
  };
}

function getProcessedExplicit(
  pattern: RawPattern,
  effectiveSettings: ProjectSettings['pattern'],
  softenPx: number,
): ProcessedPattern {
  const wanted = patternSignature(pattern, effectiveSettings, softenPx);
  const cached = processedCache.get(wanted);
  if (cached) return cached;
  const result = processPattern(pattern, effectiveSettings, { softenPx });
  processedCache.set(wanted, result);
  return result;
}

function getProcessed(
  pattern: RawPattern,
  patternSettings: ProjectSettings['pattern'],
  softenPx: number,
): ProcessedPattern {
  const customAdj = patternSettings.patternAdjustments?.[pattern.id];
  const effectiveSettings: ProjectSettings['pattern'] = customAdj
    ? {
        ...patternSettings,
        brightness: customAdj.brightness ?? 0,
        contrast: customAdj.contrast ?? 0,
        gamma: customAdj.gamma ?? 1,
        blackPoint: customAdj.blackPoint ?? 0,
        whitePoint: customAdj.whitePoint ?? 1,
        blur: customAdj.blur ?? patternSettings.blur ?? 0,
        quantize: customAdj.quantize ?? 0,
        invert: customAdj.invert ?? patternSettings.invert,
      }
    : (pattern.id === 'primary' || pattern.id === (currentPatterns.size > 0 ? Array.from(currentPatterns.keys())[0] : 'primary')
        ? patternSettings
        : {
            ...patternSettings,
            brightness: 0,
            contrast: 0,
            gamma: 1,
            blackPoint: 0,
            whitePoint: 1,
            blur: patternSettings.blur ?? 0,
            quantize: 0,
          });

  return getProcessedExplicit(pattern, effectiveSettings, softenPx || effectiveSettings.blur || 0);
}

function buildBottomLogoPattern(
  settings: ProjectSettings,
  patternId: string | null,
): ProcessedPattern | null {
  if (!patternId || !settings.bottomLogo.enabled) return null;
  const raw = currentPatterns.get(patternId);
  if (!raw) return null;
  return getProcessed(
    raw,
    {
      ...settings.pattern,
      columns: 1,
      rows: 1,
      rowPatternIds: [],
      invert: settings.bottomLogo.invert,
    },
    0,
  );
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

function selectExportParts(parts: PrintablePart[], settings: ProjectSettings): PrintablePart[] {
  if (settings.export.scope === 'assembly') return parts;
  const selected = parts.find((part) => part.id === settings.export.scope);
  if (!selected) {
    throw new Error(`The selected export part (${settings.export.scope}) is not enabled.`);
  }
  return [selected];
}

async function exportParts(
  parts: PrintablePart[],
  settings: ProjectSettings,
  requestedFilename: string | undefined,
  onProgress: (fraction: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const base = (requestedFilename ?? 'model.stl').replace(/\.(?:stl|3mf|zip)$/i, '');

  if (settings.export.format === '3mf') {
    const oriented = orientPartsTogether(parts, settings.export.orientation);
    const blob = await new ThreeMFExporter().exportParts(oriented, { settings, onProgress });
    return { blob, filename: `${base}.3mf` };
  }

  if (parts.length === 1) {
    const part = parts[0];
    const oriented = orientMesh(part.mesh, settings.export.orientation);
    const blob = await new STLExporter().export(oriented, { settings, onProgress });
    const suffix = settings.export.scope === 'assembly' ? '' : `_${part.id}`;
    return { blob, filename: `${base}${suffix}.stl` };
  }

  const entries: Array<{ name: string; chunks: Bytes[]; compress: false }> = [];
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const oriented = orientMesh(part.mesh, settings.export.orientation);
    const blob = await new STLExporter().export(oriented, {
      settings,
      onProgress: (fraction) => onProgress((index + fraction) / parts.length),
    });
    entries.push({
      name: `${safePartName(part.name)}.stl`,
      chunks: [new Uint8Array(await blob.arrayBuffer())],
      compress: false,
    });
  }
  return { blob: await createZip(entries), filename: `${base}_parts.zip` };
}

function safePartName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'part'
  );
}
