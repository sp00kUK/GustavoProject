import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite';
import * as vtracer from '@visioncortex/vtracer';
import type { Options } from '@visioncortex/vtracer';

export type VTracerProfile = 'logo' | 'drawing' | 'photo';

const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** Parameter sets tuned for clean fabrication artwork rather than web decoration. */
export function optionsForProfile(profile: VTracerProfile, threshold = 128): Options {
  if (profile === 'drawing') {
    return {
      clustering: 'bw',
      mode: 'spline',
      adaptive: true,
      adaptiveT: 13,
      filterSpeckle: 2,
      simplify: 0.65,
      optimize: 2,
      pathPrecision: 3,
    };
  }
  if (profile === 'photo') {
    return {
      preset: 'poster',
      clustering: 'color-cluster',
      hierarchical: 'cutout',
      mode: 'spline',
      maxColors: 12,
      filterSpeckle: 3,
      simplify: 1.1,
      optimize: 2,
      pathPrecision: 3,
    };
  }
  return {
    clustering: 'bw',
    mode: 'spline',
    binaryThreshold: Math.max(0, Math.min(255, Math.round(threshold))),
    filterSpeckle: 4,
    simplify: 0.8,
    optimize: 2,
    pathPrecision: 3,
  };
}

export function vtracerPlugin(): Plugin {
  const attach = (middlewares: Connect.Server) => {
    middlewares.use('/api/vectorizer/trace', (req, res) => {
      void handleTrace(req, res);
    });
  };
  return {
    name: 'open-source-vtracer-bridge',
    configureServer(server: ViteDevServer) {
      attach(server.middlewares);
    },
    configurePreviewServer(server: PreviewServer) {
      attach(server.middlewares);
    },
  };
}

async function handleTrace(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  try {
    const bytes = await readBody(req, MAX_INPUT_BYTES);
    if (bytes.length === 0) throw new Error('EMPTY_VECTOR_INPUT');
    const profile = parseProfile(req.headers['x-vtracer-profile']);
    const threshold = Number(req.headers['x-vtracer-threshold'] ?? 128);
    const svg = vtracer.convertBuffer(bytes, optionsForProfile(profile, threshold));
    if (!/<svg\b/i.test(svg) || !/<path\b/i.test(svg)) {
      throw new Error('VTRACER_OUTPUT_INVALID');
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(svg);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'VECTOR_INPUT_TOO_LARGE' ? 413 : 422;
    sendJson(res, status, { error: message || 'VTRACER_FAILED' });
  }
}

function parseProfile(value: string | string[] | undefined): VTracerProfile {
  const profile = Array.isArray(value) ? value[0] : value;
  return profile === 'drawing' || profile === 'photo' ? profile : 'logo';
}

function readBody(req: IncomingMessage, limit: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    req.on('data', (chunk: Buffer) => {
      length += chunk.length;
      if (length > limit) {
        reject(new Error('VECTOR_INPUT_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}
