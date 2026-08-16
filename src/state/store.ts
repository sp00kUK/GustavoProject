import { create } from 'zustand';
import type {
  CylinderSettings,
  ExportSettings,
  MeshStats,
  PatternSettings,
  PrintableMesh,
  ProjectSettings,
  QualitySettings,
  ReliefSettings,
  ValidationReport,
} from '../types';
import type { RawPattern } from '../pattern/types';
import type { SeamReport } from '../pattern/seamAnalysis';
import { analyseSeams } from '../pattern/seamAnalysis';
import { defaultProject } from './defaults';
import {
  loadPattern,
  loadSettings,
  loadUi,
  migrate,
  savePattern,
  saveSettings,
  saveUi,
} from './persistence';
import { detectLocale, type Locale } from '../i18n';
import {
  CancelledError,
  decodeMesh,
  MeshWorkerClient,
  type FileResult,
  type MeshResult,
} from '../workers/MeshWorkerClient';
import { validateSettings } from '../geometry/constraints';
import type { GenerationStage } from '../geometry/generateCylinderRelief';

export type ViewMode = 'solid' | 'wireframe' | 'normals' | 'mask' | 'heatmap';

export type ModelStatus =
  | 'idle'
  | 'generating'
  | 'valid'
  | 'warning'
  | 'invalid'
  | 'exporting';

export interface PreviewModel {
  mesh: PrintableMesh;
  stats: MeshStats;
  validation: ValidationReport;
  resolution: { radialSegments: number; verticalSegments: number; spacingMm: number };
  elapsedMs: number;
  pinchFixes: number;
}

interface HistoryEntry {
  settings: ProjectSettings;
}

export interface AppState {
  settings: ProjectSettings;
  locale: Locale;

  pattern: RawPattern | null;
  patternSeams: SeamReport | null;
  patternNotice: string | null;

  preview: PreviewModel | null;
  status: ModelStatus;
  progress: number;
  stage: GenerationStage | 'writing' | null;
  error: { title: string; message: string } | null;

  viewMode: ViewMode;
  showDebug: boolean;
  helpDismissed: boolean;
  hydrated: boolean;

  past: HistoryEntry[];
  future: HistoryEntry[];

  /* actions */
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  setName: (name: string) => void;
  updateCylinder: (patch: Partial<CylinderSettings>) => void;
  updatePattern: (patch: Partial<PatternSettings>) => void;
  updateRelief: (patch: Partial<ReliefSettings>) => void;
  updateQuality: (patch: Partial<QualitySettings>) => void;
  updateExport: (patch: Partial<ExportSettings>) => void;
  replaceSettings: (settings: ProjectSettings, recordHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  setPatternSource: (pattern: RawPattern | null, notice?: string | null) => void;
  resetPattern: () => void;
  resetSettings: () => void;
  newProject: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleDebug: () => void;
  dismissHelp: () => void;
  showHelp: () => void;
  setError: (error: { title: string; message: string } | null) => void;
  regenerate: () => void;
  runExport: (filename: string) => Promise<FileResult | null>;
  cancel: () => void;
}

const worker = new MeshWorkerClient();

/** Preview debounce. Long enough to skip a slider drag, short enough to feel live. */
const PREVIEW_DEBOUNCE_MS = 160;
let previewTimer: ReturnType<typeof setTimeout> | null = null;
/** Bounded so a long editing session cannot grow without limit. */
const MAX_HISTORY = 60;

export const useStore = create<AppState>((set, get) => {
  /**
   * Every settings mutation funnels through here, which is what makes undo,
   * autosave and preview regeneration consistent - none of them can be
   * forgotten at a call site.
   */
  const commit = (next: ProjectSettings, recordHistory = true) => {
    const state = get();
    set({
      settings: next,
      past: recordHistory
        ? [...state.past, { settings: state.settings }].slice(-MAX_HISTORY)
        : state.past,
      future: recordHistory ? [] : state.future,
    });
    saveSettings(next);
    schedulePreview();
  };

  const schedulePreview = () => {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      previewTimer = null;
      get().regenerate();
    }, PREVIEW_DEBOUNCE_MS);
  };

  return {
    settings: defaultProject(),
    locale: 'en',

    pattern: null,
    patternSeams: null,
    patternNotice: null,

    preview: null,
    status: 'idle',
    progress: 0,
    stage: null,
    error: null,

    viewMode: 'solid',
    showDebug: false,
    helpDismissed: false,
    hydrated: false,

    past: [],
    future: [],

    async hydrate() {
      const ui = loadUi();
      const stored = loadSettings();
      const pattern = await loadPattern();

      set({
        settings: stored ? migrate(stored) : defaultProject(),
        locale: ui?.locale ?? detectLocale(),
        helpDismissed: ui?.helpDismissed ?? false,
        showDebug: ui?.showDebug ?? false,
        pattern,
        patternSeams: pattern ? analyseSeams(pattern) : null,
        hydrated: true,
      });
      worker.setPattern(pattern);
      get().regenerate();
    },

    setLocale(locale) {
      set({ locale });
      saveUi({
        locale,
        helpDismissed: get().helpDismissed,
        showDebug: get().showDebug,
      });
    },

    setName(name) {
      commit({ ...get().settings, name });
    },

    updateCylinder(patch) {
      const s = get().settings;
      commit({ ...s, cylinder: { ...s.cylinder, ...patch } });
    },

    updatePattern(patch) {
      const s = get().settings;
      commit({ ...s, pattern: { ...s.pattern, ...patch } });
    },

    updateRelief(patch) {
      const s = get().settings;
      commit({ ...s, relief: { ...s.relief, ...patch } });
    },

    updateQuality(patch) {
      const s = get().settings;
      commit({ ...s, quality: { ...s.quality, ...patch } });
    },

    updateExport(patch) {
      const s = get().settings;
      commit({ ...s, export: { ...s.export, ...patch } });
    },

    replaceSettings(settings, recordHistory = true) {
      commit(settings, recordHistory);
    },

    undo() {
      const { past, settings, future } = get();
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      set({
        past: past.slice(0, -1),
        settings: previous.settings,
        future: [{ settings }, ...future].slice(0, MAX_HISTORY),
      });
      saveSettings(previous.settings);
      schedulePreview();
    },

    redo() {
      const { past, settings, future } = get();
      if (future.length === 0) return;
      const next = future[0];
      set({
        past: [...past, { settings }].slice(-MAX_HISTORY),
        settings: next.settings,
        future: future.slice(1),
      });
      saveSettings(next.settings);
      schedulePreview();
    },

    setPatternSource(pattern, notice = null) {
      set({
        pattern,
        patternSeams: pattern ? analyseSeams(pattern) : null,
        patternNotice: notice,
      });
      worker.setPattern(pattern);
      void savePattern(pattern);
      schedulePreview();
    },

    resetPattern() {
      get().setPatternSource(null);
    },

    resetSettings() {
      const fresh = defaultProject(get().settings.name);
      commit(fresh);
    },

    newProject() {
      worker.cancel();
      const fresh = defaultProject();
      set({ past: [], future: [], preview: null, status: 'idle', error: null });
      commit(fresh, false);
      get().setPatternSource(null);
    },

    setViewMode(viewMode) {
      set({ viewMode });
    },

    toggleDebug() {
      const showDebug = !get().showDebug;
      set({ showDebug });
      saveUi({
        locale: get().locale,
        helpDismissed: get().helpDismissed,
        showDebug,
      });
    },

    dismissHelp() {
      set({ helpDismissed: true });
      saveUi({ locale: get().locale, helpDismissed: true, showDebug: get().showDebug });
    },

    showHelp() {
      set({ helpDismissed: false });
      saveUi({ locale: get().locale, helpDismissed: false, showDebug: get().showDebug });
    },

    setError(error) {
      set({ error });
    },

    regenerate() {
      const { settings, pattern } = get();

      // Blocked configurations never reach the worker; the panel explains why.
      const check = validateSettings(settings.cylinder, settings.relief);
      if (!check.canGenerate) {
        set({ status: 'invalid', progress: 0, stage: null });
        return;
      }

      set({ status: 'generating', progress: 0, stage: 'pattern', error: null });

      worker
        .generate({
          purpose: 'preview',
          settings,
          patternId: pattern?.id ?? null,
          onProgress: ({ progress, stage }) => set({ progress, stage }),
        })
        .then((result) => {
          const mesh = result as MeshResult;
          if (mesh.type !== 'MESH') return;
          const decoded = decodeMesh(mesh.mesh);
          const hasWarnings =
            mesh.validation.issues.some((i) => i.severity === 'warning') ||
            check.issues.some((i) => i.severity === 'warning');
          set({
            preview: {
              mesh: {
                positions: decoded.positions,
                indices: decoded.indices,
                normals: decoded.normals ?? undefined,
              },
              stats: mesh.stats,
              validation: mesh.validation,
              resolution: mesh.resolution,
              elapsedMs: mesh.elapsedMs,
              pinchFixes: mesh.pinchFixes,
            },
            status: !mesh.validation.ok ? 'invalid' : hasWarnings ? 'warning' : 'valid',
            progress: 1,
            stage: 'done',
          });
        })
        .catch((error: Error) => {
          if (error instanceof CancelledError) {
            set({ status: 'idle', progress: 0, stage: null });
            return;
          }
          set({ status: 'invalid', progress: 0, stage: null });
        });
    },

    async runExport(filename) {
      const { settings, pattern } = get();
      set({ status: 'exporting', progress: 0, stage: 'pattern', error: null });
      try {
        const result = await worker.generate({
          purpose: 'export',
          settings,
          patternId: pattern?.id ?? null,
          filename,
          onProgress: ({ progress, stage }) => set({ progress, stage }),
        });
        set({ status: 'valid', progress: 1, stage: 'done' });
        // The preview mesh was discarded when the worker switched jobs, so
        // rebuild it: the user must never lose their model to an export.
        schedulePreview();
        return result.type === 'FILE' ? result : null;
      } catch (error) {
        set({ status: 'warning', progress: 0, stage: null });
        schedulePreview();
        if (error instanceof CancelledError) return null;
        throw error;
      }
    },

    cancel() {
      if (previewTimer) {
        clearTimeout(previewTimer);
        previewTimer = null;
      }
      worker.cancel();
      worker.setPattern(get().pattern);
      set({ status: 'idle', progress: 0, stage: null });
    },
  };
});
