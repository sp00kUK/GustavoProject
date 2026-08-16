import type { ProjectSettings } from '../types';
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
const DB_VERSION = 1;
const STORE = 'patterns';
const PATTERN_KEY = 'current';

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
  return {
    name: typeof stored.name === 'string' ? stored.name : base.name,
    cylinder: { ...base.cylinder, ...stored.cylinder },
    pattern: { ...base.pattern, ...stored.pattern },
    relief: { ...base.relief, ...stored.relief },
    quality: { ...base.quality, ...stored.quality },
    export: { ...base.export, ...stored.export },
  };
}

/* -------------------------------------------------------------------- *
 * Pattern blobs
 * -------------------------------------------------------------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB failed'));
  });
}

export async function savePattern(pattern: RawPattern | null): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      if (pattern) {
        store.put(
          {
            id: pattern.id,
            name: pattern.name,
            kind: pattern.kind,
            width: pattern.width,
            height: pattern.height,
            originalWidth: pattern.originalWidth,
            originalHeight: pattern.originalHeight,
            luminance: pattern.luminance,
            alpha: pattern.alpha,
          },
          PATTERN_KEY,
        );
      } else {
        store.delete(PATTERN_KEY);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('write failed'));
    });
    db.close();
  } catch {
    // Autosaving artwork is a convenience, never a requirement.
  }
}

export async function loadPattern(): Promise<RawPattern | null> {
  try {
    const db = await openDb();
    const record = await new Promise<RawPattern | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(PATTERN_KEY);
      request.onsuccess = () => resolve((request.result as RawPattern) ?? null);
      request.onerror = () => reject(request.error ?? new Error('read failed'));
    });
    db.close();
    if (!record || !record.luminance || !record.width) return null;
    return {
      ...record,
      luminance: new Uint8Array(record.luminance),
      alpha: record.alpha ? new Uint8Array(record.alpha) : null,
    };
  } catch {
    return null;
  }
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
