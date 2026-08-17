import React from 'react';
import { useI18n } from '../../i18n';
import { useStore } from '../../state/store';
import type { ViewportTool } from '../../types';
import type { CameraView } from '../../viewport/Viewport';

interface ViewportOverlayControlsProps {
  onSetCameraView?: (view: CameraView) => void;
  onFit?: () => void;
}

export function ViewportOverlayControls({ onSetCameraView }: ViewportOverlayControlsProps) {
  const { t } = useI18n();
  const activeViewportTool = useStore((s) => s.activeViewportTool);
  const setActiveViewportTool = useStore((s) => s.setActiveViewportTool);
  const selectionMode = useStore((s) => s.selectionMode);
  const setSelectionMode = useStore((s) => s.setSelectionMode);
  const brushRadius = useStore((s) => s.brushRadius);
  const setBrushRadius = useStore((s) => s.setBrushRadius);
  const brushIsRadius = useStore((s) => s.brushIsRadius);
  const setBrushIsRadius = useStore((s) => s.setBrushIsRadius);
  const bucketThreshold = useStore((s) => s.bucketThreshold);
  const setBucketThreshold = useStore((s) => s.setBucketThreshold);
  const excludedFaces = useStore((s) => s.excludedFaces);
  const clearExcludedFaces = useStore((s) => s.clearExcludedFaces);
  
  const selectedOperationId = useStore((s) => s.selectedOperationId);

  const status = useStore((s) => s.status);
  const stage = useStore((s) => s.stage);
  const progress = useStore((s) => s.progress);

  const isMaskTool = activeViewportTool === 'brush' || activeViewportTool === 'erase' || activeViewportTool === 'bucket';

  const contextualTools: Array<{ id: ViewportTool; label: string; icon: React.ReactNode }> = [
    {
      id: 'select',
      label: t('tool.select') || 'Select',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3l7 18 3-7 7-3L3 3z" />
        </svg>
      ),
    },
    {
      id: 'brush',
      label: t('tool.brush') || 'Brush',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 2l4 4-10 10H8v-4L18 2z" />
        </svg>
      ),
    },
    {
      id: 'bucket',
      label: t('tool.bucket') || 'Bucket',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 11l-8-8-8 8 8 8 8-8z" />
          <path d="M22 22l-4-4" />
        </svg>
      ),
    },
    {
      id: 'erase',
      label: t('tool.erase') || 'Erase',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L18 15" />
        </svg>
      ),
    },
  ];

  return (
    <>

      {/* 2. Interactive ViewCube in top-right */}
      <div className="cad-viewcube" title={t('cube.title')}>
        <div className="cad-cube-stage">
          <div className="cad-cube-face cad-cube-front" onClick={() => onSetCameraView?.('front')}>{t('cube.front')}</div>
          <div className="cad-cube-face cad-cube-right" onClick={() => onSetCameraView?.('right')}>{t('cube.right')}</div>
          <div className="cad-cube-face cad-cube-back" onClick={() => onSetCameraView?.('back')}>{t('cube.back')}</div>
          <div className="cad-cube-face cad-cube-left" onClick={() => onSetCameraView?.('left')}>{t('cube.left')}</div>
          <div className="cad-cube-face cad-cube-top" onClick={() => onSetCameraView?.('top')}>{t('cube.top')}</div>
          <div className="cad-cube-face cad-cube-bottom" onClick={() => onSetCameraView?.('bottom')}>{t('cube.bottom')}</div>
        </div>
      </div>

      {/* 3. Left Tool Palette Popover */}
      <div className="cad-vp-tool-popover">
        {contextualTools.map((t) => {
          const isSelected = activeViewportTool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-tool={t.id}
              className={`cad-vp-tool-btn ${isSelected ? 'active' : ''}`}
              onClick={() => setActiveViewportTool(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>


      {/* Mask Settings Popover */}
      {isMaskTool && (
        <div className="cad-vp-mask-panel">
          <div className="cad-vp-mask-title">Mask Settings</div>
          
          <div className="cad-form-row">
            <span className="cad-form-label" style={{ fontSize: '11px' }}>Mask Mode</span>
            <select 
              className="cad-select" 
              style={{ width: '100px', fontSize: '11px', padding: '2px 4px' }}
              value={selectionMode ? 'include' : 'exclude'}
              onChange={(e) => setSelectionMode(e.target.value === 'include')}
            >
              <option value="exclude">Exclude Selected</option>
              <option value="include">Include Only</option>
            </select>
          </div>
          
          <div className="cad-form-row" style={{ marginTop: '6px' }}>
            <span className="cad-form-label" style={{ fontSize: '11px' }}>Max Angle</span>
            <input 
              type="number" 
              className="cad-input-num" 
              style={{ width: '50px', fontSize: '11px', padding: '2px 4px' }}
              value={bucketThreshold} 
              onChange={(e) => setBucketThreshold(parseFloat(e.target.value) || 20)}
              min={1} 
              max={180} 
            />
          </div>
          
          <div className="cad-form-row" style={{ marginTop: '6px' }}>
            <span className="cad-form-label" style={{ fontSize: '11px' }}>Brush Mode</span>
            <select 
              className="cad-select" 
              style={{ width: '100px', fontSize: '11px', padding: '2px 4px' }}
              value={brushIsRadius ? 'radius' : 'single'}
              onChange={(e) => setBrushIsRadius(e.target.value === 'radius')}
            >
              <option value="single">Single Face</option>
              <option value="radius">Radius Area</option>
            </select>
          </div>
          
          {brushIsRadius && (
            <div className="cad-form-row" style={{ marginTop: '6px' }}>
              <span className="cad-form-label" style={{ fontSize: '11px' }}>Radius (mm)</span>
              <input 
                type="number" 
                className="cad-input-num" 
                style={{ width: '50px', fontSize: '11px', padding: '2px 4px' }}
                value={brushRadius} 
                onChange={(e) => setBrushRadius(parseFloat(e.target.value) || 15)}
                min={1} 
                max={100} 
              />
            </div>
          )}
          
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
              {excludedFaces.size} faces
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="cad-btn"
                style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--bg-panel)' }}
                onClick={() => {
                  const mesh = useStore.getState().preview?.mesh;
                  const triCount = mesh ? (mesh.indices ? mesh.indices.length / 3 : mesh.positions.length / 9) : 0;
                  if (triCount > 0) {
                    useStore.getState().invertExcludedFaces(triCount);
                  }
                }}
              >
                Invert
              </button>
              <button
                type="button"
                className="cad-btn"
                style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--bg-panel)', color: 'var(--warn)', borderColor: 'var(--warn)' }}
                onClick={() => {
                  clearExcludedFaces();
                  if (selectedOperationId) {
                    useStore.getState().updateOperation(selectedOperationId, { maskId: null });
                  }
                }}
                disabled={excludedFaces.size === 0}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Bottom-Left Scale Bar */}
      <div className="cad-vp-scale-bar">
        <span className="cad-scale-text">50 mm</span>
        <div className="cad-scale-line" />
      </div>

      {/* Floating Circular Progress Indicator */}
      {(status === 'generating' || status === 'exporting') && (
        <div className="cad-vp-progress-panel">
          <div className="cad-vp-spinner-wrapper">
            <svg className="cad-vp-spinner-svg" width="34" height="34" viewBox="0 0 34 34">
              <circle
                className="cad-vp-spinner-track"
                cx="17"
                cy="17"
                r="13"
                fill="none"
                strokeWidth="2.8"
              />
              <circle
                className="cad-vp-spinner-arc"
                cx="17"
                cy="17"
                r="13"
                fill="none"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeDasharray={81.68}
                strokeDashoffset={81.68 * (1 - Math.max(0.04, Math.min(1, progress)))}
                transform="rotate(-90 17 17)"
              />
            </svg>
          </div>
          <div className="cad-vp-spinner-info">
            <span className="cad-vp-spinner-stage">
              {(() => {
                if (status === 'exporting') return t('stage.exporting');
                const s = (stage || '').toLowerCase();
                if (s === 'pattern' || s.includes('pattern')) return t('stage.pattern');
                if (s === 'surface' || s.includes('surface') || s.includes('topology')) return t('stage.surface');
                if (s === 'caps' || s.includes('cap')) return t('stage.caps');
                if (s === 'cleanup' || s.includes('clean')) return t('stage.cleanup');
                if (s === 'validation' || s.includes('validat')) return t('stage.validation');
                if (s === 'subdividing' || s.includes('subdivid')) return t('stage.subdividing');
                if (s === 'displacing' || s.includes('displac')) return t('stage.displacing');
                if (s === 'decimating' || s.includes('decimat')) return t('stage.decimating');
                if (s === 'writing' || s.includes('writ')) return t('stage.writing');
                if (s.startsWith('operation')) {
                  const num = s.replace(/[^0-9]/g, '');
                  return `${t('dock.operationType')} ${num}`.trim();
                }
                return stage || t('stage.generating');
              })()}
            </span>
            <span className="cad-vp-spinner-pct">{Math.round(progress * 100)}%</span>
          </div>
        </div>
      )}
    </>
  );
}
