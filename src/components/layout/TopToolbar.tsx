import React, { useRef } from 'react';
import { useI18n, LOCALES, type Locale } from '../../i18n';
import { useStore } from '../../state/store';
import { downloadBlob, exportProjectFile, importProjectFile } from '../../state/persistence';

interface TopToolbarProps {
  onExport?: () => void;
}

export function TopToolbar({ onExport }: TopToolbarProps) {
  const { t } = useI18n();
  const name = useStore((s) => s.settings.name);
  const locale = useStore((s) => s.locale);
  const past = useStore((s) => s.past);
  const future = useStore((s) => s.future);
  const theme = useStore((s) => s.theme);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const settings = useStore.getState().settings;
    const blob = exportProjectFile(settings);
    downloadBlob(blob, `${name.trim().replace(/[^\w-]+/g, '_') || 'project'}.cpdproj`);
    useStore.getState().setLastSavedTime(new Date().toLocaleTimeString());
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = await importProjectFile(file);
      useStore.getState().replaceSettings(imported);
      useStore.getState().setLastSavedTime(new Date().toLocaleTimeString());
    } catch (err) {
      useStore.getState().setError({
        title: t('error.title') || 'Import Error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <header className="cad-header">
      {/* Left: Actions + Project + History */}
      <div className="cad-header-left">
        <button
          type="button"
          className="cad-btn"
          onClick={() => useStore.getState().newProject()}
        >
          {t('action.new') || 'New'}
        </button>

        <button
          type="button"
          className="cad-btn"
          onClick={handleSave}
        >
          {t('action.save') || 'Save'}
        </button>

        <button
          type="button"
          className="cad-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          {t('action.load') || 'Load'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".cpdproj,.cyrp,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Project Selector / Rename */}
        <div className="cad-header-project" title="Project name">
          <span className="cad-header-project-label">PROJECT</span>
          <input
            type="text"
            className="cad-header-project-input"
            value={name}
            onChange={(e) => useStore.getState().setName(e.target.value)}
            placeholder="Untitled Roller"
          />
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Undo / Redo */}
        <div className="cad-header-history">
          <button
            type="button"
            className="cad-btn-icon"
            onClick={() => useStore.getState().undo()}
            disabled={past.length === 0}
            title={`${t('action.undo') || 'Undo'} (Ctrl+Z)`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>
          <button
            type="button"
            className="cad-btn-icon"
            onClick={() => useStore.getState().redo()}
            disabled={future.length === 0}
            title={`${t('action.redo') || 'Redo'} (Ctrl+Shift+Z)`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Right: Language + Theme + Export */}
      <div className="cad-header-right">

        {/* Language dropdown */}
        <select
          className="cad-select"
          style={{ width: 'auto', padding: '4px 8px' }}
          value={locale}
          onChange={(e) => useStore.getState().setLocale(e.target.value as Locale)}
          aria-label="Language"
        >
          {LOCALES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>

        {/* Theme toggle */}
        <button
          type="button"
          className="cad-btn-icon"
          onClick={() => useStore.getState().toggleTheme()}
          title={theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </button>

        {/* Export Button */}
        <button
          type="button"
          className="cad-btn cad-btn-primary"
          style={{ gap: '6px', fontWeight: 600 }}
          onClick={() => (onExport ? onExport() : useStore.getState().setExportModalOpen(true))}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t('action.export') || 'Export'}
        </button>
      </div>
    </header>
  );
}
