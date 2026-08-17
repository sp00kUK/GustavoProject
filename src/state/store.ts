import { create } from 'zustand';
import type {
  BottomLogoSettings,
  CameraMode,
  CylinderSettings,
  ExportSettings,
  HandleNameSettings,
  MeshStats,
  MoldAssemblySettings,
  NavTab,
  OperationEditorTab,
  OperationSettings,
  PatternSettings,
  PrintablePartId,
  PrintableMesh,
  ProjectSettings,
  QualitySettings,
  ReliefSettings,
  SnapSettings,
  ValidationReport,
  ViewportTool,
} from '../types';
import type { RawPattern } from '../pattern/types';
import type { SeamReport } from '../pattern/seamAnalysis';
import { analyseSeams } from '../pattern/seamAnalysis';
import { defaultProject } from './defaults';
import {
  loadBottomLogoPattern,
  loadPattern,
  loadRowPatterns,
  loadSettings,
  loadUi,
  migrate,
  saveBottomLogoPattern,
  savePattern,
  saveRowPatterns,
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
  partIds: PrintablePartId[];
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
  rowPatterns: RawPattern[];
  bottomLogoPattern: RawPattern | null;
  operationPatterns: Record<string, RawPattern>;

  preview: PreviewModel | null;
  status: ModelStatus;
  progress: number;
  stage: GenerationStage | 'writing' | null;
  error: { title: string; message: string } | null;

  viewMode: ViewMode;
  showDebug: boolean;
  helpDismissed: boolean;
  hydrated: boolean;

  /* CAD UI Extended State */
  activeNavTab: NavTab;
  activeOperationTab: OperationEditorTab;
  selectedOperationId: string | null;
  activeViewportTool: ViewportTool;
  cameraMode: CameraMode;
  snapSettings: SnapSettings;
  lastSavedTime: string;
  theme: 'dark' | 'light';
  exportModalOpen: boolean;
  rightPanelCollapsed: boolean;

  /* Mask / exclusion state — mirrors Bumpmesh's exclusion system */
  excludedFaces: Set<number>;
  selectionMode: boolean;    // false = exclude painted, true = include-only painted
  brushRadius: number;
  brushIsRadius: boolean;
  bucketThreshold: number;
  eraseMode: boolean;
  maskVersion: number;       // bumped each time excludedFaces changes, for reactivity

  past: HistoryEntry[];
  future: HistoryEntry[];

  /* actions */
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  setName: (name: string) => void;
  
  importMesh: (meshId: string, filename: string) => void;
  updateBaseMesh: (patch: Partial<import('../types').BaseMeshSettings>) => void;
  addOperation: (op: OperationSettings) => void;
  updateOperation: (id: string, patch: Partial<OperationSettings>) => void;
  removeOperation: (id: string) => void;
  reorderOperation: (id: string, newIndex: number) => void;
  
  /* CAD UI Actions */
  setActiveNavTab: (tab: NavTab) => void;
  setActiveOperationTab: (tab: OperationEditorTab) => void;
  setSelectedOperationId: (id: string | null) => void;
  setActiveViewportTool: (tool: ViewportTool) => void;
  setCameraMode: (mode: CameraMode) => void;
  setExportModalOpen: (open: boolean) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  toggleRightPanel: () => void;
  toggleSnap: (key: keyof SnapSettings) => void;
  toggleTheme: () => void;
  setLastSavedTime: (time: string) => void;

  /* Mask / exclusion actions */
  setExcludedFaces: (faces: Set<number>) => void;
  addExcludedFaces: (faces: Iterable<number>) => void;
  removeExcludedFaces: (faces: Iterable<number>) => void;
  invertExcludedFaces: (triCount: number) => void;
  clearExcludedFaces: () => void;
  setSelectionMode: (include: boolean) => void;
  setBrushRadius: (radius: number) => void;
  setBrushIsRadius: (isRadius: boolean) => void;
  setBucketThreshold: (threshold: number) => void;
  setEraseMode: (erase: boolean) => void;

  // Legacy actions
  updateCylinder: (patch: Partial<CylinderSettings>) => void;
  updatePattern: (patch: Partial<PatternSettings>) => void;
  updateRelief: (patch: Partial<ReliefSettings>) => void;
  
  updateAssembly: (patch: Partial<MoldAssemblySettings>) => void;
  updateHandleName: (patch: Partial<HandleNameSettings>) => void;
  updateBottomLogo: (patch: Partial<BottomLogoSettings>) => void;
  updateQuality: (patch: Partial<QualitySettings>) => void;
  updateExport: (patch: Partial<ExportSettings>) => void;
  replaceSettings: (settings: ProjectSettings, recordHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  setPatternSource: (pattern: RawPattern | null, notice?: string | null) => void;
  setOperationPattern: (operationId: string, pattern: RawPattern) => void;
  setOperationRowPattern: (operationId: string, rowIndex: number, pattern: RawPattern | null) => void;
  updatePatternAdjustment: (patternId: string, patch: Partial<import('../types').PatternAdjustment>) => void;
  updateRowAdjustment: (rowIndex: number, patch: Partial<import('../types').RowAdjustment>) => void;
  addRowPatterns: (patterns: RawPattern[]) => void;
  removeRowPattern: (id: string) => void;
  setBottomLogoPattern: (pattern: RawPattern | null) => void;
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
    rowPatterns: [],
    bottomLogoPattern: null,
    operationPatterns: {},

    preview: null,
    status: 'idle',
    progress: 0,
    stage: null,
    error: null,

    viewMode: 'solid',
    showDebug: false,
    helpDismissed: false,
    hydrated: false,

    /* CAD UI Initial State */
    activeNavTab: 'project',
    activeOperationTab: 'settings',
    selectedOperationId: null,
    activeViewportTool: 'select',
    cameraMode: 'perspective',
    snapSettings: { grid: true, angle: true, seam: true, axis: true },
    lastSavedTime: '10:24:31',
    theme: 'dark',
    exportModalOpen: false,
    rightPanelCollapsed: false,

    /* Mask / exclusion initial state */
    excludedFaces: new Set<number>(),
    selectionMode: false,
    brushRadius: 5.0,
    brushIsRadius: true,
    bucketThreshold: 20,
    eraseMode: false,
    maskVersion: 0,

    past: [],
    future: [],

    async hydrate() {
      const ui = loadUi();
      const stored = loadSettings();
      const [pattern, rowPatterns, bottomLogoPattern] = await Promise.all([
        loadPattern(),
        loadRowPatterns(),
        loadBottomLogoPattern(),
      ]);

      set({
        settings: stored ? migrate(stored) : defaultProject(),
        locale: ui?.locale ?? detectLocale(),
        helpDismissed: ui?.helpDismissed ?? false,
        showDebug: ui?.showDebug ?? false,
        pattern,
        patternSeams: pattern ? analyseSeams(pattern) : null,
        rowPatterns,
        bottomLogoPattern,
        hydrated: true,
      });
      worker.setPatterns(
        [pattern, ...rowPatterns, bottomLogoPattern].filter(
          (item): item is RawPattern => item !== null,
        ),
      );
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
      const oldCircumference = Math.PI * s.cylinder.diameter;
      const newCircumference = Math.PI * (patch.diameter ?? s.cylinder.diameter);

      let newOps = s.operations;
      if (patch.diameter !== undefined && patch.diameter !== s.cylinder.diameter) {
        newOps = s.operations.map(op => {
          if (op.snapSeamlessWrap) {
             const oldWidth = oldCircumference / Math.max(1, op.columns);
             const newCols = Math.max(1, Math.round(newCircumference / oldWidth));
             return { ...op, columns: newCols };
          }
          return op;
        });
      }

      commit({ ...s, cylinder: { ...s.cylinder, ...patch }, operations: newOps });
    },

    importMesh(meshId: string, filename: string) {
      const s = get().settings;
      commit({
        ...s,
        baseMesh: {
          type: 'imported',
          meshId,
          filename,
          orientationMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
        }
      });
    },

    updateBaseMesh(patch) {
      const s = get().settings;
      commit({ ...s, baseMesh: { ...s.baseMesh, ...patch } as any });
    },

    addOperation(op) {
      const s = get().settings;
      commit({ ...s, operations: [...s.operations, op] });
    },

    updateOperation(id, patch) {
      const s = get().settings;
      const nextOps = s.operations.map(op => (op.id === id ? { ...op, ...patch } : op));
      const targetOp = nextOps.find(op => op.id === id);
      let nextRelief = s.relief;
      let nextPattern = s.pattern;
      if (targetOp && (targetOp.targetPart === 'body' || targetOp.targetPart === 'all')) {
        nextRelief = {
          ...s.relief,
          direction: targetOp.type === 'deboss' ? 'deboss' : 'emboss',
          depth: targetOp.depth ?? s.relief.depth,
        };
        nextPattern = {
          ...s.pattern,
          invert: targetOp.invert !== undefined ? targetOp.invert : s.pattern.invert,
        };
      }
      commit({
        ...s,
        relief: nextRelief,
        pattern: nextPattern,
        operations: nextOps,
      });
    },

    removeOperation(id) {
      const s = get().settings;
      commit({
        ...s,
        operations: s.operations.filter(op => op.id !== id)
      });
    },

    reorderOperation(id, newIndex) {
      const s = get().settings;
      const index = s.operations.findIndex(op => op.id === id);
      if (index === -1) return;
      const op = s.operations[index];
      const nextOps = [...s.operations];
      nextOps.splice(index, 1);
      nextOps.splice(newIndex, 0, op);
      commit({ ...s, operations: nextOps });
    },

    /* CAD UI Actions */
    setActiveNavTab(activeNavTab) {
      set({ activeNavTab });
    },

    setActiveOperationTab(activeOperationTab) {
      set({ activeOperationTab });
    },

    setSelectedOperationId(selectedOperationId) {
      set({ selectedOperationId });
    },

    setRightPanelCollapsed(rightPanelCollapsed) {
      set({ rightPanelCollapsed });
    },

    toggleRightPanel() {
      set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed }));
    },

    setActiveViewportTool(activeViewportTool) {
      set({ activeViewportTool });
    },

    /* Mask / exclusion actions */
    setExcludedFaces(faces) {
      set({ excludedFaces: faces, maskVersion: get().maskVersion + 1 });
    },
    addExcludedFaces(faces) {
      const next = new Set(get().excludedFaces);
      for (const f of faces) next.add(f);
      set({ excludedFaces: next, maskVersion: get().maskVersion + 1 });
    },
    removeExcludedFaces(faces) {
      const next = new Set(get().excludedFaces);
      for (const f of faces) next.delete(f);
      set({ excludedFaces: next, maskVersion: get().maskVersion + 1 });
    },
    invertExcludedFaces(triCount) {
      const current = get().excludedFaces;
      const next = new Set<number>();
      for (let i = 0; i < triCount; i++) {
        if (!current.has(i)) next.add(i);
      }
      set({ excludedFaces: next, maskVersion: get().maskVersion + 1 });
    },
    clearExcludedFaces() {
      set({ excludedFaces: new Set<number>(), maskVersion: get().maskVersion + 1 });
    },
    setSelectionMode(include) {
      // Changing mode clears the painted set (faces had opposite semantics)
      set({ selectionMode: include, excludedFaces: new Set<number>(), maskVersion: get().maskVersion + 1 });
    },
    setBrushRadius(radius) {
      set({ brushRadius: radius });
    },
    setBrushIsRadius(isRadius) {
      set({ brushIsRadius: isRadius });
    },
    setBucketThreshold(threshold) {
      set({ bucketThreshold: threshold });
    },
    setEraseMode(erase) {
      set({ eraseMode: erase });
    },

    setCameraMode(cameraMode) {
      set({ cameraMode });
    },

    setExportModalOpen(exportModalOpen) {
      set({ exportModalOpen });
    },

    toggleSnap(key) {
      const snapSettings = { ...get().snapSettings, [key]: !get().snapSettings[key] };
      set({ snapSettings });
    },

    toggleTheme() {
      set({ theme: get().theme === 'dark' ? 'light' : 'dark' });
    },

    setLastSavedTime(lastSavedTime) {
      set({ lastSavedTime });
    },

    updatePattern(patch) {
      const s = get().settings;
      commit({ ...s, pattern: { ...s.pattern, ...patch } });
    },

    updateRelief(patch) {
      const s = get().settings;
      commit({ ...s, relief: { ...s.relief, ...patch } });
    },

    updateAssembly(patch) {
      const s = get().settings;
      const assembly = { ...s.assembly, ...patch };
      commit({
        ...s,
        assembly,
        export:
          !assembly.enabled && s.export.scope === 'handle'
            ? { ...s.export, scope: 'body' }
            : s.export,
      });
    },

    updateHandleName(patch) {
      const s = get().settings;
      commit({ ...s, handleName: { ...s.handleName, ...patch } });
    },

    updateBottomLogo(patch) {
      const s = get().settings;
      const bottomLogo = { ...s.bottomLogo, ...patch };
      commit({
        ...s,
        bottomLogo,
        export:
          !bottomLogo.enabled && s.export.scope === 'bottomLogo'
            ? { ...s.export, scope: 'body' }
            : s.export,
      });
    },

    updateQuality(patch) {
      const s = get().settings;
      const preset = patch.export ?? patch.preview ?? s.quality.export;
      const customSpacing = patch.customSpacing !== undefined ? patch.customSpacing : s.quality.customSpacing;
      commit({
        ...s,
        quality: {
          ...s.quality,
          ...patch,
          preview: preset,
          export: preset,
          customSpacing,
        },
      });
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
      syncWorkerPatterns(get());
      void savePattern(pattern);
      schedulePreview();
    },

    setOperationPattern(operationId, pattern) {
      const nextOpPatterns = { ...get().operationPatterns, [operationId]: pattern, [pattern.id]: pattern };
      const currentOp = get().settings.operations.find((op) => op.id === operationId);
      const isBody = !currentOp || currentOp.targetPart === 'body' || currentOp.targetPart === 'all';
      
      set({
        operationPatterns: nextOpPatterns,
        ...(isBody ? { pattern, patternSeams: analyseSeams(pattern) } : {}),
      });

      get().updateOperation(operationId, {
        patternId: pattern.id,
        name: pattern.name ? `${pattern.name} (${currentOp?.targetPart || 'body'})` : currentOp?.name,
      });

      syncWorkerPatterns(get());
      schedulePreview();
    },

    setOperationRowPattern(operationId, rowIndex, pattern) {
      const state = get();
      const nextOpPatterns = pattern ? { ...state.operationPatterns, [pattern.id]: pattern } : state.operationPatterns;
      const nextRowPatterns = pattern ? [...state.rowPatterns.filter((p) => p.id !== pattern.id), pattern] : state.rowPatterns;

      const targetOp = state.settings.operations.find((op) => op.id === operationId);
      const rows = targetOp ? targetOp.rows : state.settings.pattern.rows;
      const currentIds = (targetOp ? targetOp.rowPatternIds : state.settings.pattern.rowPatternIds) ?? [];
      const newIds: Array<string | null> = [...currentIds];
      while (newIds.length < rows) newIds.push(null);
      newIds[rowIndex] = pattern ? pattern.id : null;

      if (targetOp) {
        state.updateOperation(operationId, { rowPatternIds: newIds });
      } else {
        const nextSettings = {
          ...state.settings,
          pattern: { ...state.settings.pattern, rowPatternIds: newIds }
        };
        commit(nextSettings);
      }

      set({
        operationPatterns: nextOpPatterns,
        rowPatterns: nextRowPatterns,
      });

      syncWorkerPatterns(get());
      void saveRowPatterns(nextRowPatterns);
      schedulePreview();
    },

    updatePatternAdjustment(patternId, patch) {
      const state = get();
      const current = state.settings.pattern.patternAdjustments?.[patternId] ?? {};
      const nextAdj = {
        ...state.settings.pattern.patternAdjustments,
        [patternId]: { ...current, ...patch },
      };
      const isPrimary = !patternId || patternId === 'primary' || patternId === state.pattern?.id;
      const nextPatternSettings = {
        ...state.settings.pattern,
        patternAdjustments: nextAdj,
        ...(isPrimary ? patch : {}),
      };
      commit({ ...state.settings, pattern: nextPatternSettings });
      schedulePreview();
    },

    updateRowAdjustment(rowIndex, patch) {
      const state = get();
      const current = state.settings.pattern.rowAdjustments?.[rowIndex] ?? {};
      const nextRowAdj = {
        ...(state.settings.pattern.rowAdjustments || {}),
        [rowIndex]: { ...current, ...patch },
      };
      const activeOpId = state.selectedOperationId ?? (state.settings.operations.length > 0 ? state.settings.operations[0].id : null);
      const nextOps = state.settings.operations.map((op) => {
        if (op.id === activeOpId || op.targetPart === 'body' || op.targetPart === 'all') {
          return {
            ...op,
            rowAdjustments: {
              ...(op.rowAdjustments || {}),
              [rowIndex]: { ...(op.rowAdjustments?.[rowIndex] || {}), ...patch },
            },
          };
        }
        return op;
      });
      commit({
        ...state.settings,
        pattern: { ...state.settings.pattern, rowAdjustments: nextRowAdj },
        operations: nextOps,
      });
      schedulePreview();
    },

    addRowPatterns(patterns) {
      if (patterns.length === 0) return;
      const existing = get().rowPatterns;
      const ids = new Set(existing.map((pattern) => pattern.id));
      const next = [...existing, ...patterns.filter((pattern) => !ids.has(pattern.id))];
      set({ rowPatterns: next });
      syncWorkerPatterns(get());
      void saveRowPatterns(next);
      schedulePreview();
    },

    removeRowPattern(id) {
      const next = get().rowPatterns.filter((pattern) => pattern.id !== id);
      set({ rowPatterns: next });
      const settings = get().settings;
      commit({
        ...settings,
        pattern: {
          ...settings.pattern,
          rowPatternIds: settings.pattern.rowPatternIds.map((value) =>
            value === id ? null : value,
          ),
        },
      });
      syncWorkerPatterns(get());
      void saveRowPatterns(next);
    },

    setBottomLogoPattern(pattern) {
      set({ bottomLogoPattern: pattern });
      if (!pattern && get().settings.export.scope === 'bottomLogo') {
        const settings = get().settings;
        commit({ ...settings, export: { ...settings.export, scope: 'body' } });
      }
      syncWorkerPatterns(get());
      void saveBottomLogoPattern(pattern);
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
      set({ rowPatterns: [], bottomLogoPattern: null });
      syncWorkerPatterns(get());
      void saveRowPatterns([]);
      void saveBottomLogoPattern(null);
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
      const { settings, pattern, bottomLogoPattern } = get();

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
          bottomLogoPatternId: bottomLogoPattern?.id ?? null,
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
              partIds: mesh.partIds,
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
      const { settings, pattern, bottomLogoPattern } = get();
      set({ status: 'exporting', progress: 0, stage: 'pattern', error: null });
      try {
        const result = await worker.generate({
          purpose: 'export',
          settings,
          patternId: pattern?.id ?? null,
          bottomLogoPatternId: bottomLogoPattern?.id ?? null,
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
      syncWorkerPatterns(get());
      set({ status: 'idle', progress: 0, stage: null });
    },
  };
});

function syncWorkerPatterns(state: Pick<AppState, 'pattern' | 'rowPatterns' | 'bottomLogoPattern' | 'operationPatterns'>) {
  const unique = new Map<string, RawPattern>();
  for (const pattern of [
    state.pattern,
    ...state.rowPatterns,
    state.bottomLogoPattern,
    ...Object.values(state.operationPatterns ?? {}),
  ]) {
    if (pattern) unique.set(pattern.id, pattern);
  }
  worker.setPatterns([...unique.values()]);
}
