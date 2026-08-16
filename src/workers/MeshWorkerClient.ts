import type { RawPattern } from '../pattern/types';
import type { ProjectSettings } from '../types';
import type {
  JobPurpose,
  MeshPayload,
  WorkerRequest,
  WorkerResponse,
} from './protocol';
import type { GenerationStage } from '../geometry/generateCylinderRelief';

export interface JobProgress {
  progress: number;
  stage: GenerationStage | 'writing';
}

export type MeshResult = Extract<WorkerResponse, { type: 'MESH' }>;
export type FileResult = Extract<WorkerResponse, { type: 'FILE' }>;

export interface GenerateOptions {
  purpose: JobPurpose;
  settings: ProjectSettings;
  patternId: string | null;
  filename?: string;
  onProgress?: (progress: JobProgress) => void;
}

export class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

/**
 * Owns the worker and enforces two things the UI must never get wrong.
 *
 * Job versioning (spec 65): every request carries an incrementing id and any
 * reply whose id is not the newest is dropped. A slow Ultra preview that
 * finishes after the user has already changed the diameter can therefore never
 * overwrite the newer geometry - the classic async race in a tool like this.
 *
 * Cancellation: the worker is terminated and a fresh one is created, then the
 * cached pattern is re-seeded into it. Mesh generation is a tight synchronous
 * loop and cannot service a message mid-build, so a cooperative flag would not
 * actually stop anything. Termination always does.
 */
export class MeshWorkerClient {
  private worker: Worker | null = null;
  private nextJobId = 1;
  private activeJobId = 0;
  private pattern: RawPattern | null = null;

  private handlers = new Map<
    number,
    {
      resolve: (value: MeshResult | FileResult) => void;
      reject: (error: Error) => void;
      onProgress?: (progress: JobProgress) => void;
    }
  >();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./mesh.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) =>
      this.handleMessage(event.data);
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Worker failed');
      for (const [, handler] of this.handlers) handler.reject(error);
      this.handlers.clear();
    };
    this.worker = worker;
    if (this.pattern) this.uploadPattern(worker, this.pattern);
    return worker;
  }

  private handleMessage(response: WorkerResponse): void {
    // Stale replies are discarded, not applied.
    if (response.jobId !== this.activeJobId) return;
    const handler = this.handlers.get(response.jobId);
    if (!handler) return;

    switch (response.type) {
      case 'PROGRESS':
        handler.onProgress?.({ progress: response.progress, stage: response.stage });
        break;
      case 'MESH':
      case 'FILE':
        this.handlers.delete(response.jobId);
        handler.resolve(response);
        break;
      case 'ERROR': {
        this.handlers.delete(response.jobId);
        const error =
          response.code === 'CANCELLED' ? new CancelledError() : new Error(response.message);
        (error as Error & { code?: string }).code = response.code;
        handler.reject(error);
        break;
      }
    }
  }

  setPattern(pattern: RawPattern | null): void {
    this.pattern = pattern;
    const worker = this.worker;
    if (!worker) return;
    if (!pattern) {
      worker.postMessage({ type: 'CLEAR_PATTERN' } satisfies WorkerRequest);
      return;
    }
    this.uploadPattern(worker, pattern);
  }

  private uploadPattern(worker: Worker, pattern: RawPattern): void {
    // Copy rather than transfer: the main thread keeps the same buffers for the
    // 2D pattern preview, and a re-seed after cancellation needs them again.
    const luminance = pattern.luminance.slice().buffer;
    const alpha = pattern.alpha ? pattern.alpha.slice().buffer : null;
    const message: WorkerRequest = {
      type: 'SET_PATTERN',
      pattern: {
        id: pattern.id,
        name: pattern.name,
        width: pattern.width,
        height: pattern.height,
        originalWidth: pattern.originalWidth,
        originalHeight: pattern.originalHeight,
        luminance,
        alpha,
      },
    };
    worker.postMessage(message, alpha ? [luminance, alpha] : [luminance]);
  }

  generate(options: GenerateOptions): Promise<MeshResult | FileResult> {
    const worker = this.ensureWorker();
    const jobId = this.nextJobId++;
    this.activeJobId = jobId;

    return new Promise((resolve, reject) => {
      this.handlers.set(jobId, { resolve, reject, onProgress: options.onProgress });
      const message: WorkerRequest = {
        type: 'GENERATE',
        jobId,
        purpose: options.purpose,
        settings: options.settings,
        patternId: options.patternId,
        filename: options.filename,
      };
      worker.postMessage(message);
    });
  }

  /** Stop whatever is running. Safe to call when nothing is. */
  cancel(): void {
    if (this.handlers.size === 0 && !this.worker) return;
    for (const [, handler] of this.handlers) handler.reject(new CancelledError());
    this.handlers.clear();
    this.activeJobId = 0;
    this.worker?.terminate();
    this.worker = null;
  }

  dispose(): void {
    this.cancel();
    this.pattern = null;
  }
}

/** Rebuild typed array views over the buffers the worker transferred back. */
export function decodeMesh(payload: MeshPayload): {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array | null;
} {
  return {
    positions: new Float32Array(payload.positions),
    indices: new Uint32Array(payload.indices),
    normals: payload.normals ? new Float32Array(payload.normals) : null,
  };
}
