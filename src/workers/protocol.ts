import type {
  MeshStats,
  PrintablePartId,
  ProjectSettings,
  ValidationReport,
} from '../types';
import type { PatternSourceKind } from '../pattern/types';
import type { GenerationStage } from '../geometry/generateCylinderRelief';

export type JobPurpose = 'preview' | 'export';

export interface PatternPayload {
  id: string;
  name: string;
  kind: PatternSourceKind;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  luminance: ArrayBuffer;
  alpha: ArrayBuffer | null;
}

export type WorkerRequest =
  | { type: 'SET_PATTERNS'; patterns: PatternPayload[] }
  | { type: 'CLEAR_PATTERNS' }
  | {
      type: 'GENERATE';
      jobId: number;
      purpose: JobPurpose;
      settings: ProjectSettings;
      /** null generates a blank cylinder, which is a legitimate output. */
      patternId: string | null;
      /** Optional independent artwork used only by the bottom logo insert. */
      bottomLogoPatternId: string | null;
      /** Export only: serialise the result and return a file. */
      filename?: string;
    };

export interface MeshPayload {
  positions: ArrayBuffer;
  indices: ArrayBuffer;
  normals: ArrayBuffer | null;
}

export type WorkerResponse =
  | { type: 'PROGRESS'; jobId: number; progress: number; stage: GenerationStage | 'writing' }
  | {
      type: 'MESH';
      jobId: number;
      purpose: JobPurpose;
      mesh: MeshPayload;
      stats: MeshStats;
      validation: ValidationReport;
      resolution: { radialSegments: number; verticalSegments: number; spacingMm: number };
      pinchFixes: number;
      partIds: PrintablePartId[];
      elapsedMs: number;
    }
  | { type: 'FILE'; jobId: number; blob: Blob; filename: string; elapsedMs: number }
  | { type: 'ERROR'; jobId: number; code: string; message: string };
