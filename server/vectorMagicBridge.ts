import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connect, Plugin } from 'vite';

const MAX_INPUT_BYTES = 50 * 1024 * 1024;
const MAX_SVG_BYTES = 50 * 1024 * 1024;
const SESSION_ROOT = join(tmpdir(), 'cylindrical-pattern-debosser', 'vector-magic');
const AUTOMATION_SCRIPT = fileURLToPath(
  new URL('../scripts/vectorMagicAutomation.ps1', import.meta.url),
);
export const REPOSITORY_VECTOR_MAGIC_EXECUTABLE = fileURLToPath(
  new URL('../vendor/vector-magic/vmde.exe', import.meta.url),
);

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/bmp': '.bmp',
  'image/gif': '.gif',
  'image/tiff': '.tif',
};

interface VectorMagicSession {
  directory: string;
  expectedOutputPath: string;
  inputPath: string;
  statusPath: string;
  cancelPath: string;
  automationProcess: ChildProcess;
  lastStatus: VectorMagicAutomationStatus;
}

export type VectorMagicAutomationState =
  | 'launching'
  | 'tracing'
  | 'reviewing'
  | 'exporting'
  | 'complete'
  | 'cancelled'
  | 'error';

export interface VectorMagicAutomationStatus {
  state: VectorMagicAutomationState;
  progress: number;
  error?: string;
  updatedAt?: string;
}

const AUTOMATION_STATES = new Set<VectorMagicAutomationState>([
  'launching',
  'tracing',
  'reviewing',
  'exporting',
  'complete',
  'cancelled',
  'error',
]);

/** Locate the real Vector Magic executable without substituting another tracer. */
export function findVectorMagicExecutable(): string | null {
  const configured = process.env.VECTOR_MAGIC_EXE;
  const candidates = [
    configured,
    REPOSITORY_VECTOR_MAGIC_EXECUTABLE,
    'C:\\Program Files (x86)\\Vector Magic\\vmde.exe',
    'C:\\Program Files\\Vector Magic\\vmde.exe',
  ];
  return (
    candidates.find((candidate): candidate is string =>
      Boolean(candidate && existsSync(candidate)),
    ) ?? null
  );
}

export function vectorMagicPlugin(): Plugin {
  const sessions = new Map<string, VectorMagicSession>();

  const install = (middlewares: Connect.Server) => {
    middlewares.use('/api/vector-magic/availability', (_req, res) => {
      if (!isLoopbackAddress(_req.socket.remoteAddress)) {
        sendJson(res, 403, { error: 'LOCAL_ACCESS_ONLY' });
        return;
      }
      const executable = findVectorMagicExecutable();
      sendJson(res, 200, {
        available: executable !== null,
        executable,
      });
    });

    middlewares.use('/api/vector-magic/start', (req, res) => {
      if (!isLoopbackAddress(req.socket.remoteAddress)) {
        sendJson(res, 403, { error: 'LOCAL_ACCESS_ONLY' });
        return;
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      void startSession(req, res, sessions);
    });

    middlewares.use('/api/vector-magic/result', (req, res) => {
      if (!isLoopbackAddress(req.socket.remoteAddress)) {
        sendJson(res, 403, { error: 'LOCAL_ACCESS_ONLY' });
        return;
      }
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      getSessionResult(req, res, sessions);
    });

    middlewares.use('/api/vector-magic/cancel', (req, res) => {
      if (!isLoopbackAddress(req.socket.remoteAddress)) {
        sendJson(res, 403, { error: 'LOCAL_ACCESS_ONLY' });
        return;
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      cancelSession(req, res, sessions);
    });
  };

  return {
    name: 'vector-magic-desktop-bridge',
    configureServer(server) {
      install(server.middlewares);
    },
    configurePreviewServer(server) {
      install(server.middlewares);
    },
  };
}

async function startSession(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, VectorMagicSession>,
): Promise<void> {
  try {
    const executable = findVectorMagicExecutable();
    if (!executable) {
      sendJson(res, 404, { error: 'VECTOR_MAGIC_NOT_INSTALLED' });
      return;
    }

    const activeSession = [...sessions.values()].find((session) => {
      const status = readAutomationStatus(session);
      return !isTerminalAutomationState(status.state);
    });
    if (activeSession) {
      sendJson(res, 409, { error: 'VECTOR_MAGIC_BUSY' });
      return;
    }

    const mimeType = String(req.headers['content-type'] ?? '').split(';', 1)[0].toLowerCase();
    const extension = MIME_EXTENSIONS[mimeType];
    if (!extension) {
      sendJson(res, 415, { error: 'UNSUPPORTED_VECTOR_MAGIC_INPUT' });
      return;
    }

    const sourceName = decodeSourceName(req.headers['x-vector-magic-filename']);
    const stem = safeVectorMagicStem(sourceName);
    const body = await readBody(req);
    if (!isSupportedVectorMagicBitmap(body, extension)) {
      sendJson(res, 400, { error: 'INVALID_BITMAP' });
      return;
    }

    const sessionId = randomUUID();
    const directory = join(SESSION_ROOT, sessionId);
    mkdirSync(directory, { recursive: true });

    const inputPath = join(directory, `${stem}${extension}`);
    const expectedOutputPath = join(directory, `${stem}.svg`);
    const statusPath = join(directory, 'automation-status.json');
    const cancelPath = join(directory, 'cancel');
    writeFileSync(inputPath, body, { flag: 'wx' });

    const initialStatus: VectorMagicAutomationStatus = {
      state: 'launching',
      progress: 0.01,
      updatedAt: new Date().toISOString(),
    };
    writeAutomationStatus(statusPath, initialStatus);
    const automationProcess = await launchVectorMagicAutomation({
      executable,
      inputPath,
      expectedOutputPath,
      statusPath,
      cancelPath,
      cwd: directory,
    });
    const session: VectorMagicSession = {
      directory,
      expectedOutputPath,
      inputPath,
      statusPath,
      cancelPath,
      automationProcess,
      lastStatus: initialStatus,
    };
    sessions.set(sessionId, session);
    monitorAutomationProcess(session);

    sendJson(res, 200, {
      success: true,
      sessionId,
      executable,
      inputPath,
      expectedOutputPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'INPUT_TOO_LARGE' ? 413 : 500;
    sendJson(res, status, { error: message });
  }
}

function getSessionResult(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, VectorMagicSession>,
): void {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const sessionId = url.searchParams.get('session');
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) {
      sendJson(res, 404, { error: 'UNKNOWN_SESSION' });
      return;
    }

    const automationStatus = readAutomationStatus(session);
    const outputPath = findExportedSvg(session);
    if (!outputPath) {
      if (automationStatus.state === 'error') {
        sendJson(res, 500, {
          error: automationStatus.error ?? 'VECTOR_MAGIC_AUTOMATION_FAILED',
        });
        return;
      }
      if (automationStatus.state === 'cancelled') {
        sendJson(res, 409, { error: 'VECTOR_MAGIC_CANCELLED' });
        return;
      }
      if (automationStatus.state === 'complete') {
        sendJson(res, 500, { error: 'VECTOR_MAGIC_OUTPUT_MISSING' });
        return;
      }
      sendJson(res, 200, {
        ready: false,
        state: automationStatus.state,
        progress: automationStatus.progress,
        expectedOutputPath: session.expectedOutputPath,
      });
      return;
    }

    const size = statSync(outputPath).size;
    if (size > MAX_SVG_BYTES) {
      sendJson(res, 422, { error: 'SVG_TOO_LARGE' });
      return;
    }
    if (size <= 0) {
      sendJson(res, 200, {
        ready: false,
        state: automationStatus.state,
        progress: automationStatus.progress,
        expectedOutputPath: session.expectedOutputPath,
      });
      return;
    }

    const svg = readFileSync(outputPath, 'utf8');
    // A save notification can arrive before the write is complete. Treat an
    // incomplete document as pending and let the browser poll again.
    if (!/<svg(?:\s|>)/i.test(svg) || !/<\/svg\s*>/i.test(svg)) {
      sendJson(res, 200, {
        ready: false,
        state: automationStatus.state,
        progress: automationStatus.progress,
        expectedOutputPath: session.expectedOutputPath,
      });
      return;
    }

    sendJson(res, 200, {
      ready: true,
      state: 'complete',
      progress: 1,
      filename: basename(outputPath),
      outputPath,
      svg,
    });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function cancelSession(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, VectorMagicSession>,
): void {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const sessionId = url.searchParams.get('session');
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) {
      sendJson(res, 404, { error: 'UNKNOWN_SESSION' });
      return;
    }

    writeFileSync(session.cancelPath, 'cancel', { flag: 'a' });
    sendJson(res, 200, { success: true });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function findExportedSvg(session: VectorMagicSession): string | null {
  if (existsSync(session.expectedOutputPath)) return session.expectedOutputPath;

  // Keep a directory-confined fallback for Desktop variants that normalise the
  // requested filename while saving. Automation still selects SVG explicitly.
  const candidates = readdirSync(session.directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.svg')
    .map((entry) => join(session.directory, entry.name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return candidates[0] ?? null;
}

interface AutomationLaunchOptions {
  executable: string;
  inputPath: string;
  expectedOutputPath: string;
  statusPath: string;
  cancelPath: string;
  cwd: string;
}

function launchVectorMagicAutomation(options: AutomationLaunchOptions): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    if (!existsSync(AUTOMATION_SCRIPT)) {
      reject(new Error('VECTOR_MAGIC_AUTOMATION_SCRIPT_MISSING'));
      return;
    }

    const windowsDirectory = process.env.WINDIR ?? 'C:\\Windows';
    const powershell = join(
      windowsDirectory,
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe',
    );
    const child = spawn(
      powershell,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        AUTOMATION_SCRIPT,
        '-Executable',
        options.executable,
        '-InputPath',
        options.inputPath,
        '-OutputPath',
        options.expectedOutputPath,
        '-StatusPath',
        options.statusPath,
        '-CancelPath',
        options.cancelPath,
      ],
      {
      cwd: options.cwd,
      stdio: 'ignore',
      windowsHide: true,
      },
    );
    child.once('error', reject);
    child.once('spawn', () => {
      resolve(child);
    });
  });
}

function monitorAutomationProcess(session: VectorMagicSession): void {
  session.automationProcess.once('error', (error) => {
    writeAutomationStatus(session.statusPath, {
      state: 'error',
      progress: 0,
      error: error.message || 'VECTOR_MAGIC_AUTOMATION_FAILED',
      updatedAt: new Date().toISOString(),
    });
  });
  session.automationProcess.once('exit', (code) => {
    setTimeout(() => {
      const status = readAutomationStatus(session);
      if (isTerminalAutomationState(status.state)) return;
      writeAutomationStatus(session.statusPath, {
        state: 'error',
        progress: 0,
        error: `VECTOR_MAGIC_AUTOMATION_EXIT_${code ?? 'UNKNOWN'}`,
        updatedAt: new Date().toISOString(),
      });
    }, 100);
  });
}

function readAutomationStatus(session: VectorMagicSession): VectorMagicAutomationStatus {
  try {
    const parsed = parseVectorMagicAutomationStatus(readFileSync(session.statusPath, 'utf8'));
    if (parsed) session.lastStatus = parsed;
  } catch {
    // The PowerShell helper replaces this tiny file while the browser polls.
    // A transient read failure simply uses the last complete status document.
  }
  return session.lastStatus;
}

export function parseVectorMagicAutomationStatus(
  source: string,
): VectorMagicAutomationStatus | null {
  try {
    const value = JSON.parse(source) as Partial<VectorMagicAutomationStatus>;
    if (!value.state || !AUTOMATION_STATES.has(value.state)) return null;
    if (typeof value.progress !== 'number' || !Number.isFinite(value.progress)) return null;
    return {
      state: value.state,
      progress: Math.max(0, Math.min(1, value.progress)),
      ...(typeof value.error === 'string' ? { error: value.error } : {}),
      ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {}),
    };
  } catch {
    return null;
  }
}

function isTerminalAutomationState(state: VectorMagicAutomationState): boolean {
  return state === 'complete' || state === 'cancelled' || state === 'error';
}

function writeAutomationStatus(path: string, status: VectorMagicAutomationStatus): void {
  writeFileSync(path, JSON.stringify(status), 'utf8');
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let tooLarge = false;

    req.on('data', (chunk: Buffer | Uint8Array) => {
      total += chunk.length;
      if (total > MAX_INPUT_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => {
      if (tooLarge) reject(new Error('INPUT_TOO_LARGE'));
      else resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

function decodeSourceName(value: string | string[] | undefined): string {
  const encoded = Array.isArray(value) ? value[0] : value;
  if (!encoded) return 'pattern';
  try {
    return decodeURIComponent(encoded);
  } catch {
    return 'pattern';
  }
}

export function safeVectorMagicStem(filename: string): string {
  const parsed = parse(basename(filename));
  const cleaned = parsed.name.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '');
  const stem = cleaned.slice(0, 80);
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem) ? 'pattern' : stem || 'pattern';
}

export function isSupportedVectorMagicBitmap(data: Buffer, extension: string): boolean {
  if (data.length < 4) return false;
  if (extension === '.png') {
    return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (extension === '.jpg') return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (extension === '.bmp') return data[0] === 0x42 && data[1] === 0x4d;
  if (extension === '.gif') return data.subarray(0, 3).toString('ascii') === 'GIF';
  if (extension === '.tif') {
    const header = data.subarray(0, 4).toString('hex');
    return header === '49492a00' || header === '4d4d002a';
  }
  return false;
}

export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  return (
    address === '::1' ||
    address === '127.0.0.1' ||
    address.startsWith('127.') ||
    address.startsWith('::ffff:127.')
  );
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
