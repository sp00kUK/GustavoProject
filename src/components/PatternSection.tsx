import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { processPattern } from '../pattern/process';
import { isAcceptedFile, loadPatternFile, MAX_SOURCE_DIMENSION } from '../pattern/loaders';
import { vectorizeWithVTracer } from '../pattern/openSourceVectorizer';
import { Section, Segmented, SliderField } from './controls';
import type { RawPattern } from '../pattern/types';

type PreviewMode = 'original' | 'processed' | 'tiled';

export function PatternSection() {
  const { t } = useI18n();
  const primaryPattern = useStore((s) => s.pattern);
  const rowPatterns = useStore((s) => s.rowPatterns);
  const operationPatterns = useStore((s) => s.operationPatterns);
  const addRowPatterns = useStore((s) => s.addRowPatterns);
  const setPatternSource = useStore((s) => s.setPatternSource);
  const setError = useStore((s) => s.setError);
  const seams = useStore((s) => s.patternSeams);
  const notice = useStore((s) => s.patternNotice);

  const [selectedArtworkId, setSelectedArtworkId] = useState<string>('primary');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('processed');
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const [vectorProgress, setVectorProgress] = useState<number | null>(null);
  const vectorAbortRef = useRef<AbortController | null>(null);

  // Combine all available artworks into a list
  const allArtworks = useMemo(() => {
    const map = new Map<string, RawPattern>();
    if (primaryPattern) map.set('primary', primaryPattern);
    for (const p of rowPatterns) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    for (const [id, p] of Object.entries(operationPatterns)) {
      if (!map.has(id)) map.set(id, p);
    }
    return Array.from(map.entries()).map(([id, pat]) => ({ id, pattern: pat }));
  }, [primaryPattern, rowPatterns, operationPatterns]);

  // Current active inspected artwork
  const currentArtwork = useMemo(() => {
    if (selectedArtworkId === 'primary') return primaryPattern;
    const found = allArtworks.find((a) => a.id === selectedArtworkId);
    return found?.pattern || primaryPattern;
  }, [selectedArtworkId, allArtworks, primaryPattern]);

  const cancelVectorizer = useCallback(() => {
    vectorAbortRef.current?.abort();
    vectorAbortRef.current = null;
    setVectorProgress(null);
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      cancelVectorizer();
      if (!isAcceptedFile(file)) {
        setError({
          title: t('error.title'),
          message: t('error.unsupportedFile', { name: file.name }),
        });
        return;
      }
      try {
        const result = await loadPatternFile(file, MAX_SOURCE_DIMENSION);
        const message = result.downsampledFrom
          ? t('warning.largeImage', {
              width: result.downsampledFrom.width,
              height: result.downsampledFrom.height,
              target: MAX_SOURCE_DIMENSION,
            })
          : null;

        // If no primary exists, set as primary; otherwise add to logo library
        if (!primaryPattern) {
          setPatternSource(result.pattern, message);
          setSelectedArtworkId('primary');
        } else {
          addRowPatterns([result.pattern]);
          setSelectedArtworkId(result.pattern.id);
        }
      } catch (error) {
        const code = (error as Error).message;
        setError({
          title: t('error.title'),
          message:
            code === 'SVG_FAILED' || code === 'SVG_UNSAFE'
              ? t('error.svgFailed')
              : t('error.decodeFailed'),
        });
      }
    },
    [cancelVectorizer, setError, setPatternSource, primaryPattern, addRowPatterns, t],
  );

  const lowResolution =
    currentArtwork !== null && Math.min(currentArtwork.width, currentArtwork.height) < 128;
  const seamWarning = seams !== null && Math.max(seams.horizontal, seams.vertical) > 0.25;

  useEffect(
    () => () => {
      vectorAbortRef.current?.abort();
    },
    [],
  );

  const runVectorizer = useCallback(async () => {
    if (!currentArtwork) return;
    cancelVectorizer();
    const controller = new AbortController();
    vectorAbortRef.current = controller;
    setVectorProgress(0.2);
    try {
      const result = await vectorizeWithVTracer(
        currentArtwork,
        'logo',
        128,
        controller.signal,
      );
      const svgFile = new File([result.svg], result.filename, { type: 'image/svg+xml' });
      const loaded = await loadPatternFile(svgFile, MAX_SOURCE_DIMENSION);
      setVectorProgress(null);
      if (selectedArtworkId === 'primary') {
        setPatternSource(loaded.pattern, t('pattern.vectorizerImported'));
      } else {
        addRowPatterns([loaded.pattern]);
        setSelectedArtworkId(loaded.pattern.id);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setVectorProgress(null);
      setError({
        title: t('error.title'),
        message: (error as Error).message || t('error.decodeFailed'),
      });
    }
  }, [cancelVectorizer, currentArtwork, selectedArtworkId, setPatternSource, addRowPatterns, setError, t]);

  return (
    <Section title={t('pattern.logosTextures')}>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {/* Upload Zone */}
      <div
        className={`dropzone ${dragging ? 'drag-over' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={t('pattern.uploadCustomPrompt')}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <p className="dropzone-prompt">{t('pattern.uploadCustomPrompt')}</p>
        <p className="dropzone-formats">{t('pattern.uploadFormatsHint')}</p>
      </div>

      {allArtworks.length > 0 && (
        <div style={{ margin: '10px 0 6px 0' }}>
          <div className="cad-form-row">
            <span className="cad-form-label" style={{ fontWeight: 600 }}>{t('pattern.activeArtwork')}</span>
            <select
              className="cad-select"
              style={{ width: '160px', fontWeight: 600 }}
              value={selectedArtworkId}
              onChange={(e) => setSelectedArtworkId(e.target.value)}
            >
              {allArtworks.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id === 'primary' ? t('pattern.primaryPrefix', { name: a.pattern.name }) : a.pattern.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {currentArtwork ? (
        <>
          <div className="asset-row" style={{ marginTop: '4px' }}>
            <span className="ellipsis" title={currentArtwork.name} style={{ fontWeight: 600 }}>
              {currentArtwork.name}
            </span>
            <span className="muted">
              {currentArtwork.width} × {currentArtwork.height} px
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '6px 0' }}>
            {vectorProgress === null ? (
              <button
                type="button"
                className="cad-btn"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => void runVectorizer()}
              >
                ✨ {t('action.vectorize')}
              </button>
            ) : (
              <button
                type="button"
                className="cad-btn"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={cancelVectorizer}
              >
                {t('action.cancel')}
              </button>
            )}
            <button
              type="button"
              className="link"
              onClick={() => {
                cancelVectorizer();
                if (selectedArtworkId === 'primary') {
                  setPatternSource(null);
                } else {
                  useStore.getState().removeRowPattern(selectedArtworkId);
                  setSelectedArtworkId('primary');
                }
              }}
            >
              {t('action.removePattern')}
            </button>
          </div>

          {vectorProgress !== null && (
            <div className="vectorizer-progress-block" style={{ margin: '6px 0' }}>
              <div
                className="progress-track"
                role="progressbar"
                aria-label={t('pattern.vectorizerProgress')}
                aria-valuenow={Math.round(vectorProgress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="progress-fill"
                  style={{ width: `${Math.max(2, vectorProgress * 100)}%` }}
                />
              </div>
            </div>
          )}

          <Segmented<PreviewMode>
            value={previewMode}
            options={[
              { value: 'original', label: t('pattern.original') },
              { value: 'processed', label: t('pattern.processed') },
              { value: 'tiled', label: t('pattern.tilePreview') },
            ]}
            onChange={setPreviewMode}
          />
          <PatternCanvas
            pattern={currentArtwork}
            artworkId={selectedArtworkId}
            mode={previewMode}
          />

          {notice && <p className="notice">{notice}</p>}
          {lowResolution && <p className="notice">{t('warning.lowRes')}</p>}
          {seamWarning && <p className="notice">{t('warning.seam')}</p>}

          <ImageAdjustments artworkId={selectedArtworkId} />
          <RowPatternsSection />
        </>
      ) : (
        <p className="muted small">{t('pattern.none')}</p>
      )}
    </Section>
  );
}

function ImageAdjustments({ artworkId }: { artworkId: string }) {
  const { t } = useI18n();
  const patternSettings = useStore((s) => s.settings.pattern);
  const updatePatternAdjustment = useStore((s) => s.updatePatternAdjustment);

  const customAdj = patternSettings.patternAdjustments?.[artworkId] || {};
  const isPrimary = artworkId === 'primary';

  const brightness = customAdj.brightness ?? (isPrimary ? patternSettings.brightness : 0);
  const contrast = customAdj.contrast ?? (isPrimary ? patternSettings.contrast : 0);
  const gamma = customAdj.gamma ?? (isPrimary ? patternSettings.gamma : 1);
  const blackPoint = customAdj.blackPoint ?? (isPrimary ? patternSettings.blackPoint : 0);
  const whitePoint = customAdj.whitePoint ?? (isPrimary ? patternSettings.whitePoint : 1);
  const blur = customAdj.blur ?? (isPrimary ? patternSettings.blur : 0);
  const quantize = customAdj.quantize ?? (isPrimary ? patternSettings.quantize : 0);
  const invert = customAdj.invert ?? (isPrimary ? patternSettings.invert : false);

  const setAdj = (patch: Record<string, any>) => {
    updatePatternAdjustment(artworkId, patch);
  };

  return (
    <Section title={t('section.adjust')} defaultOpen={false}>
      <div className="form-row" style={{ marginBottom: '8px' }}>
        <span className="form-label">{t('field.invert') || 'Invert Polarity'}</span>
        <label className="cad-switch">
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => setAdj({ invert: e.target.checked })}
          />
          <span className="cad-switch-track" />
        </label>
      </div>
      <SliderField
        label={t('field.brightness')}
        value={brightness}
        onChange={(v) => setAdj({ brightness: v })}
        min={-1}
        max={1}
        step={0.01}
      />
      <SliderField
        label={t('field.contrast')}
        value={contrast}
        onChange={(v) => setAdj({ contrast: v })}
        min={-1}
        max={1}
        step={0.01}
      />
      <SliderField
        label={t('field.gamma')}
        value={gamma}
        onChange={(v) => setAdj({ gamma: v })}
        min={0.1}
        max={4}
        step={0.05}
      />
      <SliderField
        label={t('field.blackPoint')}
        value={blackPoint}
        onChange={(v) => setAdj({ blackPoint: v })}
        min={0}
        max={0.99}
        step={0.01}
      />
      <SliderField
        label={t('field.whitePoint')}
        value={whitePoint}
        onChange={(v) => setAdj({ whitePoint: v })}
        min={0.01}
        max={1}
        step={0.01}
      />
      <SliderField
        label={t('field.blur')}
        value={blur}
        onChange={(v) => setAdj({ blur: v })}
        min={0}
        max={16}
        step={1}
        decimals={0}
        unit={t('units.px')}
      />
      <SliderField
        label={t('field.quantize')}
        value={quantize}
        onChange={(v) => setAdj({ quantize: Math.round(v) })}
        min={0}
        max={16}
        step={1}
        decimals={0}
      />
      <button
        type="button"
        className="link"
        onClick={() =>
          setAdj({
            brightness: 0,
            contrast: 0,
            gamma: 1,
            blackPoint: 0,
            whitePoint: 1,
            blur: 0,
            quantize: 0,
            invert: false,
          })
        }
      >
        {t('action.resetPattern')}
      </button>
    </Section>
  );
}

/* -------------------------------------------------------------------- *
 * Canvas previews
 * -------------------------------------------------------------------- */

const PREVIEW_SIZE = 260;

function PatternCanvas({
  pattern,
  artworkId,
  mode,
}: {
  pattern: RawPattern;
  artworkId: string;
  mode: PreviewMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const patternSettings = useStore((s) => s.settings.pattern);

  const processed = useMemo(() => {
    if (mode === 'original') return null;
    const customAdj = patternSettings.patternAdjustments?.[artworkId] || {};
    const isPrimary = artworkId === 'primary';
    const effectiveSettings = {
      ...patternSettings,
      brightness: customAdj.brightness ?? (isPrimary ? patternSettings.brightness : 0),
      contrast: customAdj.contrast ?? (isPrimary ? patternSettings.contrast : 0),
      gamma: customAdj.gamma ?? (isPrimary ? patternSettings.gamma : 1),
      blackPoint: customAdj.blackPoint ?? (isPrimary ? patternSettings.blackPoint : 0),
      whitePoint: customAdj.whitePoint ?? (isPrimary ? patternSettings.whitePoint : 1),
      blur: customAdj.blur ?? (isPrimary ? patternSettings.blur : 0),
      quantize: customAdj.quantize ?? (isPrimary ? patternSettings.quantize : 0),
      invert: customAdj.invert ?? (isPrimary ? patternSettings.invert : false),
    };
    return processPattern(pattern, effectiveSettings);
  }, [pattern, artworkId, patternSettings, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;
    ctx.imageSmoothingEnabled = false;

    const offscreen = document.createElement('canvas');
    const width = mode === 'original' ? pattern.width : (processed?.width ?? pattern.width);
    const height = mode === 'original' ? pattern.height : (processed?.height ?? pattern.height);
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    const imgData = offCtx.createImageData(width, height);
    const dst = imgData.data;

    if (mode === 'original') {
      const lum = pattern.luminance;
      const alpha = pattern.alpha;
      for (let i = 0; i < lum.length; i++) {
        const v = lum[i];
        const a = alpha ? alpha[i] : 255;
        const o = i * 4;
        dst[o] = v;
        dst[o + 1] = v;
        dst[o + 2] = v;
        dst[o + 3] = a;
      }
    } else if (processed) {
      const mask = processed.mask;
      for (let i = 0; i < mask.length; i++) {
        const v = 255 - mask[i];
        const o = i * 4;
        dst[o] = v;
        dst[o + 1] = v;
        dst[o + 2] = v;
        dst[o + 3] = 255;
      }
    }

    offCtx.putImageData(imgData, 0, 0);

    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    if (mode === 'tiled') {
      const repeats = 3;
      const step = PREVIEW_SIZE / repeats;
      for (let y = 0; y < repeats; y++) {
        for (let x = 0; x < repeats; x++) {
          ctx.drawImage(offscreen, x * step, y * step, step, step);
        }
      }
    } else {
      ctx.drawImage(offscreen, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    }
  }, [pattern, processed, mode]);

  return (
    <div className="pattern-canvas-frame" style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
      <canvas
        ref={canvasRef}
        className="pattern-canvas"
        style={{
          width: `${PREVIEW_SIZE}px`,
          height: `${PREVIEW_SIZE}px`,
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: '#0d1117',
        }}
      />
    </div>
  );
}

function RowPatternsSection() {
  const { t } = useI18n();
  const settings = useStore((s) => s.settings);
  const rows = Math.max(1, settings.pattern.rows || 1);
  const rowPatternIds = settings.pattern.rowPatternIds || [];
  const rowPatterns = useStore((s) => s.rowPatterns);
  const addRowPatterns = useStore((s) => s.addRowPatterns);
  const primaryPattern = useStore((s) => s.pattern);
  const operations = useStore((s) => s.settings.operations);
  const activeOp = operations.find((op) => op.targetPart === 'body' || op.targetPart === 'all') ?? operations[0];

  const fileRef = useRef<HTMLInputElement>(null);
  const [activeUploadRow, setActiveUploadRow] = useState<number | null>(null);

  const handleRowFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await loadPatternFile(file, MAX_SOURCE_DIMENSION);
      addRowPatterns([result.pattern]);
      if (activeUploadRow !== null) {
        if (activeOp) {
          useStore.getState().setOperationRowPattern(activeOp.id, activeUploadRow, result.pattern);
        } else {
          const next = [...rowPatternIds];
          while (next.length < rows) next.push(null);
          next[activeUploadRow] = result.pattern.id;
          useStore.getState().updatePattern({ rowPatternIds: next });
        }
      }
    } catch {
      // Ignored
    }
  };

  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const rowAdjustments = useStore((s) => s.settings.pattern.rowAdjustments) || {};
  const updateRowAdjustment = useStore((s) => s.updateRowAdjustment);

  return (
    <Section title={t('pattern.perRowSectionTitle')} defaultOpen={rows > 1}>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>
        {t('pattern.perRowSectionDesc')}
      </p>

      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(e) => {
          void handleRowFile(e);
          e.target.value = '';
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {Array.from({ length: rows }).map((_, r) => {
          const rowIdx = rows - 1 - r;
          const rowNum = rows - r;
          const assignedId = activeOp?.rowPatternIds?.[rowIdx] ?? rowPatternIds[rowIdx];
          const patternObj = rowPatterns.find((p) => p.id === assignedId);
          const displayName = patternObj?.name || (assignedId ? assignedId.replace('example:', '') : primaryPattern?.name || t('dock.defaultPattern'));
          const isExpanded = expandedRow === rowIdx;
          const adj = (activeOp?.rowAdjustments?.[rowIdx] || rowAdjustments[rowIdx]) || {};

          const rowRot = adj.rotation !== undefined ? adj.rotation : (activeOp?.rotation ?? 0);
          const rowBlur = adj.blur !== undefined ? adj.blur : (activeOp?.smoothing ?? 0);
          const rowScale = adj.scaleX !== undefined ? Math.round(adj.scaleX * 100) : 100;
          const rowOffsetU = adj.offsetX !== undefined ? Math.round(adj.offsetX * 100) : 0;
          const rowInvert = adj.invert !== undefined ? adj.invert : (activeOp?.invert ?? false);
          const rowBrightness = adj.brightness ?? 0;
          const rowContrast = adj.contrast ?? 0;
          const rowGamma = adj.gamma ?? 1;
          const rowBlackPoint = adj.blackPoint ?? 0;
          const rowWhitePoint = adj.whitePoint ?? 1;

          return (
            <div
              key={r}
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-input)',
                borderRadius: '6px',
                border: isExpanded ? '1px solid var(--blue)' : '1px solid var(--border)',
                overflow: 'hidden',
                fontSize: '11px',
              }}
            >
              {/* Row Header Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  background: isExpanded ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                }}
                onClick={() => setExpandedRow(isExpanded ? null : rowIdx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '70px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--blue)' }}>{t('dock.rowGeneric', { num: rowNum })}</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-faint)' }}>
                    {rows > 1 ? (r === 0 ? `(${t('view.top')})` : r === rows - 1 ? `(${t('view.bottom')})` : '') : ''}
                  </span>
                </div>

                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: assignedId ? 'var(--text-main)' : 'var(--text-dim)',
                    fontWeight: assignedId ? 600 : 400,
                  }}
                  title={displayName}
                >
                  {displayName}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="cad-btn-icon"
                    style={{ width: '20px', height: '20px' }}
                    title={`Upload logo for Row ${rowNum}`}
                    onClick={() => {
                      setActiveUploadRow(rowIdx);
                      fileRef.current?.click();
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </button>

                  <select
                    className="cad-select"
                    style={{ fontSize: '10px', padding: '1px 4px', height: '20px', maxWidth: '85px' }}
                    value={assignedId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const nextPattern = val ? rowPatterns.find((p) => p.id === val) ?? null : null;
                      if (activeOp) {
                        useStore.getState().setOperationRowPattern(activeOp.id, rowIdx, nextPattern);
                      } else {
                        const next = [...rowPatternIds];
                        while (next.length < rows) next.push(null);
                        next[rowIdx] = val || null;
                        useStore.getState().updatePattern({ rowPatternIds: next });
                      }
                    }}
                  >
                    <option value="">{t('dock.defaultPattern')}</option>
                    {rowPatterns.map((p) => (
                      <option key={p.id} value={p.id}>{p.name || p.id}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="cad-btn-icon"
                    style={{ width: '20px', height: '20px', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                    onClick={() => setExpandedRow(isExpanded ? null : rowIdx)}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded Per-Row Adjustments Panel */}
              {isExpanded && (
                <div style={{ padding: '8px 10px 10px 10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--blue)' }}>
                      {t('pattern.rowParamsTitle', { num: rowNum })}
                    </span>
                    <button
                      type="button"
                      className="link"
                      style={{ fontSize: '10px' }}
                      onClick={() => {
                        updateRowAdjustment(rowIdx, {
                          rotation: 0,
                          blur: 0,
                          scaleX: 1,
                          scaleY: 1,
                          offsetX: 0,
                          offsetY: 0,
                          invert: false,
                          brightness: 0,
                          contrast: 0,
                          gamma: 1,
                          blackPoint: 0,
                          whitePoint: 1,
                        });
                      }}
                    >
                      {t('pattern.resetRowBtn')}
                    </button>
                  </div>

                  {/* Invert */}
                  <div className="form-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="form-label" style={{ fontSize: '10.5px' }}>{t('pattern.invertPolarity')}</span>
                    <label className="cad-switch">
                      <input
                        type="checkbox"
                        checked={rowInvert}
                        onChange={(e) => updateRowAdjustment(rowIdx, { invert: e.target.checked })}
                      />
                      <span className="cad-switch-track" />
                    </label>
                  </div>

                  {/* Rotation */}
                  <SliderField
                    label={t('pattern.rotationDeg')}
                    value={rowRot}
                    onChange={(v) => updateRowAdjustment(rowIdx, { rotation: v })}
                    min={0}
                    max={360}
                    step={1}
                    decimals={0}
                  />

                  {/* Smoothing / Blur */}
                  <SliderField
                    label={t('pattern.smoothingBlurPx')}
                    value={rowBlur}
                    onChange={(v) => updateRowAdjustment(rowIdx, { blur: v })}
                    min={0}
                    max={20}
                    step={0.5}
                    decimals={1}
                  />

                  {/* Scale */}
                  <SliderField
                    label={t('pattern.scalePct')}
                    value={rowScale}
                    onChange={(v) => updateRowAdjustment(rowIdx, { scaleX: v / 100, scaleY: v / 100 })}
                    min={10}
                    max={300}
                    step={5}
                    decimals={0}
                  />

                  {/* Offset U */}
                  <SliderField
                    label={t('pattern.offsetUPct')}
                    value={rowOffsetU}
                    onChange={(v) => updateRowAdjustment(rowIdx, { offsetX: v / 100 })}
                    min={-100}
                    max={100}
                    step={1}
                    decimals={0}
                  />

                  {/* Image Adjustments */}
                  <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                      {t('pattern.rowImageLevels')}
                    </span>
                    <SliderField
                      label={t('dock.brightness')}
                      value={rowBrightness}
                      onChange={(v) => updateRowAdjustment(rowIdx, { brightness: v })}
                      min={-1}
                      max={1}
                      step={0.02}
                    />
                    <SliderField
                      label={t('dock.contrast')}
                      value={rowContrast}
                      onChange={(v) => updateRowAdjustment(rowIdx, { contrast: v })}
                      min={-1}
                      max={1}
                      step={0.02}
                    />
                    <SliderField
                      label={t('dock.gamma')}
                      value={rowGamma}
                      onChange={(v) => updateRowAdjustment(rowIdx, { gamma: v })}
                      min={0.1}
                      max={4}
                      step={0.05}
                    />
                    <SliderField
                      label={t('dock.blackPoint')}
                      value={rowBlackPoint}
                      onChange={(v) => updateRowAdjustment(rowIdx, { blackPoint: v })}
                      min={0}
                      max={0.99}
                      step={0.01}
                    />
                    <SliderField
                      label={t('dock.whitePoint')}
                      value={rowWhitePoint}
                      onChange={(v) => updateRowAdjustment(rowIdx, { whitePoint: v })}
                      min={0.01}
                      max={1}
                      step={0.01}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
