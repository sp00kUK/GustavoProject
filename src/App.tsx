import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_VERSION } from './types';
import { createI18n, I18nContext, LOCALES, useI18n, type Locale } from './i18n';
import { useStore } from './state/store';
import { downloadBlob, exportProjectFile, importProjectFile } from './state/persistence';
import { buildFilename } from './exporters/types';
import { estimateTriangles, resolveResolution, spacingForPreset } from './geometry/quality';
import { Viewport, type CameraView, type ViewportHandle } from './viewport/Viewport';
import { PatternSection } from './components/PatternSection';
import {
  CylinderSection,
  ExportSection,
  QualitySection,
  RepeatSection,
  ReliefSection,
  TransformSection,
} from './components/SettingsPanels';
import { DebugPanel, StatusChip, SummaryPanel, ValidationPanel } from './components/InfoPanels';
import {
  ErrorOverlay,
  HelpOverlay,
  LargeExportOverlay,
  ProgressOverlay,
  type LargeExportPrompt,
} from './components/Overlays';
import type { ViewMode } from './state/store';

/** Above this, an export is worth a confirmation rather than a frozen tab. */
const LARGE_EXPORT_TRIANGLES = 2_000_000;

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

  // Selected field by field rather than subscribing to the whole store: an
  // export ticks `progress` many times a second, and a broad subscription
  // would re-render every panel on each tick.
  const name = useStore((s) => s.settings.name);
  const cylinder = useStore((s) => s.settings.cylinder);
  const depth = useStore((s) => s.settings.relief.depth);
  const locale = useStore((s) => s.locale);
  const viewMode = useStore((s) => s.viewMode);
  const showDebug = useStore((s) => s.showDebug);
  const hasPattern = useStore((s) => s.pattern !== null);
  const hydrated = useStore((s) => s.hydrated);

  const viewportRef = useRef<ViewportHandle | null>(null);
  const [fps, setFps] = useState(0);
  const [largeExport, setLargeExport] = useState<LargeExportPrompt | null>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void useStore.getState().hydrate();
    // Hydration runs once on mount.
  }, []);

  const doExport = useCallback(
    async (force = false) => {
      const settings = useStore.getState().settings;
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
            void doExport(true);
          },
          onUseHigh: () => {
            setLargeExport(null);
            useStore.getState().updateQuality({ export: 'high' });
            void doExport(true);
          },
          onCancel: () => setLargeExport(null),
        });
        return;
      }

      const filename = buildFilename(settings, settings.export.format);
      try {
        const result = await useStore.getState().runExport(filename);
        if (result) downloadBlob(result.blob, result.filename);
      } catch (error) {
        // The project and its preview survive a failed export untouched.
        useStore.getState().setError({
          title: t('error.title'),
          message:
            (error as Error).message ||
            t('error.exportFailed', { quality: settings.quality.export }),
        });
      }
    },
    [t],
  );

  /* Keyboard shortcuts (spec 114). */
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
        downloadBlob(exportProjectFile(settings), `${sanitise(settings.name)}.cpdproj`);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        void doExport();
        return;
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key.toLowerCase() === 'f') viewportRef.current?.fit();
      if (event.key.toLowerCase() === 'r') viewportRef.current?.setView('iso');
      if (event.key.toLowerCase() === 'w') {
        const current = useStore.getState().viewMode;
        useStore.getState().setViewMode(current === 'wireframe' ? 'solid' : 'wireframe');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doExport]);

  const viewModes: Array<{ id: ViewMode; label: string }> = [
    { id: 'solid', label: t('view.solid') },
    { id: 'wireframe', label: t('view.wireframe') },
    { id: 'normals', label: t('view.normals') },
    { id: 'heatmap', label: t('view.heatmap') },
  ];

  const cameraViews: Array<{ id: CameraView; label: string }> = [
    { id: 'front', label: t('view.front') },
    { id: 'right', label: t('view.right') },
    { id: 'back', label: t('view.back') },
    { id: 'left', label: t('view.left') },
    { id: 'top', label: t('view.top') },
    { id: 'bottom', label: t('view.bottom') },
    { id: 'iso', label: t('view.iso') },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>{t('app.title')}</h1>
            <p>{t('app.subtitle')}</p>
          </div>
        </div>

        <input
          className="project-name"
          value={name}
          aria-label={t('field.projectName')}
          onChange={(e) => useStore.getState().setName(e.target.value)}
        />

        <div className="header-actions">
          <button type="button" onClick={() => useStore.getState().newProject()}>
            {t('action.new')}
          </button>
          <button
            type="button"
            onClick={() =>
              downloadBlob(
                exportProjectFile(useStore.getState().settings),
                `${sanitise(name)}.cpdproj`,
              )
            }
          >
            {t('action.save')}
          </button>
          <button type="button" onClick={() => projectInputRef.current?.click()}>
            {t('action.load')}
          </button>
          <input
            ref={projectInputRef}
            type="file"
            accept=".cpdproj,application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                useStore.getState().replaceSettings(await importProjectFile(file));
              } catch {
                useStore
                  .getState()
                  .setError({ title: t('error.title'), message: t('error.decodeFailed') });
              }
            }}
          />
          <select
            aria-label={t('field.language')}
            value={locale}
            onChange={(e) => useStore.getState().setLocale(e.target.value as Locale)}
          >
            {LOCALES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <button type="button" className="primary" onClick={() => void doExport()}>
            {t('action.export')}
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="panel" aria-label={t('section.cylinder')}>
          <CylinderSection />
          <PatternSection />
          <RepeatSection />
          <TransformSection />
          <ReliefSection />
          <QualitySection />
          <ExportSection onExport={() => void doExport()} />
        </aside>

        <main className="stage">
          <div className="viewport-toolbar">
            <div className="segmented small">
              {viewModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={viewMode === mode.id ? 'active' : ''}
                  aria-pressed={viewMode === mode.id}
                  onClick={() => useStore.getState().setViewMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <div className="segmented small">
              {cameraViews.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => viewportRef.current?.setView(view.id)}
                >
                  {view.label}
                </button>
              ))}
            </div>
            <div className="toolbar-right">
              <button type="button" onClick={() => viewportRef.current?.fit()}>
                {t('action.fitModel')}
              </button>
              <button type="button" onClick={() => useStore.getState().toggleDebug()}>
                {t('section.debug')}
              </button>
            </div>
          </div>

          <Viewport
            onReady={(handle) => {
              viewportRef.current = handle;
            }}
            onFps={setFps}
            onError={() =>
              useStore
                .getState()
                .setError({ title: t('error.title'), message: t('error.webgl') })
            }
          />

          {!hasPattern && hydrated && (
            <p className="viewport-hint">{t('warning.noPattern')}</p>
          )}
        </main>

        <aside className="panel right" aria-label={t('section.summary')}>
          <ValidationPanel />
          <SummaryPanel />
          {showDebug && <DebugPanel fps={fps} />}
        </aside>
      </div>

      <footer className="status-bar">
        <StatusChip />
        <span className="muted">
          {t('summary.diameter')} {cylinder.diameter} · {t('summary.height')}{' '}
          {cylinder.height} · {t('summary.reliefDepth')} {depth} {t('units.mm')}
        </span>
        <span className="spacer" />
        <span className="muted small">{t('app.privacy')}</span>
        <span className="muted small version">v{APP_VERSION}</span>
      </footer>

      <HelpOverlay />
      <ErrorOverlay />
      <ProgressOverlay />
      <LargeExportOverlay prompt={largeExport} />
    </div>
  );
}

function sanitise(name: string): string {
  return name.trim().replace(/[^\w-]+/g, '_').slice(0, 48) || 'project';
}
