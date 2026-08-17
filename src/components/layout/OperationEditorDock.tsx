import { useRef, useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useStore } from '../../state/store';
import { EXAMPLE_PATTERNS, type ExamplePattern } from '../../pattern/procedural';
import type { 
  OperationEditorTab, 
  OperationSettings, 
  OperationType, 
  ProjectionMode, 
  OperationMappingKind,
  QualityPreset
} from '../../types';

function PresetThumbnail({ pattern, size = 48 }: { pattern: ExamplePattern; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const raw = pattern.build(64);
      const imgData = ctx.createImageData(64, 64);
      for (let i = 0; i < 64 * 64; i++) {
        const lum = raw.luminance[i];
        imgData.data[i * 4] = lum;
        imgData.data[i * 4 + 1] = lum;
        imgData.data[i * 4 + 2] = lum;
        imgData.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // ignore
    }
  }, [pattern]);

  return (
    <canvas
      ref={canvasRef}
      width={64}
      height={64}
      className="cad-preset-thumb-canvas"
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

export function OperationEditorDock() {
  const { t } = useI18n();
  const operations = useStore((s) => s.settings.operations);
  const updateOperation = useStore((s) => s.updateOperation);
  const selectedOperationId = useStore((s) => s.selectedOperationId);
  const setSelectedOperationId = useStore((s) => s.setSelectedOperationId);
  const activeOperationTab = useStore((s) => s.activeOperationTab);
  const setActiveOperationTab = useStore((s) => s.setActiveOperationTab);
  const patternSettings = useStore((s) => s.settings.pattern);
  const updatePattern = useStore((s) => s.updatePattern);
  const rowPatterns = useStore((s) => s.rowPatterns);
  const operationPatterns = useStore((s) => s.operationPatterns);

  const cylinder = useStore((s) => s.settings.cylinder);
  const quality = useStore((s) => s.settings.quality);
  const updateQuality = useStore((s) => s.updateQuality);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lockRatio, setLockRatio] = useState(true);
  const [targetRowTarget, setTargetRowTarget] = useState<number | 'all'>('all');

  const presetSliderValue = {
    draft: 1,
    standard: 2,
    high: 3,
    ultra: 4,
    custom: 4,
  }[quality.export] ?? 3;

  const handleQualitySliderChange = (val: number) => {
    const presets: QualityPreset[] = ['draft', 'standard', 'high', 'ultra'];
    const p = presets[val - 1];
    if (p) {
      updateQuality({ export: p, preview: p });
    }
  };

  // Auto-select first operation if none selected
  const activeOpId = selectedOperationId ?? (operations.length > 0 ? operations[0].id : null);
  const activeOp = operations.find((op) => op.id === activeOpId) ?? operations[0];

  const handleUpdateOp = (id: string, patch: Partial<OperationSettings>) => {
    updateOperation(id, patch);
    const targetOp = operations.find((op) => op.id === id);
    if (!targetOp || targetOp.targetPart === 'body' || targetOp.targetPart === 'all') {
      if (patch.columns !== undefined) {
        useStore.getState().updatePattern({ columns: patch.columns });
      }
      if (patch.rows !== undefined) {
        useStore.getState().updatePattern({ rows: patch.rows });
      }
      if (patch.scaleX !== undefined) {
        useStore.getState().updatePattern({ scaleX: patch.scaleX, scaleY: patch.scaleX });
      }
      if (patch.offsetX !== undefined) {
        useStore.getState().updatePattern({ offsetX: patch.offsetX });
      }
      if (patch.offsetY !== undefined) {
        useStore.getState().updatePattern({ offsetY: patch.offsetY });
      }
      if (patch.depth !== undefined) {
        useStore.getState().updateRelief({ depth: patch.depth });
      }
      if (patch.type !== undefined) {
        useStore.getState().updateRelief({ direction: patch.type === 'deboss' ? 'deboss' : 'emboss' });
      }
      if (patch.invert !== undefined) {
        useStore.getState().updatePattern({ invert: patch.invert });
      }
    }
  };

  // Seamless calculation
  const circumference = Math.PI * cylinder.diameter;
  const activeCols = activeOp?.columns ?? 8;
  const isSeamlessAligned = Number.isInteger(activeCols) || Math.abs(activeCols - Math.round(activeCols)) < 1e-3;
  const seamGap = isSeamlessAligned ? 0 : (circumference / activeCols) * (activeCols - Math.floor(activeCols));

  const sizeU = (circumference / Math.max(1, activeOp?.columns || 8)) * (activeOp?.scaleX || 1);
  const sizeV = (cylinder.height / Math.max(1, activeOp?.rows || 5)) * (activeOp?.scaleY || 1);

  const handleSizeUChange = (newSizeU: number) => {
    if (!activeOp) return;
    const cols = Math.max(1, Math.round(circumference / Math.max(0.1, newSizeU)));
    handleUpdateOp(activeOp.id, { columns: cols, scaleX: 1 });
    if (lockRatio) {
      const rows = Math.max(1, Math.round(cylinder.height / Math.max(0.1, newSizeU)));
      handleUpdateOp(activeOp.id, { rows, scaleY: 1 });
    }
  };

  const handleSizeVChange = (newSizeV: number) => {
    if (!activeOp) return;
    const rows = Math.max(1, Math.round(cylinder.height / Math.max(0.1, newSizeV)));
    handleUpdateOp(activeOp.id, { rows, scaleY: 1 });
    if (lockRatio) {
      const cols = Math.max(1, Math.round(circumference / Math.max(0.1, newSizeV)));
      handleUpdateOp(activeOp.id, { columns: cols, scaleX: 1 });
    }
  };

  const tabs: Array<{ id: OperationEditorTab; label: string }> = [
    { id: 'settings', label: t('dock.tabSettings') },
    { id: 'texture', label: t('dock.tabTexture') },
    { id: 'layout', label: t('dock.tabLayout') },
  ];

  return (
    <div className="cad-bottom-dock">
      {/* Left: Operations Stack */}
      <div className="cad-dock-stack">
        <div className="cad-section-header">
          <span>{t('dock.operationsStack')}</span>
        </div>

        <div className="cad-op-list">
          {operations.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '12px 0' }}>
              {t('dock.noOperations')}
            </div>
          ) : (
            operations.map((op, idx) => {
              const isSelected = op.id === (activeOp?.id ?? activeOpId);
              const partLabel = op.targetPart === 'topRim' ? t('dock.partTopRim') : op.targetPart === 'bottomRim' ? t('dock.partBottomRim') : op.targetPart === 'handle' ? t('dock.partHandle') : op.targetPart === 'bottomLogo' ? t('dock.partLogoPlate') : op.targetPart === 'all' ? t('dock.partAll') : t('dock.partBody');
              return (
                <div
                  key={op.id}
                  className={`cad-op-item ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedOperationId(op.id)}
                >
                  <div className="cad-op-left" style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
                    <span className="cad-op-index">{idx + 1}</span>
                    <span className="cad-op-name ellipsis" title={op.name}>{op.name}</span>
                    <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(20, 120, 242, 0.15)', color: 'var(--blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {partLabel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <button
                      type="button"
                      className="cad-btn-icon"
                      style={{ width: '20px', height: '20px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateOperation(op.id, { visible: !op.visible });
                      }}
                      title={op.visible ? t('dock.hideOp') : t('dock.showOp')}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={op.visible ? 'currentColor' : 'var(--text-faint)'} strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Center/Right: Selected Operation Properties */}
      <div className="cad-dock-editor">
        {/* Tab Navigation */}
        <div className="cad-op-tabs">
          <div className="cad-op-tab-list">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`cad-op-tab-btn ${activeOperationTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveOperationTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Render Quality Slider */}
          <div className="cad-dock-quality-widget" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('dock.quality')}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--blue)', minWidth: '48px' }}>
              {(() => {
                const q = quality.export.toLowerCase();
                if (q === 'draft') return t('quality.draft');
                if (q === 'standard') return t('quality.standard');
                if (q === 'high') return t('quality.high');
                if (q === 'production') return t('quality.production');
                if (q === 'ultra') return t('quality.ultra');
                if (q === 'custom') return t('quality.custom');
                return quality.export.charAt(0).toUpperCase() + quality.export.slice(1);
              })()}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{t('dock.coarse')}</span>
              <input
                type="range"
                className="bump-range-slider"
                style={{ width: '80px', height: '4px', cursor: 'pointer' }}
                min={1}
                max={4}
                step={1}
                value={presetSliderValue}
                onChange={(e) => handleQualitySliderChange(parseInt(e.target.value))}
                title={`${t('dock.quality')} ${quality.export}`}
              />
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{t('dock.fine')}</span>
            </div>
          </div>
        </div>

        {/* Tab Body */}
        <div className="cad-op-tab-content">
          {!activeOp ? (
            <div style={{ color: 'var(--text-muted)', margin: 'auto', fontSize: '12px' }}>
              {t('dock.selectOrAddOp')}
            </div>
          ) : (
            <>
              {/* Tab 1: OPERATION SETTINGS */}
              {activeOperationTab === 'settings' && (() => {
                const isRowMode = typeof targetRowTarget === 'number';
                const rowNum = isRowMode ? activeOp.rows - (targetRowTarget as number) : 0;
                const rowAdj = isRowMode ? (activeOp?.rowAdjustments?.[targetRowTarget as number] || patternSettings.rowAdjustments?.[targetRowTarget as number] || {}) : null;

                const curRot = isRowMode ? (rowAdj?.rotation !== undefined ? rowAdj.rotation : activeOp.rotation) : activeOp.rotation;
                const curBlur = isRowMode ? (rowAdj?.blur !== undefined ? rowAdj.blur : (activeOp.smoothing ?? patternSettings.blur)) : (activeOp.smoothing ?? patternSettings.blur);
                const curInvert = isRowMode ? (rowAdj?.invert !== undefined ? rowAdj.invert : (activeOp.invert !== undefined ? activeOp.invert : patternSettings.invert)) : (activeOp.invert !== undefined ? activeOp.invert : patternSettings.invert);

                const curBrightness = isRowMode ? (rowAdj?.brightness ?? 0) : patternSettings.brightness;
                const curContrast = isRowMode ? (rowAdj?.contrast ?? 0) : patternSettings.contrast;
                const curBlackPoint = isRowMode ? (rowAdj?.blackPoint ?? 0) : patternSettings.blackPoint;
                const curWhitePoint = isRowMode ? (rowAdj?.whitePoint ?? 1) : patternSettings.whitePoint;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                    {/* Target Row Selector Bar when multiple rows exist */}
                    {(activeOp.rows || 1) > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)' }}>{t('dock.applySettingsTo')}</span>
                        <div className="cad-segmented">
                          <button
                            type="button"
                            className={`cad-segmented-btn ${targetRowTarget === 'all' ? 'active' : ''}`}
                            onClick={() => setTargetRowTarget('all')}
                          >
                            {t('dock.allRowsGlobal')}
                          </button>
                          {Array.from({ length: activeOp.rows }).map((_, r) => {
                            const totalRows = activeOp.rows;
                            const rowIdx = totalRows - 1 - r;
                            const rNum = totalRows - r;
                            return (
                              <button
                                key={r}
                                type="button"
                                className={`cad-segmented-btn ${targetRowTarget === rowIdx ? 'active' : ''}`}
                                onClick={() => setTargetRowTarget(rowIdx)}
                              >
                                {r === 0 ? t('dock.rowTop', { num: rNum }) : r === totalRows - 1 ? t('dock.rowBottom', { num: rNum }) : t('dock.rowGeneric', { num: rNum })}
                              </button>
                            );
                          })}
                        </div>
                        {isRowMode && (
                          <span className="cad-badge" style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--blue)', marginLeft: 'auto' }}>
                            {t('dock.editingRowIndependently', { num: rowNum })}
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', minWidth: '320px', width: '100%' }}>
                      <div style={{ flex: '1 1 200px' }}>
                        {/* Mapping Kind */}
                        <div className="cad-form-row">
                          <span className="cad-form-label">{t('dock.mappingMode')}</span>
                          <select
                            className="cad-select"
                            style={{ width: '190px' }}
                            value={activeOp.mappingKind || 'grid'}
                            onChange={(e) => handleUpdateOp(activeOp.id, { mappingKind: e.target.value as OperationMappingKind })}
                          >
                            <option value="grid">{t('dock.mappingGrid')}</option>
                            <option value="logo">{t('dock.mappingLogo')}</option>
                          </select>
                        </div>

                        {/* Operation Type */}
                        <div className="cad-form-row" style={{ marginTop: '6px' }}>
                          <span className="cad-form-label">{t('dock.operationType')}</span>
                          <select
                            className="cad-select"
                            style={{ width: '190px' }}
                            value={activeOp.type}
                            onChange={(e) => handleUpdateOp(activeOp.id, { type: e.target.value as OperationType })}
                          >
                            <option value="deboss">{t('dock.typeDeboss')}</option>
                            <option value="emboss">{t('dock.typeEmboss')}</option>
                            <option value="displace">{t('dock.typeDisplace')}</option>
                          </select>
                        </div>

                        {/* Projection Mode */}
                        <div className="cad-form-row" style={{ marginTop: '6px' }}>
                          <span className="cad-form-label">{t('dock.projectionMode')}</span>
                          <select
                            className="cad-select"
                            style={{ width: '190px' }}
                            value={activeOp.projectionMode}
                            onChange={(e) => updateOperation(activeOp.id, { projectionMode: e.target.value as ProjectionMode })}
                          >
                            <option value="cylindrical">{t('dock.projCylindrical')}</option>
                            <option value="triplanar">{t('dock.projTriplanar')}</option>
                            <option value="cubic">{t('dock.projCubic')}</option>
                            <option value="spherical">{t('dock.projSpherical')}</option>
                            <option value="planar_xy">{t('dock.projPlanarXY')}</option>
                            <option value="planar_xz">{t('dock.projPlanarXZ')}</option>
                            <option value="planar_yz">{t('dock.projPlanarYZ')}</option>
                          </select>
                        </div>

                        {/* Depth */}
                        <div className="bump-slider-row" style={{ marginTop: '8px' }}>
                          <div className="bump-slider-header">
                            <span className="cad-form-label">{t('dock.depthMm')}</span>
                            <input
                              type="number"
                              className="cad-input-num"
                              style={{ width: '48px' }}
                              value={activeOp.depth}
                              step={0.05}
                              min={0.05}
                              max={10}
                              onChange={(e) => handleUpdateOp(activeOp.id, { depth: parseFloat(e.target.value) || 0.5 })}
                            />
                          </div>
                          <input
                            type="range"
                            className="bump-range-slider"
                            min={0.05}
                            max={5}
                            step={0.05}
                            value={activeOp.depth}
                            onChange={(e) => handleUpdateOp(activeOp.id, { depth: parseFloat(e.target.value) || 0.5 })}
                          />
                        </div>

                        {/* Image Levels */}
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                            {isRowMode ? t('dock.rowImageLevels', { num: rowNum }) : t('dock.globalImageLevels')}
                          </span>
                          <div className="bump-slider-row">
                            <div className="bump-slider-header">
                              <span className="cad-form-label">{t('dock.brightness')}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{curBrightness.toFixed(2)}</span>
                            </div>
                            <input
                              type="range"
                              className="bump-range-slider"
                              min={-1}
                              max={1}
                              step={0.02}
                              value={curBrightness}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (isRowMode) useStore.getState().updateRowAdjustment(targetRowTarget as number, { brightness: v });
                                else useStore.getState().updatePatternAdjustment('primary', { brightness: v });
                              }}
                            />
                          </div>
                          <div className="bump-slider-row" style={{ marginTop: '6px' }}>
                            <div className="bump-slider-header">
                              <span className="cad-form-label">{t('dock.contrast')}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{curContrast.toFixed(2)}</span>
                            </div>
                            <input
                              type="range"
                              className="bump-range-slider"
                              min={-1}
                              max={1}
                              step={0.02}
                              value={curContrast}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (isRowMode) useStore.getState().updateRowAdjustment(targetRowTarget as number, { contrast: v });
                                else useStore.getState().updatePatternAdjustment('primary', { contrast: v });
                              }}
                            />
                          </div>
                          <div className="bump-slider-row" style={{ marginTop: '6px' }}>
                            <div className="bump-slider-header">
                              <span className="cad-form-label">{t('dock.blackPoint')}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{curBlackPoint.toFixed(2)}</span>
                            </div>
                            <input
                              type="range"
                              className="bump-range-slider"
                              min={0}
                              max={0.99}
                              step={0.01}
                              value={curBlackPoint}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (isRowMode) useStore.getState().updateRowAdjustment(targetRowTarget as number, { blackPoint: v });
                                else useStore.getState().updatePatternAdjustment('primary', { blackPoint: v });
                              }}
                            />
                          </div>
                          <div className="bump-slider-row" style={{ marginTop: '6px' }}>
                            <div className="bump-slider-header">
                              <span className="cad-form-label">{t('dock.whitePoint')}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{curWhitePoint.toFixed(2)}</span>
                            </div>
                            <input
                              type="range"
                              className="bump-range-slider"
                              min={0.01}
                              max={1}
                              step={0.01}
                              value={curWhitePoint}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (isRowMode) useStore.getState().updateRowAdjustment(targetRowTarget as number, { whitePoint: v });
                                else useStore.getState().updatePatternAdjustment('primary', { whitePoint: v });
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ flex: '1 1 200px' }}>
                        {/* Invert */}
                        <div className="cad-form-row">
                          <span className="cad-form-label">
                            {isRowMode ? t('dock.invertRowPolarity', { num: rowNum }) : t('dock.invertGlobalPolarity')}
                          </span>
                          <label className="cad-switch">
                            <input
                              type="checkbox"
                              checked={curInvert}
                              onChange={(e) => {
                                if (isRowMode) {
                                  useStore.getState().updateRowAdjustment(targetRowTarget as number, { invert: e.target.checked });
                                } else {
                                  handleUpdateOp(activeOp.id, { invert: e.target.checked });
                                }
                              }}
                            />
                            <span className="cad-switch-track" />
                          </label>
                        </div>

                        {/* Symmetric Displacement */}
                        <div className="cad-form-row" style={{ marginTop: '6px' }}>
                          <span className="cad-form-label" title="When on, 50% grey = no displacement; white pushes out, black pushes in.">
                            {t('dock.symmetricDisplacement')}
                          </span>
                          <label className="cad-switch">
                            <input
                              type="checkbox"
                              checked={activeOp.mirrorX}
                              onChange={(e) => handleUpdateOp(activeOp.id, { mirrorX: e.target.checked, mirrorY: e.target.checked })}
                            />
                            <span className="cad-switch-track" />
                          </label>
                        </div>

                        {/* Rotation */}
                        <div className="bump-slider-row" style={{ marginTop: '8px' }}>
                          <div className="bump-slider-header">
                            <span className="cad-form-label">
                              {isRowMode ? t('dock.rowRotationDeg', { num: rowNum }) : t('dock.rotationDeg')}
                            </span>
                            <input
                              type="number"
                              className="cad-input-num"
                              style={{ width: '48px' }}
                              value={curRot}
                              step={5}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (isRowMode) {
                                  useStore.getState().updateRowAdjustment(targetRowTarget as number, { rotation: val });
                                } else {
                                  updateOperation(activeOp.id, { rotation: val });
                                }
                              }}
                            />
                          </div>
                          <input
                            type="range"
                            className="bump-range-slider"
                            min={0}
                            max={360}
                            value={curRot}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              if (isRowMode) {
                                useStore.getState().updateRowAdjustment(targetRowTarget as number, { rotation: val });
                              } else {
                                updateOperation(activeOp.id, { rotation: val });
                              }
                            }}
                          />
                        </div>

                        {/* Texture Smoothing */}
                        <div className="bump-slider-row" style={{ marginTop: '8px' }}>
                          <div className="bump-slider-header">
                            <span className="cad-form-label" title="Gaussian blur radius applied to heightmap">
                              {isRowMode ? t('dock.rowSmoothingPx', { num: rowNum }) : t('dock.textureSmoothing')}
                            </span>
                            <input
                              type="number"
                              className="cad-input-num"
                              style={{ width: '48px' }}
                              value={curBlur}
                              min={0}
                              max={20}
                              step={0.5}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (isRowMode) {
                                  useStore.getState().updateRowAdjustment(targetRowTarget as number, { blur: val });
                                } else {
                                  handleUpdateOp(activeOp.id, { smoothing: val });
                                  updatePattern({ blur: val });
                                }
                              }}
                            />
                          </div>
                          <input
                            type="range"
                            className="bump-range-slider"
                            min={0}
                            max={20}
                            step={0.5}
                            value={curBlur}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              if (isRowMode) {
                                useStore.getState().updateRowAdjustment(targetRowTarget as number, { blur: val });
                              } else {
                                handleUpdateOp(activeOp.id, { smoothing: val });
                                updatePattern({ blur: val });
                              }
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          {isRowMode ? (
                            <button
                              type="button"
                              className="cad-btn"
                              onClick={() => {
                                useStore.getState().updateRowAdjustment(targetRowTarget as number, {
                                  rotation: 0,
                                  blur: 0,
                                  invert: false,
                                  scaleX: 1,
                                  scaleY: 1,
                                  offsetX: 0,
                                  offsetY: 0,
                                  brightness: 0,
                                  contrast: 0,
                                  gamma: 1,
                                  blackPoint: 0,
                                  whitePoint: 1,
                                });
                              }}
                            >
                              {t('dock.resetRow', { num: rowNum })}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="cad-btn"
                              onClick={() => {
                                updateOperation(activeOp.id, { rotation: 0, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, smoothing: 0 });
                                updatePattern({ blur: 0 });
                              }}
                            >
                              {t('dock.resetGlobalTransform')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tab 2: TEXTURE & PRESETS */}
              {activeOperationTab === 'texture' && (
                <div className="cad-texture-browser">
                  <div className="cad-texture-top-row">
                    {/* Upload Card */}
                    <div
                      className="cad-custom-upload-card"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="cad-custom-upload-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {t('dock.uploadCustomArtwork')}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                          {t('dock.uploadSupportedFormats')}
                        </span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".svg,.png,.jpg,.jpeg,.webp"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const { loadPatternFile } = await import('../../pattern/loaders');
                          const loaded = await loadPatternFile(file, 2048);
                          if (targetRowTarget === 'all') {
                            useStore.getState().setOperationPattern(activeOp.id, loaded.pattern);
                          } else {
                            useStore.getState().setOperationRowPattern(activeOp.id, targetRowTarget, loaded.pattern);
                          }
                        }}
                      />
                    </div>

                    {/* Active Texture Badge */}
                    <div className="cad-active-texture-badge">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>
                          {t('dock.targetBadge')} <strong style={{ color: 'var(--blue)' }}>{targetRowTarget === 'all' ? t('dock.allRowsBadge') : t('dock.rowGeneric', { num: activeOp.rows - (targetRowTarget as number) })}</strong>
                        </span>
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {activeOp.name || t('dock.defaultPattern')}
                        </span>
                      </div>
                      <span className="cad-badge" style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--blue)' }}>
                        {activeOp.type === 'deboss' ? t('dock.debossedBadge') : t('dock.embossedBadge')}
                      </span>
                    </div>
                  </div>

                  {/* Target Row Selector Bar when multiple rows exist */}
                  {(activeOp.rows || 1) > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)' }}>{t('dock.applyTextureTo')}</span>
                      <div className="cad-segmented">
                        <button
                          type="button"
                          className={`cad-segmented-btn ${targetRowTarget === 'all' ? 'active' : ''}`}
                          onClick={() => setTargetRowTarget('all')}
                        >
                          {t('dock.allRowsBadge')}
                        </button>
                        {Array.from({ length: activeOp.rows }).map((_, r) => {
                          const totalRows = activeOp.rows;
                          const rowIdx = totalRows - 1 - r;
                          const rowNum = totalRows - r;
                          return (
                            <button
                              key={r}
                              type="button"
                              className={`cad-segmented-btn ${targetRowTarget === rowIdx ? 'active' : ''}`}
                              onClick={() => setTargetRowTarget(rowIdx)}
                            >
                              {r === 0 ? t('dock.rowTop', { num: rowNum }) : r === totalRows - 1 ? t('dock.rowBottom', { num: rowNum }) : t('dock.rowGeneric', { num: rowNum })}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Preset Library Grid */}
                  <div>
                    <div className="cad-preset-library-title" style={{ marginBottom: '6px' }}>
                      <span>{t('dock.texturePresetsHeader', { target: targetRowTarget === 'all' ? t('dock.allRowsBadge') : t('dock.rowGeneric', { num: activeOp.rows - (targetRowTarget as number) }) })}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 400 }}>
                        {t('dock.presetsAvailable', { count: EXAMPLE_PATTERNS.length })}
                      </span>
                    </div>

                    <div className="cad-preset-grid-scroll">
                      {EXAMPLE_PATTERNS.map((ex) => {
                        const isPresetActive = activeOp.patternId === `example:${ex.id}` || activeOp.name.toLowerCase().includes(ex.label.toLowerCase());
                        return (
                          <div
                            key={ex.id}
                            className={`cad-preset-card ${isPresetActive ? 'active' : ''}`}
                            onClick={() => {
                              const raw = ex.build(512);
                              if (targetRowTarget === 'all') {
                                useStore.getState().setOperationPattern(activeOp.id, raw);
                                handleUpdateOp(activeOp.id, { visible: true });
                              } else {
                                useStore.getState().setOperationRowPattern(activeOp.id, targetRowTarget, raw);
                              }
                            }}
                            title={ex.description}
                          >
                            <PresetThumbnail pattern={ex} size={48} />
                            <span className="cad-preset-label">{ex.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: PATTERN LAYOUT */}
              {activeOperationTab === 'layout' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', width: '100%' }}>
                  {activeOp.mappingKind === 'logo' ? (
                    <div style={{ flex: '1 1 280px' }}>
                      <div className="cad-section-header" style={{ marginBottom: '6px' }}>{t('dock.singleLogoPlacement')}</div>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>
                        {t('dock.singleLogoDesc')}
                      </p>

                      <div className="bump-slider-row">
                        <div className="bump-slider-header">
                          <span className="cad-form-label">{t('dock.logoWidthMm')}</span>
                          <input
                            type="number"
                            className="cad-input-num"
                            value={parseFloat(sizeU.toFixed(1))}
                            min={2}
                            max={200}
                            step={1}
                            onChange={(e) => handleSizeUChange(parseFloat(e.target.value) || 30)}
                          />
                        </div>
                        <input
                          type="range"
                          className="bump-range-slider"
                          min={5}
                          max={100}
                          step={1}
                          value={Math.min(100, Math.max(5, sizeU))}
                          onChange={(e) => handleSizeUChange(parseFloat(e.target.value) || 30)}
                        />
                      </div>

                      <div className="bump-slider-row" style={{ marginTop: '6px' }}>
                        <div className="bump-slider-header">
                          <span className="cad-form-label">{t('dock.logoHeightMm')}</span>
                          <input
                            type="number"
                            className="cad-input-num"
                            value={parseFloat(sizeV.toFixed(1))}
                            min={2}
                            max={200}
                            step={1}
                            onChange={(e) => handleSizeVChange(parseFloat(e.target.value) || 30)}
                          />
                        </div>
                        <input
                          type="range"
                          className="bump-range-slider"
                          min={5}
                          max={100}
                          step={1}
                          value={Math.min(100, Math.max(5, sizeV))}
                          onChange={(e) => handleSizeVChange(parseFloat(e.target.value) || 30)}
                        />
                      </div>

                      <div className="bump-slider-row" style={{ marginTop: '6px' }}>
                        <div className="bump-slider-header">
                          <span className="cad-form-label">{t('dock.positionAroundSurface')}</span>
                          <input
                            type="number"
                            className="cad-input-num"
                            value={activeOp.offsetX}
                            min={-1}
                            max={1}
                            step={0.01}
                            onChange={(e) => handleUpdateOp(activeOp.id, { offsetX: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <input
                          type="range"
                          className="bump-range-slider"
                          min={-1}
                          max={1}
                          step={0.01}
                          value={activeOp.offsetX}
                          onChange={(e) => handleUpdateOp(activeOp.id, { offsetX: parseFloat(e.target.value) || 0 })}
                        />
                      </div>

                      <div className="bump-slider-row" style={{ marginTop: '6px' }}>
                        <div className="bump-slider-header">
                          <span className="cad-form-label">{t('dock.verticalPosition')}</span>
                          <input
                            type="number"
                            className="cad-input-num"
                            value={activeOp.offsetY}
                            min={-1}
                            max={1}
                            step={0.01}
                            onChange={(e) => handleUpdateOp(activeOp.id, { offsetY: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <input
                          type="range"
                          className="bump-range-slider"
                          min={-1}
                          max={1}
                          step={0.01}
                          value={activeOp.offsetY}
                          onChange={(e) => handleUpdateOp(activeOp.id, { offsetY: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
                      {/* Size U */}
                      <div className="bump-slider-row">
                        <div className="bump-slider-header">
                          <span className="cad-form-label" title="Physical width of one tile in mm">{t('dock.sizeUMm')}</span>
                          <input
                            type="number"
                            className="cad-input-num"
                            value={parseFloat(sizeU.toFixed(1))}
                            min={0.5}
                            max={300}
                            step={0.5}
                            onChange={(e) => handleSizeUChange(parseFloat(e.target.value) || 25)}
                          />
                        </div>
                        <input
                          type="range"
                          className="bump-range-slider"
                          min={1}
                          max={100}
                          step={0.5}
                          value={Math.min(100, Math.max(1, sizeU))}
                          onChange={(e) => handleSizeUChange(parseFloat(e.target.value) || 25)}
                        />
                      </div>

                      {/* Lock ratio */}
                      <div className="bump-lock-row">
                        <div className="bump-lock-line" />
                        <button
                          type="button"
                          className={`bump-lock-btn ${lockRatio ? 'active' : ''}`}
                          onClick={() => setLockRatio(!lockRatio)}
                          title="Proportional scaling (U = V)"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          <span>{lockRatio ? t('dock.lockedRatio') : t('dock.freeRatio')}</span>
                        </button>
                      </div>

                      {/* Size V */}
                      <div className="bump-slider-row">
                        <div className="bump-slider-header">
                          <span className="cad-form-label" title="Physical height of one tile in mm">{t('dock.sizeVMm')}</span>
                          <input
                            type="number"
                            className="cad-input-num"
                            value={parseFloat(sizeV.toFixed(1))}
                            min={0.5}
                            max={300}
                            step={0.5}
                            onChange={(e) => handleSizeVChange(parseFloat(e.target.value) || 25)}
                          />
                        </div>
                        <input
                          type="range"
                          className="bump-range-slider"
                          min={1}
                          max={100}
                          step={0.5}
                          value={Math.min(100, Math.max(1, sizeV))}
                          onChange={(e) => handleSizeVChange(parseFloat(e.target.value) || 25)}
                        />
                      </div>

                      {/* Columns & Rows */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <div className="cad-form-row" style={{ flex: 1 }}>
                          <span className="cad-form-label">{t('dock.columns')}</span>
                          <input
                            type="number"
                            className="cad-input-num"
                            value={activeOp.columns}
                            min={1}
                            max={64}
                            onChange={(e) => handleUpdateOp(activeOp.id, { columns: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="cad-form-row" style={{ flex: 1 }}>
                          <span className="cad-form-label">{t('dock.rows')}</span>
                          <input
                            type="number"
                            className="cad-input-num"
                            value={activeOp.rows}
                            min={1}
                            max={64}
                            onChange={(e) => handleUpdateOp(activeOp.id, { rows: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                      </div>

                      {/* Offset U */}
                      <div className="bump-slider-row">
                        <div className="bump-slider-header">
                          <span className="cad-form-label" title="Horizontal pattern offset / rotation (%)">{t('dock.offsetUPct')}</span>
                          <input
                            type="number"
                            className="cad-input-num"
                            value={parseFloat(((activeOp.offsetX ?? 0) * 100).toFixed(1))}
                            min={-100}
                            max={100}
                            step={1}
                            onChange={(e) => handleUpdateOp(activeOp.id, { offsetX: (parseFloat(e.target.value) || 0) / 100 })}
                          />
                        </div>
                        <input
                          type="range"
                          className="bump-range-slider"
                          min={-100}
                          max={100}
                          step={0.5}
                          value={Math.min(100, Math.max(-100, (activeOp.offsetX ?? 0) * 100))}
                          onChange={(e) => handleUpdateOp(activeOp.id, { offsetX: (parseFloat(e.target.value) || 0) / 100 })}
                        />
                      </div>

                      {/* Offset V */}
                      <div className="bump-slider-row">
                        <div className="bump-slider-header">
                          <span className="cad-form-label" title="Vertical pattern offset along height (%)">{t('dock.offsetVPct')}</span>
                          <input
                            type="number"
                            className="cad-input-num"
                            value={parseFloat(((activeOp.offsetY ?? 0) * 100).toFixed(1))}
                            min={-100}
                            max={100}
                            step={1}
                            onChange={(e) => handleUpdateOp(activeOp.id, { offsetY: (parseFloat(e.target.value) || 0) / 100 })}
                          />
                        </div>
                        <input
                          type="range"
                          className="bump-range-slider"
                          min={-100}
                          max={100}
                          step={0.5}
                          value={Math.min(100, Math.max(-100, (activeOp.offsetY ?? 0) * 100))}
                          onChange={(e) => handleUpdateOp(activeOp.id, { offsetY: (parseFloat(e.target.value) || 0) / 100 })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Seamless Wrap Box */}
                  <div className="cad-seamless-box" style={{ flex: '1 1 220px' }}>
                    <span className="cad-seamless-title">{t('dock.seamlessWrap')}</span>

                    <div className="cad-form-row">
                      <span className="cad-form-label">{t('dock.snapToSeamless')}</span>
                      <label className="cad-switch">
                        <input
                          type="checkbox"
                          checked={activeOp.snapSeamlessWrap ?? true}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (checked) {
                              handleUpdateOp(activeOp.id, { 
                                snapSeamlessWrap: checked,
                                columns: Math.max(1, Math.round(activeOp.columns)) 
                              });
                            } else {
                              handleUpdateOp(activeOp.id, { snapSeamlessWrap: checked });
                            }
                          }}
                        />
                        <span className="cad-switch-track" />
                      </label>
                    </div>

                    <div className="cad-form-row">
                      <span className="cad-form-label">{t('dock.circumference')}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text-main)' }}>
                        {circumference.toFixed(1)} mm
                      </span>
                    </div>

                    <div className="cad-form-row">
                      <span className="cad-form-label">{t('dock.repeatsCols')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          className="cad-btn-icon"
                          style={{ width: '20px', height: '20px' }}
                          onClick={() => handleUpdateOp(activeOp.id, { columns: Math.max(1, (activeOp.columns || 1) - 1) })}
                          title="Decrease columns"
                        >
                          -
                        </button>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text-main)', minWidth: '40px', textAlign: 'center' }}>
                          {t('dock.tilesCount', { count: activeOp.columns })}
                        </span>
                        <button
                          type="button"
                          className="cad-btn-icon"
                          style={{ width: '20px', height: '20px' }}
                          onClick={() => handleUpdateOp(activeOp.id, { columns: (activeOp.columns || 1) + 1 })}
                          title="Increase columns"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {isSeamlessAligned ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ok)', fontSize: '11px', marginTop: '4px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>{t('dock.seamAligned')}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warn)', fontSize: '11px', marginTop: '4px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{t('dock.seamGap', { gap: seamGap.toFixed(2) })}</span>
                      </div>
                    )}
                  </div>

                  {/* Per-Row Textures & Logos Box */}
                  <div className="cad-per-row-box" style={{ flex: '1 1 320px', minWidth: '280px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>
                        {t('dock.perRowTexturesLogos')}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--blue)', fontWeight: 600 }}>
                        {activeOp.rows === 1 ? t('dock.rowSingle') : t('dock.rowCount', { count: activeOp.rows || 1 })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      {Array.from({ length: Math.max(1, activeOp.rows || 1) }).map((_, r) => {
                        const totalRows = Math.max(1, activeOp.rows || 1);
                        // Cylinder UVs: index 0 is bottom row, index totalRows-1 is top row
                        const rowIdx = totalRows - 1 - r;
                        const rowNum = totalRows - r;
                        const assignedPatternId = activeOp.rowPatternIds?.[rowIdx];
                        const assignedPattern = assignedPatternId
                          ? (operationPatterns[assignedPatternId] || rowPatterns.find((p) => p.id === assignedPatternId))
                          : null;
                        const displayName = assignedPattern?.name || (assignedPatternId ? assignedPatternId.replace('example:', '') : `${t('dock.defaultPattern')} (${activeOp.name || t('dock.partBody')})`);

                        return (
                          <div key={r} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 8px', background: 'var(--bg-input, #1e2025)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: '80px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--blue)' }}>{t('dock.rowGeneric', { num: rowNum })}</span>
                              <span style={{ fontSize: '9px', color: 'var(--text-faint)' }}>{totalRows > 1 ? (r === 0 ? `(${t('view.top')})` : r === totalRows - 1 ? `(${t('view.bottom')})` : '') : ''}</span>
                            </div>

                            <span style={{ fontSize: '11px', color: assignedPatternId ? 'var(--text-main)' : 'var(--text-dim)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: assignedPatternId ? 600 : 400 }} title={displayName}>
                              {displayName}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {/* Upload custom logo / image for this row */}
                              <label className="cad-btn-icon" style={{ width: '22px', height: '22px', cursor: 'pointer' }} title={`Upload logo/image for Row ${rowNum}`}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="17 8 12 3 7 8" />
                                  <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                <input
                                  type="file"
                                  accept=".svg,.png,.jpg,.jpeg,.webp"
                                  style={{ display: 'none' }}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const { loadPatternFile } = await import('../../pattern/loaders');
                                    const loaded = await loadPatternFile(file, 2048);
                                    useStore.getState().setOperationRowPattern(activeOp.id, rowIdx, loaded.pattern);
                                  }}
                                />
                              </label>

                              {/* Preset / Uploaded selector */}
                              <select
                                className="cad-select"
                                style={{ fontSize: '10px', padding: '2px 4px', height: '22px', maxWidth: '95px' }}
                                value={assignedPatternId || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val) {
                                    useStore.getState().setOperationRowPattern(activeOp.id, rowIdx, null);
                                  } else if (val.startsWith('example:')) {
                                    const ex = EXAMPLE_PATTERNS.find((p) => `example:${p.id}` === val);
                                    if (ex) {
                                      const raw = ex.build(512);
                                      useStore.getState().setOperationRowPattern(activeOp.id, rowIdx, raw);
                                    }
                                  } else {
                                    const p = rowPatterns.find((pattern) => pattern.id === val) || operationPatterns[val];
                                    if (p) {
                                      useStore.getState().setOperationRowPattern(activeOp.id, rowIdx, p);
                                    }
                                  }
                                }}
                              >
                                <option value="">{t('dock.defaultPattern')}</option>
                                {rowPatterns.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name || p.id}</option>
                                ))}
                                <optgroup label="Presets">
                                  {EXAMPLE_PATTERNS.map((ex) => (
                                    <option key={ex.id} value={`example:${ex.id}`}>{ex.label}</option>
                                  ))}
                                </optgroup>
                              </select>

                              {assignedPatternId && (
                                <button
                                  type="button"
                                  className="cad-btn-icon"
                                  style={{ width: '20px', height: '20px', color: 'var(--text-dim)' }}
                                  onClick={() => useStore.getState().setOperationRowPattern(activeOp.id, rowIdx, null)}
                                  title={t('dock.resetToDefaultPattern')}
                                >
                                  ✕
                                </button>
                              )}

                              <button
                                type="button"
                                className="cad-btn-icon"
                                style={{ width: '20px', height: '20px', color: 'var(--blue)' }}
                                onClick={() => {
                                  setTargetRowTarget(rowIdx);
                                  setActiveOperationTab('settings');
                                }}
                                title={t('dock.editRowParams', { num: rowNum })}
                              >
                                ⚙
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
}
