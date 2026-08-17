import React, { useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { useStore } from '../../state/store';
import { PatternSection } from '../PatternSection';
import { DIMENSION_PRESETS } from '../../state/defaults';

export function ContextInspector() {
  const { t } = useI18n();
  const activeNavTab = useStore((s) => s.activeNavTab);
  const settings = useStore((s) => s.settings);
  const replaceSettings = useStore((s) => s.replaceSettings);
  const baseMesh = useStore((s) => s.settings.baseMesh);
  const cylinder = useStore((s) => s.settings.cylinder);
  const updateCylinder = useStore((s) => s.updateCylinder);
  const updateBaseMesh = useStore((s) => s.updateBaseMesh);

  const [lockAspect, setLockAspect] = useState(false);
  const [customChosen, setCustomChosen] = useState(false);

  const importFileRef = useRef<HTMLInputElement>(null);

  const activePreset = customChosen
    ? 'custom'
    : (DIMENSION_PRESETS.find(
        (p) =>
          Math.abs(p.cylinder.diameter - cylinder.diameter) < 0.01 &&
          Math.abs(p.cylinder.height - cylinder.height) < 0.01,
      )?.id ?? 'custom');

  // Derived wall thickness: (diameter - boreDiameter) / 2
  const wallThickness = cylinder.boreEnabled
    ? Math.max(0, (cylinder.diameter - cylinder.boreDiameter) / 2)
    : cylinder.diameter / 2;

  const handleModeChange = (type: 'cylinder' | 'imported') => {
    if (type === 'cylinder') {
      updateBaseMesh({ type: 'cylinder', ...cylinder });
    } else {
      importFileRef.current?.click();
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { parseMeshFile } = await import('../../geometry/mesh/importEngine');
      const imported = await parseMeshFile(file);
      const { saveImportedMesh } = await import('../../state/persistence');
      const meshId = crypto.randomUUID();
      await saveImportedMesh(meshId, imported);
      useStore.getState().importMesh(meshId, file.name);
    } catch (err) {
      useStore.getState().setError({
        title: t('error.title') || 'Mesh Import Failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const selectedOperationId = useStore((s) => s.selectedOperationId);
  const operations = useStore((s) => s.settings.operations);
  const activeOp = operations.find((o) => o.id === selectedOperationId);

  // Sync mask from indexedDB when changing active operations
  React.useEffect(() => {
    if (!activeOp?.maskId) {
      return;
    }
    
    let cancelled = false;
    import('../../state/persistence').then(({ loadMask }) => {
      loadMask(activeOp.maskId!).then((maskArray) => {
        if (cancelled || !maskArray) return;
        const set = new Set<number>();
        for (let i = 0; i < maskArray.length; i++) {
          if (maskArray[i]) set.add(i);
        }
        useStore.getState().setExcludedFaces(set);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [activeOp?.maskId]);

  /* Render content according to activeNavTab */
  if (activeNavTab === 'pattern') {
    return (
      <aside className="cad-context-panel" aria-label={t('nav.pattern')}>
        <PatternSection />
      </aside>
    );
  }

  if (activeNavTab === 'export') {
    return (
      <aside className="cad-context-panel" aria-label={t('nav.export')}>
        <div className="cad-panel-section">
          <div className="cad-section-header">{t('model.exportSectionHeader')}</div>
          <p style={{ color: 'var(--text-dim)', fontSize: '12px', lineHeight: '1.4', marginBottom: '12px' }}>
            {t('model.exportSectionDesc')}
          </p>
          <button
            type="button"
            className="cad-btn cad-btn-primary"
            style={{ width: '100%', padding: '8px 12px', fontWeight: 600 }}
            onClick={() => useStore.getState().setExportModalOpen(true)}
          >
            {t('model.openExportBtn')}
          </button>
        </div>
      </aside>
    );
  }

  // Default: Project & Model Inspector
  return (
    <aside className="cad-context-panel" aria-label={t('model.title')}>
      {/* 1. Model Header Mode */}
      <div className="cad-panel-section">
        <div className="cad-section-header">{t('model.title')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            type="button"
            className={`cad-btn ${baseMesh.type === 'cylinder' ? 'cad-btn-primary' : ''}`}
            onClick={() => handleModeChange('cylinder')}
          >
            {t('model.generateCylinder')}
          </button>
          <button
            type="button"
            className={`cad-btn ${baseMesh.type === 'imported' ? 'cad-btn-primary' : ''}`}
            onClick={() => handleModeChange('imported')}
          >
            {t('model.importModel')}
          </button>
        </div>
        <input
          ref={importFileRef}
          type="file"
          accept=".stl,.obj,.3mf"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
        {baseMesh.type === 'imported' && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-dim)' }}>
            {t('model.importedPrefix', { name: baseMesh.filename })}
          </div>
        )}
      </div>

      {/* 2. Cylinder Parameters */}
      <div className="cad-panel-section">
        <div className="cad-section-header">{t('model.cylinderParams')}</div>

        {/* Preset Selector */}
        <div className="cad-form-row" style={{ marginBottom: '8px' }}>
          <span className="cad-form-label">{t('model.preset')}</span>
          <select
            className="cad-select"
            value={activePreset}
            onChange={(e) => {
              const id = e.target.value;
              if (id === 'custom') {
                setCustomChosen(true);
                return;
              }
              setCustomChosen(false);
              const preset = DIMENSION_PRESETS.find((p) => p.id === id);
              if (preset) {
                replaceSettings({
                  ...settings,
                  baseMesh: { type: 'cylinder', ...preset.cylinder },
                  cylinder: { ...preset.cylinder },
                  assembly: preset.assembly
                    ? { ...settings.assembly, ...preset.assembly }
                    : settings.assembly,
                });
              }
            }}
          >
            <option value="custom">{t('preset.customLabel')}</option>
            <option value="mold600ml">600 ml mold assembly (95 × 105 mm)</option>
            <option value="mold1l">1 L mold assembly (112.74 × 126.73 mm)</option>
          </select>
        </div>

        {/* Custom Parameters (Only visible when Custom preset is selected) */}
        {activePreset === 'custom' && (
          <>
            {/* Diameter */}
            <div className="cad-form-row">
              <span className="cad-form-label">{t('model.diameter')}</span>
              <div className="cad-input-group">
                <input
                  type="number"
                  className="cad-input-num"
                  value={cylinder.diameter}
                  step={0.5}
                  min={1}
                  max={1000}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 1;
                    updateCylinder({ diameter: val });
                    updateBaseMesh({ diameter: val } as any);
                  }}
                />
                <button
                  type="button"
                  className={`cad-btn-icon ${lockAspect ? 'active' : ''}`}
                  title={t('model.lockAspect')}
                  onClick={() => setLockAspect(!lockAspect)}
                  style={{ width: '22px', height: '22px' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Height */}
            <div className="cad-form-row">
              <span className="cad-form-label">{t('model.height')}</span>
              <div className="cad-input-group">
                <input
                  type="number"
                  className="cad-input-num"
                  value={cylinder.height}
                  step={0.5}
                  min={1}
                  max={1000}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 1;
                    updateCylinder({ height: val });
                    updateBaseMesh({ height: val } as any);
                  }}
                />
              </div>
            </div>

            {/* Bore Diameter */}
            <div className="cad-form-row">
              <span className="cad-form-label">{t('model.boreDiameter')}</span>
              <div className="cad-input-group">
                <input
                  type="number"
                  className="cad-input-num"
                  value={cylinder.boreDiameter}
                  step={0.5}
                  min={0}
                  max={Math.max(1, cylinder.diameter - 1)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    updateCylinder({ boreDiameter: val, boreEnabled: val > 0 });
                    updateBaseMesh({ boreDiameter: val, boreEnabled: val > 0 } as any);
                  }}
                />
              </div>
            </div>

            {/* Wall Thickness */}
            <div className="cad-form-row">
              <span className="cad-form-label">{t('model.wallThickness')}</span>
              <div className="cad-input-group">
                <input
                  type="number"
                  className="cad-input-num"
                  value={parseFloat(wallThickness.toFixed(2))}
                  step={0.5}
                  min={0.5}
                  onChange={(e) => {
                    const wall = parseFloat(e.target.value) || 1;
                    const bore = Math.max(0, cylinder.diameter - wall * 2);
                    updateCylinder({ boreDiameter: bore, boreEnabled: bore > 0 });
                    updateBaseMesh({ boreDiameter: bore, boreEnabled: bore > 0 } as any);
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
