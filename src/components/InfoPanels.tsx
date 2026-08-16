import { useState } from 'react';
import { useI18n, type TranslationKey } from '../i18n';
import { translateIssue } from '../i18n/issues';
import { useStore } from '../state/store';
import { APP_VERSION } from '../types';
import { summarise, validateSettings } from '../geometry/constraints';
import { estimateStlBytes, sourceDetailSpacing } from '../geometry/quality';
import { tileSizeMm } from '../pattern/sampler';
import { Section, StatRow } from './controls';

/* ==================================================================== *
 * Live dimensions
 * ==================================================================== */

export function SummaryPanel() {
  const { t, n } = useI18n();
  const settings = useStore((s) => s.settings);
  const preview = useStore((s) => s.preview);
  const pattern = useStore((s) => s.pattern);

  const s = summarise(settings.cylinder, settings.relief);
  const tile = tileSizeMm(
    s.circumference,
    s.usableHeight,
    settings.pattern.columns,
    settings.pattern.rows,
  );

  const bounds = preview
    ? `${n(preview.stats.bounds.max[0] - preview.stats.bounds.min[0], 2)} × ` +
      `${n(preview.stats.bounds.max[1] - preview.stats.bounds.min[1], 2)} × ` +
      `${n(preview.stats.bounds.max[2] - preview.stats.bounds.min[2], 2)} ${t('units.mm')}`
    : t('summary.none');

  const exportTriangles = preview?.stats.triangleCount ?? 0;

  return (
    <Section title={t('section.summary')}>
      <StatRow label={t('summary.diameter')} value={`${n(settings.cylinder.diameter, 2)} ${t('units.mm')}`} />
      <StatRow label={t('summary.height')} value={`${n(settings.cylinder.height, 2)} ${t('units.mm')}`} />
      <StatRow label={t('summary.circumference')} value={`${n(s.circumference, 2)} ${t('units.mm')}`} />
      <StatRow label={t('summary.reliefDepth')} value={`${n(settings.relief.depth, 2)} ${t('units.mm')}`} />
      <StatRow label={t('summary.minRadius')} value={`${n(s.minOuterRadius, 2)} ${t('units.mm')}`} />
      <StatRow label={t('summary.maxRadius')} value={`${n(s.maxOuterRadius, 2)} ${t('units.mm')}`} />
      <StatRow
        label={t('summary.bore')}
        value={
          settings.cylinder.boreEnabled
            ? `${n(settings.cylinder.boreDiameter, 2)} ${t('units.mm')}`
            : t('summary.none')
        }
      />
      <StatRow
        label={t('summary.minWall')}
        value={`${n(s.minWall, 2)} ${t('units.mm')}`}
        emphasis={s.minWall < 1.2 ? 'warning' : undefined}
      />
      <hr />
      <StatRow
        label={t('summary.tileSize')}
        value={`${n(tile.width, 2)} × ${n(tile.height, 2)} ${t('units.mm')}`}
      />
      <StatRow label={t('summary.bounds')} value={bounds} />
      <StatRow
        label={t('summary.vertices')}
        value={preview ? n(preview.stats.vertexCount, 0) : t('summary.none')}
      />
      <StatRow
        label={t('summary.triangles')}
        value={preview ? n(exportTriangles, 0) : t('summary.none')}
      />
      <StatRow
        label={t('summary.estimatedStl')}
        value={
          preview ? formatBytes(estimateStlBytes(exportTriangles), n) : t('summary.none')
        }
      />
      <StatRow
        label={t('summary.sampling')}
        value={
          preview
            ? `${n(preview.resolution.spacingMm, 3)} ${t('units.mm')}`
            : t('summary.none')
        }
      />
      <StatRow
        label={t('summary.segments')}
        value={
          preview
            ? `${preview.resolution.radialSegments} × ${preview.resolution.verticalSegments}`
            : t('summary.none')
        }
      />
      {pattern && <NyquistNotice />}
    </Section>
  );
}

function NyquistNotice() {
  const { t } = useI18n();
  const settings = useStore((s) => s.settings);
  const pattern = useStore((s) => s.pattern);
  const preview = useStore((s) => s.preview);
  if (!pattern || !preview) return null;

  const s = summarise(settings.cylinder, settings.relief);
  const detail = sourceDetailSpacing(
    s.circumference,
    s.usableHeight,
    settings.pattern.columns,
    settings.pattern.rows,
    pattern.width,
    pattern.height,
  );

  if (preview.resolution.spacingMm <= detail * 1.05) return null;
  return <p className="notice">{t('warning.nyquist')}</p>;
}

/* ==================================================================== *
 * Validation
 * ==================================================================== */

export function ValidationPanel() {
  const i18n = useI18n();
  const { t } = i18n;
  const preview = useStore((s) => s.preview);
  const settings = useStore((s) => s.settings);
  const status = useStore((s) => s.status);

  const settingsCheck = validateSettings(settings.cylinder, settings.relief);
  const validation = preview?.validation;

  const checks: Array<{ key: TranslationKey; ok: boolean | null }> = [
    { key: 'validation.dimensions', ok: settingsCheck.canGenerate },
    { key: 'validation.wall', ok: !settingsCheck.issues.some((i) => i.code === 'THIN_WALL') },
    { key: 'validation.closed', ok: validation ? validation.closed : null },
    {
      key: 'validation.winding',
      ok: validation ? validation.consistentWinding && validation.outwardWinding : null,
    },
    {
      key: 'validation.degenerate',
      ok: validation ? validation.degenerateTriangles === 0 : null,
    },
    {
      key: 'validation.ready',
      ok: validation ? validation.ok && settingsCheck.canGenerate : null,
    },
  ];

  const messages = [
    ...settingsCheck.issues,
    ...(validation?.issues ?? []),
  ];

  return (
    <Section title={t('section.validation')} badge={<StatusChip />}>
      <ul className="check-list">
        {checks.map((check) => (
          <li key={check.key} className={checkClass(check.ok)}>
            <span className="check-icon" aria-hidden="true">
              {check.ok === null ? '·' : check.ok ? '✓' : '✕'}
            </span>
            <span>{t(check.key)}</span>
            <span className="sr-only">
              {check.ok === null
                ? t('validation.pending')
                : check.ok
                  ? t('status.valid')
                  : t('status.invalid')}
            </span>
          </li>
        ))}
      </ul>

      {status === 'generating' && <p className="muted small">{t('status.generating')}…</p>}

      {messages.map((issue, index) => (
        <p key={`${issue.code}-${index}`} className={`message ${issue.severity}`}>
          {translateIssue(i18n, issue)}
        </p>
      ))}

      <PrintabilityNotes />
    </Section>
  );
}

function checkClass(ok: boolean | null): string {
  if (ok === null) return 'pending';
  return ok ? 'pass' : 'fail';
}

/**
 * Guidance, not enforcement. Printer setups vary enormously and a resin user
 * has no business being blocked by an FDM nozzle assumption, so these are
 * always advisory.
 */
function PrintabilityNotes() {
  const { t } = useI18n();
  const relief = useStore((s) => s.settings.relief);
  const notes: string[] = [];
  if (relief.depth > 0 && relief.depth < 0.4) notes.push(t('warning.thinFeature'));
  if (relief.depth > 3) notes.push(t('warning.deepCavity'));
  return (
    <>
      {notes.map((note) => (
        <p key={note} className="message info">
          {note}
        </p>
      ))}
    </>
  );
}

export function StatusChip() {
  const { t } = useI18n();
  const status = useStore((s) => s.status);
  const labels = {
    idle: t('status.idle'),
    generating: t('status.generating'),
    valid: t('status.modelReady'),
    warning: t('status.warning'),
    invalid: t('status.invalid'),
    exporting: t('status.exporting'),
  } as const;
  return <span className={`status-chip ${status}`}>{labels[status]}</span>;
}

/* ==================================================================== *
 * Debug
 * ==================================================================== */

export function DebugPanel({ fps }: { fps: number }) {
  const { t, n } = useI18n();
  const preview = useStore((s) => s.preview);
  const pattern = useStore((s) => s.pattern);
  const settings = useStore((s) => s.settings);
  const [copied, setCopied] = useState(false);

  const debugInfo = {
    appVersion: APP_VERSION,
    diameter: settings.cylinder.diameter,
    height: settings.cylinder.height,
    bore: settings.cylinder.boreEnabled ? settings.cylinder.boreDiameter : 0,
    depth: settings.relief.depth,
    direction: settings.relief.direction,
    mode: settings.pattern.mode,
    columns: settings.pattern.columns,
    rows: settings.pattern.rows,
    previewQuality: settings.quality.preview,
    exportQuality: settings.quality.export,
    // Deliberately the dimensions only - never the artwork itself.
    sourceResolution: pattern ? `${pattern.width}x${pattern.height}` : null,
    triangles: preview?.stats.triangleCount ?? 0,
    radialSegments: preview?.resolution.radialSegments ?? 0,
    verticalSegments: preview?.resolution.verticalSegments ?? 0,
    manifoldFailures:
      (preview?.validation.boundaryEdges ?? 0) +
      (preview?.validation.nonManifoldEdges ?? 0),
    pinchFixes: preview?.pinchFixes ?? 0,
  };

  const memoryMb = preview
    ? (preview.mesh.positions.byteLength +
        preview.mesh.indices.byteLength +
        (preview.mesh.normals?.byteLength ?? 0)) /
      1048576
    : 0;

  return (
    <Section title={t('section.debug')} defaultOpen>
      <StatRow label={t('debug.fps')} value={fps || '—'} />
      <StatRow
        label={t('debug.meshTime')}
        value={preview ? `${Math.round(preview.elapsedMs)} ms` : '—'}
      />
      <StatRow
        label={t('debug.patternRes')}
        value={pattern ? `${pattern.width} × ${pattern.height}` : '—'}
      />
      <StatRow label={t('debug.angularSegments')} value={debugInfo.radialSegments} />
      <StatRow label={t('debug.verticalSegments')} value={debugInfo.verticalSegments} />
      <StatRow
        label={t('debug.manifoldFailures')}
        value={debugInfo.manifoldFailures}
        emphasis={debugInfo.manifoldFailures > 0 ? 'error' : undefined}
      />
      <StatRow label={t('debug.pinchFixes')} value={debugInfo.pinchFixes} />
      <StatRow label={t('debug.memory')} value={`${n(memoryMb, 1)} MB`} />
      <button
        type="button"
        className="link"
        onClick={() => {
          void navigator.clipboard?.writeText(JSON.stringify(debugInfo, null, 2));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? t('action.copied') : t('action.copyDebug')}
      </button>
    </Section>
  );
}

/** Locale-aware byte sizes: Spanish wants "2,3 MB", not "2.3 MB". */
function formatBytes(bytes: number, n?: (v: number, d?: number) => string): string {
  const fmt = n ?? ((v: number, d = 1) => v.toFixed(d));
  if (bytes < 1024) return `${fmt(bytes, 0)} B`;
  if (bytes < 1048576) return `${fmt(bytes / 1024, 1)} KB`;
  return `${fmt(bytes / 1048576, 1)} MB`;
}

export { formatBytes };
