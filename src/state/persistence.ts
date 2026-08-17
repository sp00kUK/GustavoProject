import type { PatternSettings, ProjectSettings, PrintableMesh } from '../types';
import type { Locale } from '../i18n';
import type { RawPattern } from '../pattern/types';
import { defaultProject } from './defaults';

/**
 * Local persistence only. Nothing leaves the machine: settings go to
 * localStorage because they are small and synchronous, artwork goes to
 * IndexedDB because a 2048 x 2048 luminance plane is 4 MB and localStorage
 * would refuse it.
 */

const SETTINGS_KEY = 'cpd.project.v1';
const UI_KEY = 'cpd.ui.v1';
const DB_NAME = 'cpd';
const DB_VERSION = 3; // Incremented for masks
const STORE = 'patterns';
const MESH_STORE = 'meshes';
const MASKS_STORE = 'masks';
const PATTERN_KEY = 'current';
const ROW_PATTERNS_KEY = 'row-designs';
const BOTTOM_LOGO_KEY = 'bottom-logo';

export interface PersistedUi {
  locale: Locale;
  helpDismissed: boolean;
  showDebug: boolean;
}

/* -------------------------------------------------------------------- *
 * Settings
 * -------------------------------------------------------------------- */

export function saveSettings(settings: ProjectSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or a full quota. Losing autosave is not worth an alert.
  }
}

export function loadSettings(): ProjectSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw) as Partial<ProjectSettings>);
  } catch {
    return null;
  }
}

export function saveUi(ui: PersistedUi): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* ignore */
  }
}

export function loadUi(): Partial<PersistedUi> | null {
  try {
    const raw = localStorage.getItem(UI_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedUi>) : null;
  } catch {
    return null;
  }
}

/**
 * Merge stored settings over the current defaults.
 *
 * Fields added in a later version simply take their default rather than
 * arriving as undefined and quietly producing NaN geometry.
 */
export function migrate(stored: Partial<ProjectSettings>): ProjectSettings {
  const base = defaultProject();
  const pattern = { ...base.pattern, ...stored.pattern } as PatternSettings &
    Record<string, unknown>;
  // Builds from an abandoned early tracer persisted these fields. Drop them;
  // vectorization is now an explicit VTracer action rather than project state.
  delete pattern.vectorize;
  delete pattern.vectorizeSmoothness;
  delete pattern.vectorizeCornerThreshold;
  pattern.rowPatternIds = Array.isArray(pattern.rowPatternIds)
    ? pattern.rowPatternIds.map((id) => (typeof id === 'string' ? id : null))
    : [];
  return {
    name: typeof stored.name === 'string' ? stored.name : base.name,
    baseMesh: stored.baseMesh ? { ...base.baseMesh, ...stored.baseMesh } as any : base.baseMesh,
    operations: Array.isArray(stored.operations) ? stored.operations : base.operations,
    
    cylinder: { ...base.cylinder, ...stored.cylinder },
    pattern,
    relief: { ...base.relief, ...stored.relief },
    assembly: { ...base.assembly, ...stored.assembly },
    handleName: { ...base.handleName, ...stored.handleName },
    bottomLogo: { ...base.bottomLogo, ...stored.bottomLogo },
    quality: { ...base.quality, ...stored.quality },
    export: { ...base.export, ...stored.export },
  };
}

/* -------------------------------------------------------------------- *
 * Pattern & Mesh blobs
 * -------------------------------------------------------------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      if (oldVersion < 1 || !db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (oldVersion < 2 || !db.objectStoreNames.contains(MESH_STORE)) {
        db.createObjectStore(MESH_STORE);
      }
      if (oldVersion < 3 || !db.objectStoreNames.contains(MASKS_STORE)) {
        db.createObjectStore(MASKS_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB failed'));
  });
}

export async function saveImportedMesh(meshId: string, mesh: PrintableMesh): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MESH_STORE, 'readwrite');
      tx.objectStore(MESH_STORE).put(mesh, meshId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('write failed'));
    });
    db.close();
  } catch (err) {
    throw new Error('Failed to save mesh to local database.');
  }
}

export async function loadImportedMesh(meshId: string): Promise<PrintableMesh | null> {
  try {
    const db = await openDb();
    const record = await new Promise<PrintableMesh | null>((resolve, reject) => {
      const tx = db.transaction(MESH_STORE, 'readonly');
      const request = tx.objectStore(MESH_STORE).get(meshId);
      request.onsuccess = () => resolve((request.result as PrintableMesh) ?? null);
      request.onerror = () => reject(request.error ?? new Error('read failed'));
    });
    db.close();
    return record;
  } catch {
    return null;
  }
}

export async function saveMask(maskId: string, maskData: Uint8Array): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MASKS_STORE, 'readwrite');
      tx.objectStore(MASKS_STORE).put(maskData, maskId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('write failed'));
    });
    db.close();
  } catch (err) {
    throw new Error('Failed to save mask to local database.');
  }
}

export async function loadMask(maskId: string): Promise<Uint8Array | null> {
  try {
    const db = await openDb();
    const record = await new Promise<Uint8Array | null>((resolve, reject) => {
      const tx = db.transaction(MASKS_STORE, 'readonly');
      const request = tx.objectStore(MASKS_STORE).get(maskId);
      request.onsuccess = () => resolve((request.result as Uint8Array) ?? null);
      request.onerror = () => reject(request.error ?? new Error('read failed'));
    });
    db.close();
    return record;
  } catch {
    return null;
  }
}

export async function savePattern(pattern: RawPattern | null): Promise<void> {
  return savePatternRecord(PATTERN_KEY, pattern);
}

export async function saveBottomLogoPattern(pattern: RawPattern | null): Promise<void> {
  return savePatternRecord(BOTTOM_LOGO_KEY, pattern);
}

async function savePatternRecord(key: string, pattern: RawPattern | null): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      if (pattern) store.put(encodePattern(pattern), key);
      else store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('write failed'));
    });
    db.close();
  } catch {
    // Autosaving artwork is a convenience, never a requirement.
  }
}

export async function loadPattern(): Promise<RawPattern | null> {
  return loadPatternRecord(PATTERN_KEY);
}

export async function loadBottomLogoPattern(): Promise<RawPattern | null> {
  return loadPatternRecord(BOTTOM_LOGO_KEY);
}

async function loadPatternRecord(key: string): Promise<RawPattern | null> {
  try {
    const db = await openDb();
    const record = await new Promise<RawPattern | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as RawPattern) ?? null);
      request.onerror = () => reject(request.error ?? new Error('read failed'));
    });
    db.close();
    if (!record || !record.luminance || !record.width) return null;
    return decodePattern(record);
  } catch {
    return null;
  }
}

export async function saveRowPatterns(patterns: RawPattern[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(patterns.map(encodePattern), ROW_PATTERNS_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('write failed'));
    });
    db.close();
  } catch {
    /* optional autosave */
  }
}

export async function loadRowPatterns(): Promise<RawPattern[]> {
  try {
    const db = await openDb();
    const records = await new Promise<RawPattern[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(ROW_PATTERNS_KEY);
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error ?? new Error('read failed'));
    });
    db.close();
    return records.map(decodePattern).filter((pattern): pattern is RawPattern => pattern !== null);
  } catch {
    return [];
  }
}

function encodePattern(pattern: RawPattern): RawPattern {
  return {
    id: pattern.id,
    name: pattern.name,
    kind: pattern.kind,
    width: pattern.width,
    height: pattern.height,
    originalWidth: pattern.originalWidth,
    originalHeight: pattern.originalHeight,
    luminance: pattern.luminance,
    alpha: pattern.alpha,
    sourceBytes: pattern.sourceBytes,
    sourceMimeType: pattern.sourceMimeType,
  };
}

function decodePattern(record: RawPattern | null): RawPattern | null {
  if (!record || !record.luminance || !record.width) return null;
  return {
    ...record,
    luminance: new Uint8Array(record.luminance),
    alpha: record.alpha ? new Uint8Array(record.alpha) : null,
    sourceBytes: record.sourceBytes ? new Uint8Array(record.sourceBytes) : undefined,
  };
}

/* -------------------------------------------------------------------- *
 * Project files
 * -------------------------------------------------------------------- */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next frame so the download has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportProjectFile(settings: ProjectSettings): Blob {
  return new Blob([JSON.stringify({ version: 1, settings }, null, 2)], {
    type: 'application/json',
  });
}

export async function importProjectFile(file: File): Promise<ProjectSettings> {
  const text = await file.text();
  const parsed = JSON.parse(text) as { settings?: Partial<ProjectSettings> };
  return migrate(parsed.settings ?? (parsed as Partial<ProjectSettings>));
}
