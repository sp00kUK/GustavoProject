import type { RawPattern } from './types';

const VECTOR_MAGIC_NATIVE_INPUTS = new Set(['image/png', 'image/jpeg']);

export interface VectorMagicSession {
  sessionId: string;
  executable: string;
  inputPath: string;
  expectedOutputPath: string;
}

export type VectorMagicAutomationState =
  | 'launching'
  | 'tracing'
  | 'reviewing'
  | 'exporting'
  | 'complete';

export interface VectorMagicPendingResult {
  ready: false;
  state: VectorMagicAutomationState;
  progress: number;
  expectedOutputPath: string;
}

export interface VectorMagicReadyResult {
  ready: true;
  state: 'complete';
  progress: 1;
  filename: string;
  outputPath: string;
  svg: string;
}

export type VectorMagicResult = VectorMagicPendingResult | VectorMagicReadyResult;

/**
 * Launch the real, locally available Vector Magic Desktop executable. Native
 * PNG/JPEG uploads are forwarded byte-for-byte. Formats unsupported by the
 * Desktop Edition and procedural patterns are losslessly converted
 * to PNG first; Vector Magic still performs all tracing/vectorization.
 */
export async function startVectorMagicDesktop(
  pattern: RawPattern,
  signal?: AbortSignal,
): Promise<VectorMagicSession> {
  const source = await vectorMagicInput(pattern);
  const response = await fetch('/api/vector-magic/start', {
    method: 'POST',
    headers: {
      'Content-Type': source.blob.type,
      'X-Vector-Magic-Filename': encodeURIComponent(source.filename),
    },
    body: source.blob,
    signal,
  });
  const payload = (await response.json()) as Partial<VectorMagicSession> & {
    error?: string;
  };
  if (!response.ok || !payload.sessionId) {
    throw new Error(payload.error ?? 'VECTOR_MAGIC_BRIDGE_FAILED');
  }
  return payload as VectorMagicSession;
}

export async function getVectorMagicResult(
  sessionId: string,
  signal?: AbortSignal,
): Promise<VectorMagicResult> {
  const response = await fetch(
    `/api/vector-magic/result?session=${encodeURIComponent(sessionId)}`,
    { signal, cache: 'no-store' },
  );
  const payload = (await response.json()) as VectorMagicResult & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'VECTOR_MAGIC_RESULT_FAILED');
  return payload;
}

export async function cancelVectorMagicSession(sessionId: string): Promise<void> {
  const response = await fetch(
    `/api/vector-magic/cancel?session=${encodeURIComponent(sessionId)}`,
    { method: 'POST', cache: 'no-store' },
  );
  if (response.ok || response.status === 404) return;
  const payload = (await response.json()) as { error?: string };
  throw new Error(payload.error ?? 'VECTOR_MAGIC_CANCEL_FAILED');
}

async function vectorMagicInput(
  pattern: RawPattern,
): Promise<{ blob: Blob; filename: string }> {
  if (
    pattern.sourceBytes &&
    pattern.sourceMimeType &&
    VECTOR_MAGIC_NATIVE_INPUTS.has(pattern.sourceMimeType)
  ) {
    const bytes = pattern.sourceBytes.slice().buffer as ArrayBuffer;
    return {
      blob: new Blob([bytes], { type: pattern.sourceMimeType }),
      filename: pattern.name,
    };
  }

  if (pattern.sourceBytes && pattern.sourceMimeType?.startsWith('image/')) {
    const bytes = pattern.sourceBytes.slice().buffer as ArrayBuffer;
    const bitmap = await createImageBitmap(new Blob([bytes], { type: pattern.sourceMimeType }));
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('CANVAS_UNAVAILABLE');
      context.drawImage(bitmap, 0, 0);
      return {
        blob: await canvasPng(canvas),
        filename: replaceExtension(pattern.name, '.png'),
      };
    } finally {
      bitmap.close?.();
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = pattern.width;
  canvas.height = pattern.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('CANVAS_UNAVAILABLE');
  const image = context.createImageData(pattern.width, pattern.height);
  for (let i = 0; i < pattern.width * pattern.height; i++) {
    const value = pattern.luminance[i];
    image.data[i * 4] = value;
    image.data[i * 4 + 1] = value;
    image.data[i * 4 + 2] = value;
    image.data[i * 4 + 3] = pattern.alpha?.[i] ?? 255;
  }
  context.putImageData(image, 0, 0);
  return {
    blob: await canvasPng(canvas),
    filename: replaceExtension(pattern.name, '.png'),
  };
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG_ENCODING_FAILED'));
    }, 'image/png');
  });
}

function replaceExtension(filename: string, extension: string): string {
  const stem = filename.replace(/\.[^.]+$/, '') || 'pattern';
  return `${stem}${extension}`;
}
