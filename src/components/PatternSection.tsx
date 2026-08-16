import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { EXAMPLE_PATTERNS } from '../pattern/procedural';
import { processPattern } from '../pattern/process';
import { isAcceptedFile, loadPatternFile, MAX_SOURCE_DIMENSION } from '../pattern/loaders';
import {
  cancelVectorMagicSession,
  getVectorMagicResult,
  startVectorMagicDesktop,
  type VectorMagicAutomationState,
} from '../pattern/vectorMagicDesktop';
import { summarise } from '../geometry/constraints';
import { tileSizeMm } from '../pattern/sampler';
import { NumberField, Section, Segmented, SliderField, Toggle } from './controls';
import type { RawPattern } from '../pattern/types';

type PreviewMode = 'original' | 'processed' | 'tiled';

export function PatternSection() {
  const { t, n } = useI18n();
  const pattern = useStore((s) => s.pattern);
  const settings = useStore((s) => s.settings);
  const patternSettings = settings.pattern;
  const update = useStore((s) => s.updatePattern);
  const setPatternSource = useStore((s) => s.setPatternSource);
  const setError = useStore((s) => s.setError);
  const seams = useStore((s) => s.patternSeams);
  const notice = useStore((s) => s.patternNotice);

  const [previewMode, setPreviewMode] = useState<PreviewMode>('processed');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [vmProgress, setVmProgress] = useState<number | null>(null);
  const [vmStage, setVmStage] = useState<VectorMagicAutomationState | null>(null);
  const [vmStatus, setVmStatus] = useState<string | null>(null);
  const vmAbortRef = useRef<AbortController | null>(null);
  const vmSessionRef = useRef<string | null>(null);

  const cancelVectorMagic = useCallback(() => {
    const sessionId = vmSessionRef.current;
    vmSessionRef.current = null;
    if (sessionId) {
      void cancelVectorMagicSession(sessionId).catch(() => {
        // The helper may already have completed and closed between UI events.
      });
    }
    vmAbortRef.current?.abort();
    vmAbortRef.current = null;
    setVmProgress(null);
    setVmStage(null);
    setVmStatus(null);
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      cancelVectorMagic();
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
        setPatternSource(result.pattern, message);
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
    [cancelVectorMagic, setError, setPatternSource, t],
  );

  const summary = summarise(settings.cylinder, settings.relief);
  const tile = tileSizeMm(
    summary.circumference,
    summary.usableHeight,
    patternSettings.columns,
    patternSettings.rows,
  );

  const lowResolution =
    pattern !== null && Math.min(pattern.width, pattern.height) < 128;
  const seamWarning = seams !== null && Math.max(seams.horizontal, seams.vertical) > 0.25;

  useEffect(
    () => () => {
      vmAbortRef.current?.abort();
      const sessionId = vmSessionRef.current;
      if (sessionId) void cancelVectorMagicSession(sessionId).catch(() => undefined);
    },
    [],
  );

  const openInVectorMagic = useCallback(async () => {
    if (!pattern) return;
    cancelVectorMagic();
    const controller = new AbortController();
    vmAbortRef.current = controller;
    setVmProgress(0.01);
    setVmStage('launching');
    setVmStatus(null);
    try {
      const session = await startVectorMagicDesktop(pattern, controller.signal);
      vmSessionRef.current = session.sessionId;

      while (!controller.signal.aborted) {
        const result = await getVectorMagicResult(session.sessionId, controller.signal);
        setVmProgress(result.progress);
        setVmStage(result.state);
        if (!result.ready) {
          await abortableDelay(250, controller.signal);
          continue;
        }

        const file = new File([result.svg], result.filename, {
          type: 'image/svg+xml',
          lastModified: Date.now(),
        });
        const loaded = await loadPatternFile(file, MAX_SOURCE_DIMENSION);
        if (controller.signal.aborted) return;
        setPatternSource(loaded.pattern, t('pattern.vectorMagicImported'));
        setPreviewMode('processed');
        setVmStatus(t('pattern.vectorMagicImported'));
        return;
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const code = error instanceof Error ? error.message : String(error);
      setVmStatus(
        code === 'VECTOR_MAGIC_NOT_INSTALLED'
          ? t('error.vectorMagicNotInstalled')
          : code === 'VECTOR_MAGIC_ALREADY_RUNNING' || code === 'VECTOR_MAGIC_BUSY'
            ? t('error.vectorMagicAlreadyRunning')
          : t('error.vectorMagicBridge', { message: code }),
      );
    } finally {
      if (vmAbortRef.current === controller) {
        vmAbortRef.current = null;
        vmSessionRef.current = null;
        setVmProgress(null);
        setVmStage(null);
      }
    }
  }, [cancelVectorMagic, pattern, setPatternSource, t]);

  return (
    <Section title={t('section.pattern')}>
      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={t('pattern.dropHere')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <strong>{t('pattern.dropHere')}</strong>
        <span>{t('pattern.formats')}</span>
      </div>

      {pattern ? (
        <>
          <div className="pattern-meta">
            <span className="ellipsis" title={pattern.name}>
              {pattern.name}
            </span>
            <span className="muted">
              {t('pattern.source')}: {pattern.originalWidth} × {pattern.originalHeight}{' '}
              {t('units.px')}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {pattern.kind !== 'svg' && vmProgress === null && (
                <button
                  type="button"
                  className="link"
                  style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent, #63d0ff)' }}
                  onClick={openInVectorMagic}
                  title={t('tooltip.vectorMagicDesktop')}
                >
                  {`✨ ${t('action.openVectorMagic')}`}
                </button>
              )}
              <button
                type="button"
                className="link"
                onClick={() => {
                  cancelVectorMagic();
                  setPatternSource(null);
                }}
              >
                {t('action.removePattern')}
              </button>
            </div>
          </div>
          {vmProgress !== null && (
            <div className="vector-magic-progress" role="status" aria-live="polite">
              <div className="vector-magic-progress-label">
                <span>{t('pattern.vectorMagicProgress')}</span>
                <span>{Math.round(vmProgress * 100)}%</span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label={t('pattern.vectorMagicProgress')}
                aria-valuenow={Math.round(vmProgress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                data-stage={vmStage ?? 'launching'}
              >
                <div
                  className="progress-fill"
                  style={{ width: `${Math.max(2, vmProgress * 100)}%` }}
                />
              </div>
            </div>
          )}
          {vmStatus && <p className="notice" style={{ margin: '4px 0 8px 0' }}>{vmStatus}</p>}

          <Segmented<PreviewMode>
            value={previewMode}
            options={[
              { value: 'original', label: t('pattern.original') },
              { value: 'processed', label: t('pattern.processed') },
              { value: 'tiled', label: t('pattern.tilePreview') },
            ]}
            onChange={setPreviewMode}
          />
          <PatternCanvas pattern={pattern} mode={previewMode} />

          <p className="muted small">
            {t('summary.tileSize')}: {n(tile.width, 2)} × {n(tile.height, 2)}{' '}
            {t('units.mm')}
          </p>

          {notice && <p className="notice">{notice}</p>}
          {lowResolution && <p className="notice">{t('warning.lowRes')}</p>}
          {seamWarning && <p className="notice">{t('warning.seam')}</p>}
        </>
      ) : (
        <p className="muted small">{t('pattern.none')}</p>
      )}

      <div className="examples">
        <span className="pseudo-label">{t('pattern.examples')}</span>
        <div className="example-grid">
          {EXAMPLE_PATTERNS.map((example) => (
            <button
              key={example.id}
              type="button"
              className="example"
              title={example.description}
              onClick={() => {
                cancelVectorMagic();
                setPatternSource(example.build(512));
              }}
            >
              <ExampleThumb id={example.id} />
              <span>{example.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Toggle
        label={t('field.invert')}
        checked={patternSettings.invert}
        onChange={(invert) => update({ invert })}
        hint={t('tooltip.invert')}
      />

      {patternSettings.mode === 'binary' ? (
        <>
          <SliderField
            label={t('field.threshold')}
            value={patternSettings.threshold * 255}
            onChange={(value) => update({ threshold: value / 255 })}
            min={0}
            max={255}
            step={1}
            decimals={0}
            hint={t('tooltip.threshold')}
          />
          <NumberField
            label={t('field.despeckle')}
            value={patternSettings.despeckle}
            onChange={(despeckle) => update({ despeckle: Math.round(despeckle) })}
            min={0}
            max={5000}
            step={1}
            decimals={0}
            unit={t('units.px')}
          />
        </>
      ) : null}

      <ImageAdjustments />

    </Section>
  );
}

function ImageAdjustments() {
  const { t } = useI18n();
  const pattern = useStore((s) => s.settings.pattern);
  const update = useStore((s) => s.updatePattern);
  const resetPatternSettings = useStore((s) => s.updatePattern);

  return (
    <Section title={t('section.adjust')} defaultOpen={false}>
      <SliderField
        label={t('field.brightness')}
        value={pattern.brightness}
        onChange={(brightness) => update({ brightness })}
        min={-1}
        max={1}
        step={0.01}
      />
      <SliderField
        label={t('field.contrast')}
        value={pattern.contrast}
        onChange={(contrast) => update({ contrast })}
        min={-1}
        max={1}
        step={0.01}
      />
      <SliderField
        label={t('field.gamma')}
        value={pattern.gamma}
        onChange={(gamma) => update({ gamma })}
        min={0.1}
        max={4}
        step={0.05}
      />
      <SliderField
        label={t('field.blackPoint')}
        value={pattern.blackPoint}
        onChange={(blackPoint) => update({ blackPoint })}
        min={0}
        max={0.99}
        step={0.01}
      />
      <SliderField
        label={t('field.whitePoint')}
        value={pattern.whitePoint}
        onChange={(whitePoint) => update({ whitePoint })}
        min={0.01}
        max={1}
        step={0.01}
      />
      <SliderField
        label={t('field.blur')}
        value={pattern.blur}
        onChange={(blur) => update({ blur })}
        min={0}
        max={16}
        step={1}
        decimals={0}
        unit={t('units.px')}
      />
      <SliderField
        label={t('field.quantize')}
        value={pattern.quantize}
        onChange={(quantize) => update({ quantize: Math.round(quantize) })}
        min={0}
        max={16}
        step={1}
        decimals={0}
      />
      <button
        type="button"
        className="link"
        onClick={() =>
          resetPatternSettings({
            brightness: 0,
            contrast: 0,
            gamma: 1,
            blackPoint: 0,
            whitePoint: 1,
            blur: 0,
            quantize: 0,
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

/**
 * Shows the artwork as it will actually be interpreted.
 *
 * "Processed" is the important one: it renders the exact mask the geometry
 * kernel receives, so thresholding, inversion and levels stop being guesswork.
 * "Tiled" draws a 3x3 block so a pattern that does not really tile is obvious
 * before anything is printed.
 */
function PatternCanvas({ pattern, mode }: { pattern: RawPattern; mode: PreviewMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useStore((s) => s.settings.pattern);

  const processed = useMemo(
    () => (mode === 'original' ? null : processPattern(pattern, settings)),
    [pattern, settings, mode],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = pattern;
    const repeats = mode === 'tiled' ? 3 : 1;
    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    const source = ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      let value: number;
      if (mode === 'original') {
        value = pattern.luminance[i];
      } else {
        // Show the mask the way the roller will read it: carved areas dark.
        value = 255 - processed!.mask[i];
      }
      source.data[i * 4] = value;
      source.data[i * 4 + 1] = value;
      source.data[i * 4 + 2] = value;
      source.data[i * 4 + 3] = 255;
    }

    const bitmapCanvas = document.createElement('canvas');
    bitmapCanvas.width = width;
    bitmapCanvas.height = height;
    bitmapCanvas.getContext('2d')!.putImageData(source, 0, 0);

    ctx.imageSmoothingEnabled = false;

    const cell = PREVIEW_SIZE / repeats;
    for (let y = 0; y < repeats; y++) {
      for (let x = 0; x < repeats; x++) {
        ctx.drawImage(bitmapCanvas, x * cell, y * cell, cell, cell);
      }
    }

    if (mode === 'tiled') {
      ctx.strokeStyle = 'rgba(99, 208, 255, 0.55)';
      ctx.lineWidth = 1;
      for (let i = 1; i < repeats; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell + 0.5, 0);
        ctx.lineTo(i * cell + 0.5, PREVIEW_SIZE);
        ctx.moveTo(0, i * cell + 0.5);
        ctx.lineTo(PREVIEW_SIZE, i * cell + 0.5);
        ctx.stroke();
      }
    }
  }, [pattern, processed, mode]);

  return <canvas ref={canvasRef} className="pattern-canvas" />;
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function ExampleThumb({ id }: { id: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const example = EXAMPLE_PATTERNS.find((e) => e.id === id);
    if (!example) return;
    const size = 48;
    const raw = example.build(size);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = size;
    canvas.height = size;
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = raw.luminance[i];
      image.data[i * 4] = v;
      image.data[i * 4 + 1] = v;
      image.data[i * 4 + 2] = v;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }, [id]);

  return <canvas ref={canvasRef} className="example-thumb" aria-hidden="true" />;
}
