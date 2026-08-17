import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createI18n, I18nContext, useI18n } from './i18n';
import { useStore } from './state/store';
import { buildFilename } from './exporters/types';
import { estimateTriangles, resolveResolution, spacingForPreset } from './geometry/quality';
import { downloadBlob, exportProjectFile } from './state/persistence';
import { Viewport, type ViewportHandle } from './viewport/Viewport';
import { TopToolbar } from './components/layout/TopToolbar';
import { NavigationRail } from './components/layout/NavigationRail';
import { ContextInspector } from './components/layout/ContextInspector';
import { OperationEditorDock } from './components/layout/OperationEditorDock';
import { ValidationInspector } from './components/layout/ValidationInspector';
import { ViewportOverlayControls } from './components/viewport/ViewportOverlayControls';
import { StatusBar } from './components/layout/StatusBar';
import {
  ErrorOverlay,
  HelpOverlay,
  LargeExportOverlay,
  ProgressOverlay,
  type LargeExportPrompt,
} from './components/Overlays';
import { ExportModal } from './components/ExportModal';
import type { ExportFormat } from './types';

/** Above this, an export prompt is shown before running a heavy generation */
const LARGE_EXPORT_TRIANGLES = 3_000_000;

export default function App() {
  const locale = useStore((s) => s.locale);
  const i18n = useMemo(() => createI18n(locale), [locale]);

  return (
    <I18nContext.Provider value={i18n}>
      <Workspace />
    </I18nContext.Provider>
  );
}

function Workspace() {
  const { t } = useI18n();

  const viewportRef = useRef<ViewportHandle | null>(null);
  const [largeExport, setLargeExport] = useState<LargeExportPrompt | null>(null);

  useEffect(() => {
    void useStore.getState().hydrate();
  }, []);

  const doExport = useCallback(
    async (overrideFormat?: ExportFormat, force = false) => {
      const settings = useStore.getState().settings;
      const format = overrideFormat ?? settings.export.format;
      const resolution = resolveResolution(
        settings.cylinder.diameter,
        settings.cylinder.height,
        spacingForPreset(settings.quality.export, settings.quality.customSpacing),
      );
      const estimate = estimateTriangles(
        resolution.radialSegments,
        resolution.verticalSegments,
        settings.pattern.mode,
      );

      if (!force && estimate > LARGE_EXPORT_TRIANGLES) {
        setLargeExport({
          triangles: estimate,
          quality: settings.quality.export,
          onConfirm: () => {
            setLargeExport(null);
            void doExport(format, true);
          },
          onUseHigh: () => {
            setLargeExport(null);
            useStore.getState().updateQuality({ export: 'high' });
            void doExport(format, true);
          },
          onCancel: () => setLargeExport(null),
        });
        return;
      }

      const filename = buildFilename({ ...settings, export: { ...settings.export, format } }, format);
      try {
        const result = await useStore.getState().runExport(filename);
        if (result) downloadBlob(result.blob, result.filename);
      } catch (error) {
        useStore.getState().setError({
          title: t('error.title') || 'Export Error',
          message:
            (error as Error).message ||
            t('error.exportFailed', { quality: settings.quality.export }),
        });
      }
    },
    [t],
  );

  /* Desktop CAD Keyboard Shortcuts */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) useStore.getState().redo();
        else useStore.getState().undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        const settings = useStore.getState().settings;
        downloadBlob(
          exportProjectFile(settings),
          `${settings.name.trim().replace(/[^\w-]+/g, '_') || 'project'}.cpdproj`,
        );
        useStore.getState().setLastSavedTime(new Date().toLocaleTimeString());
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        useStore.getState().setExportModalOpen(true);
        return;
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;

      // Tool and navigation shortcuts
      const key = event.key.toLowerCase();
      if (key === 'f') viewportRef.current?.fit();
      if (key === 'r') viewportRef.current?.setView('iso');
      if (key === 'v') useStore.getState().setActiveViewportTool('select');
      if (key === 'b') useStore.getState().setActiveViewportTool('brush');
      if (key === 'g') useStore.getState().setActiveViewportTool('bucket');
      if (key === 'w') {
        const current = useStore.getState().viewMode;
        useStore.getState().setViewMode(current === 'wireframe' ? 'solid' : 'wireframe');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const exportModalOpen = useStore((s) => s.exportModalOpen);
  const setExportModalOpen = useStore((s) => s.setExportModalOpen);
  const rightPanelCollapsed = useStore((s) => s.rightPanelCollapsed);

  return (
    <div className="cad-app">
      {/* Zone 1: Top Header Toolbar */}
      <TopToolbar onExport={() => setExportModalOpen(true)} />

      {/* Main Workspace Body */}
      <div className={`cad-workspace-body ${rightPanelCollapsed ? 'right-collapsed' : ''}`}>
        {/* Zone 2: Far-Left Navigation Rail */}
        <NavigationRail />

        {/* Zone 3: Left Contextual Inspector */}
        <ContextInspector />

        {/* Zone 4 & 6: Center 3D Viewport & Bottom Operation Editor Dock */}
        <main className="cad-center-stage">
          <div className="cad-viewport-container">
            <ViewportOverlayControls
              onSetCameraView={(view) => viewportRef.current?.setView(view)}
              onFit={() => viewportRef.current?.fit()}
            />
            <Viewport
              onReady={(handle) => {
                viewportRef.current = handle;
              }}
              onError={() =>
                useStore
                  .getState()
                  .setError({ title: t('error.title') || 'WebGL Error', message: t('error.webgl') || 'WebGL failed' })
              }
            />
          </div>

          {/* Zone 6: Bottom Operation Editor Dock */}
          <OperationEditorDock />
        </main>

        {/* Zone 5: Right Validation / Manufacturing Inspector */}
        <ValidationInspector />
      </div>

      {/* Zone 7: Bottom Status Bar */}
      <StatusBar />

      {/* Dialogs & Overlays */}
      <HelpOverlay />
      <ErrorOverlay />
      <ProgressOverlay />
      <LargeExportOverlay prompt={largeExport} />
      {exportModalOpen && <ExportModal onClose={() => setExportModalOpen(false)} />}
    </div>
  );
}
