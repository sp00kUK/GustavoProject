import type { RawPattern } from './types';

export type VectorizerProfile = 'logo' | 'drawing' | 'photo';

/** Trace locally through the official open-source VTracer WASM package. */
export async function vectorizeWithVTracer(
  pattern: RawPattern,
  profile: VectorizerProfile,
  threshold: number,
  signal?: AbortSignal,
): Promise<{ svg: string; filename: string }> {
  const source = await vectorizerInput(pattern);
  const response = await fetch('/api/vectorizer/trace', {
    method: 'POST',
    headers: {
      'Content-Type': source.blob.type || 'application/octet-stream',
      'X-VTracer-Profile': profile,
      'X-VTracer-Threshold': String(Math.round(threshold)),
    },
    body: source.blob,
    signal,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `VTRACER_HTTP_${response.status}`);
  }
  const svg = await response.text();
  if (!/<svg\b/i.test(svg)) throw new Error('VTRACER_OUTPUT_INVALID');
  return { svg, filename: replaceExtension(pattern.name, '.svg') };
}

async function vectorizerInput(pattern: RawPattern): Promise<{ blob: Blob; filename: string }> {
  if (pattern.sourceBytes && pattern.sourceMimeType?.startsWith('image/')) {
    return {
      blob: new Blob([pattern.sourceBytes.slice().buffer as ArrayBuffer], {
        type: pattern.sourceMimeType,
      }),
      filename: pattern.name,
    };
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
