import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  findVectorMagicExecutable,
  isLoopbackAddress,
  isSupportedVectorMagicBitmap,
  parseVectorMagicAutomationStatus,
  REPOSITORY_VECTOR_MAGIC_EXECUTABLE,
  safeVectorMagicStem,
} from '../server/vectorMagicBridge';

const originalConfiguredPath = process.env.VECTOR_MAGIC_EXE;
const temporaryDirectories: string[] = [];

afterEach(() => {
  if (originalConfiguredPath === undefined) delete process.env.VECTOR_MAGIC_EXE;
  else process.env.VECTOR_MAGIC_EXE = originalConfiguredPath;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Vector Magic Desktop bridge', () => {
  it('uses an explicitly configured native executable', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vector-magic-bridge-test-'));
    temporaryDirectories.push(directory);
    const executable = join(directory, 'vmde.exe');
    writeFileSync(executable, 'test executable placeholder');
    process.env.VECTOR_MAGIC_EXE = executable;

    expect(findVectorMagicExecutable()).toBe(executable);
  });

  it.skipIf(!existsSync(REPOSITORY_VECTOR_MAGIC_EXECUTABLE))(
    'prefers the complete repo-local Vector Magic Desktop files',
    () => {
      delete process.env.VECTOR_MAGIC_EXE;
      expect(findVectorMagicExecutable()).toBe(REPOSITORY_VECTOR_MAGIC_EXECUTABLE);
      const directory = dirname(REPOSITORY_VECTOR_MAGIC_EXECUTABLE);
      expect(existsSync(join(directory, 'QtCore4.dll'))).toBe(true);
      expect(existsSync(join(directory, 'QtGui4.dll'))).toBe(true);
      expect(existsSync(join(directory, 'imageformats', 'qjpeg4.dll'))).toBe(true);
    },
  );

  it('accepts real PNG signatures and rejects MIME spoofing', () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    expect(isSupportedVectorMagicBitmap(png, '.png')).toBe(true);
    expect(isSupportedVectorMagicBitmap(Buffer.from('not a png'), '.png')).toBe(false);
  });

  it('confines source names to a safe session filename', () => {
    expect(safeVectorMagicStem('../../My detailed logo (final).png')).toBe(
      'My_detailed_logo_final',
    );
    expect(safeVectorMagicStem('CON.png')).toBe('pattern');
  });

  it('allows only loopback clients to invoke the desktop bridge', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('192.168.1.20')).toBe(false);
  });

  it('validates and bounds native automation progress', () => {
    expect(
      parseVectorMagicAutomationStatus(
        JSON.stringify({ state: 'tracing', progress: 1.4, updatedAt: 'now' }),
      ),
    ).toEqual({ state: 'tracing', progress: 1, updatedAt: 'now' });
    expect(parseVectorMagicAutomationStatus('{"state":"invented","progress":0.5}')).toBeNull();
    expect(parseVectorMagicAutomationStatus('not json')).toBeNull();
  });
});
