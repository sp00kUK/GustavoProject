import React, { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { estimateTriangles, resolveResolution, spacingForPreset } from '../geometry/quality';
import { downloadBlob } from '../state/persistence';
import { buildFilename } from '../exporters/types';
import type { QualityPreset } from '../types';

interface ExportModalProps {
  onClose: () => void;
}

export function ExportModal({ onClose }: ExportModalProps) {
  const { t } = useI18n();
  const settings = useStore((s) => s.settings);
  const updateExport = useStore((s) => s.updateExport);
  const updateQuality = useStore((s) => s.updateQuality);
  const progress = useStore((s) => s.progress);
  const stage = useStore((s) => s.stage);

  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const quality = settings.quality;
  const exportSettings = settings.export;
  const cylinder = settings.cylinder;

  // Effective spacing
  const currentSpacing = spacingForPreset(quality.export, quality.customSpacing);

  // Compute live resolution & estimated triangle counts
  const resolution = useMemo(() => {
    return resolveResolution(cylinder.diameter, cylinder.height, currentSpacing);
  }, [cylinder.diameter, cylinder.height, currentSpacing]);

  const estimatedTriangles = useMemo(() => {
    return estimateTriangles(
      resolution.radialSegments,
      resolution.verticalSegments,
      settings.pattern.mode,
    );
  }, [resolution, settings.pattern.mode]);

  const triangleDisplay = useMemo(() => {
    if (estimatedTriangles >= 1_000_000) {
      return `${(estimatedTriangles / 1_000_000).toFixed(1)} M`;
    }
    if (estimatedTriangles >= 1_000) {
      return `${(estimatedTriangles / 1_000).toFixed(0)} k`;
    }
    return `${estimatedTriangles}`;
  }, [estimatedTriangles]);

  const estFileSizeMb = useMemo(() => {
    // Binary STL is 50 bytes per triangle, 3MF is ~15-20 bytes per triangle compressed
    const bytes = exportSettings.format === '3mf' 
      ? estimatedTriangles * 18 
      : estimatedTriangles * 50;
    return (bytes / (1024 * 1024)).toFixed(1);
  }, [estimatedTriangles, exportSettings.format]);

  // Slider value maps inversely (coarse 0.5mm -> fine 0.08mm)
  // Slider position 0 (coarse, 0.50mm) to 100 (fine, 0.08mm)
  const sliderValue = useMemo(() => {
    const minSpacing = 0.08;
    const maxSpacing = 0.50;
    const clamped = Math.min(maxSpacing, Math.max(minSpacing, currentSpacing));
    return Math.round(((maxSpacing - clamped) / (maxSpacing - minSpacing)) * 100);
  }, [currentSpacing]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const minSpacing = 0.08;
    const maxSpacing = 0.50;
    const newSpacing = parseFloat((maxSpacing - (val / 100) * (maxSpacing - minSpacing)).toFixed(2));
    
    // Check if it matches a preset
    if (Math.abs(newSpacing - 0.50) < 0.02) {
      updateQuality({ export: 'draft' });
    } else if (Math.abs(newSpacing - 0.35) < 0.02) {
      updateQuality({ export: 'standard' });
    } else if (Math.abs(newSpacing - 0.25) < 0.02) {
      updateQuality({ export: 'high' });
    } else if (Math.abs(newSpacing - 0.15) < 0.02) {
      updateQuality({ export: 'ultra' });
    } else {
      updateQuality({ export: 'custom', customSpacing: newSpacing });
    }
  };

  const handlePresetSelect = (preset: QualityPreset) => {
    updateQuality({ export: preset });
  };

  const handleRunExport = async () => {
    setIsExporting(true);
    setErrorMsg(null);
    try {
      const filename = buildFilename(settings, exportSettings.format);
      const result = await useStore.getState().runExport(filename);
      if (result) {
        downloadBlob(result.blob, result.filename);
        setTimeout(() => {
          setIsExporting(false);
          onClose();
        }, 500);
      }
    } catch (err) {
      setIsExporting(false);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="cad-modal-backdrop" onClick={onClose}>
      <div 
        className="cad-export-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className="cad-export-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="cad-export-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <h2 id="export-modal-title" className="cad-export-title">{t('export.modalTitle')}</h2>
              <p className="cad-export-subtitle">{t('export.modalSubtitle')}</p>
            </div>
          </div>
          <button 
            type="button" 
            className="cad-btn-icon" 
            onClick={onClose} 
            title={t('action.close')}
            style={{ width: '28px', height: '28px' }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="cad-export-body">
          {/* Left Column: Quality Preset and Resolution */}
          <div className="cad-export-col">
            <div className="cad-export-card">
              <div className="cad-section-header" style={{ marginBottom: '10px' }}>{t('export.qualityPreset').toUpperCase()}</div>
              
              <div className="cad-form-row">
                <select
                  className="cad-select"
                  style={{ width: '100%', fontSize: '13px', padding: '6px 10px', fontWeight: 600 }}
                  value={quality.export}
                  onChange={(e) => handlePresetSelect(e.target.value as QualityPreset)}
                >
                  <option value="draft">{t('export.presetDraft')}</option>
                  <option value="standard">{t('export.presetStandard')}</option>
                  <option value="high">{t('export.presetHigh')}</option>
                  <option value="ultra">{t('export.presetUltra')}</option>
                  <option value="custom">{t('export.presetCustom')}</option>
                </select>
              </div>

              {/* Resolution Metrics */}
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>{t('export.targetResolution')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--blue)' }}>
                    {currentSpacing.toFixed(2)} mm
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>{t('export.estimatedTriangles')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>
                    {triangleDisplay}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>{t('export.estimatedFileSize')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                    ~{estFileSizeMb} MB
                  </span>
                </div>
              </div>

              {/* Coarse to Fine Gradient Slider */}
              <div style={{ marginTop: '14px' }}>
                <input
                  type="range"
                  className="bump-range-slider"
                  style={{ width: '100%', height: '6px' }}
                  min={0}
                  max={100}
                  value={sliderValue}
                  onChange={handleSliderChange}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>{t('export.coarse')}</span>
                  <span>{t('export.fine')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Format */}
          <div className="cad-export-col">
            {/* File Format */}
            <div className="cad-export-card">
              <div className="cad-section-header" style={{ marginBottom: '10px' }}>{t('export.exportFormat').toUpperCase()}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flex: 1 }}>
                <button
                  type="button"
                  className={`cad-format-card ${exportSettings.format === '3mf' ? 'active' : ''}`}
                  onClick={() => updateExport({ format: '3mf' })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '8px' }}>
                    <span className="cad-format-name" style={{ margin: 0 }}>3MF (.3mf)</span>
                    <span className="cad-format-badge-inline">{t('export.recommended')}</span>
                  </div>
                  <div className="cad-format-desc">{t('export.format3mfDesc')}</div>
                </button>

                <button
                  type="button"
                  className={`cad-format-card ${exportSettings.format === 'stl' ? 'active' : ''}`}
                  onClick={() => updateExport({ format: 'stl' })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '8px' }}>
                    <span className="cad-format-name" style={{ margin: 0 }}>STL (.stl)</span>
                  </div>
                  <div className="cad-format-desc">{t('export.formatStlDesc')}</div>
                </button>
              </div>

              {/* Error message */}
              {errorMsg && (
                <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)', fontSize: '12px' }}>
                  {errorMsg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="cad-export-footer">
          {isExporting ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>{t('export.generatingProgress', { stage: stage || 'surface' })}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(progress * 100)}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-active)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--blue)', transition: 'width 0.2s' }} />
                </div>
              </div>
            </div>
          ) : (
            <>
              <button type="button" className="cad-btn" onClick={onClose} style={{ padding: '7px 16px' }}>
                {t('export.cancel')}
              </button>
              <button 
                type="button" 
                className="cad-btn cad-btn-primary" 
                style={{ padding: '7px 24px', fontWeight: 600, fontSize: '13px', gap: '6px' }}
                onClick={handleRunExport}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {t('export.exportNow', { format: exportSettings.format.toUpperCase() })}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
