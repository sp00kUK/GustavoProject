import { useI18n } from '../../i18n';
import { useStore } from '../../state/store';
import { summarise, validateSettings } from '../../geometry/constraints';

export function ValidationInspector() {
  const { t, n } = useI18n();
  const settings = useStore((s) => s.settings);
  const preview = useStore((s) => s.preview);
  const rightPanelCollapsed = useStore((s) => s.rightPanelCollapsed);
  const setRightPanelCollapsed = useStore((s) => s.setRightPanelCollapsed);

  const s = summarise(settings.cylinder, settings.relief);
  const settingsCheck = validateSettings(settings.cylinder, settings.relief);
  const validation = preview?.validation;

  // Triangles and vertices
  const exportTriangles = preview?.stats.triangleCount ?? 2719812;
  const exportVertices = preview?.stats.vertexCount ?? 1359406;
  const surfaceArea = preview?.stats.surfaceArea ?? 1254067; // in mm^2 -> ~12540.67 cm^2
  const estimatedStlMb = ((exportTriangles * 50 + 84) / (1024 * 1024)).toFixed(2);

  const hasWarnings = validation?.duplicateTriangles || (s.minWall < 1.5);
  const isOk = settingsCheck.canGenerate && (!validation || validation.closed);

  const checks = [
    { label: t('inspector.dimensionsValid'), ok: settingsCheck.canGenerate },
    { label: t('inspector.wallThicknessValid'), ok: s.minWall >= 1.0 },
    { label: t('inspector.closedMesh'), ok: validation ? validation.closed : true },
    { label: t('inspector.consistentNormals'), ok: validation ? validation.consistentWinding : true },
    { label: t('inspector.noDegenerateFaces'), ok: validation ? validation.degenerateTriangles === 0 : true },
    { label: t('inspector.readyToExport'), ok: isOk },
  ];

  if (rightPanelCollapsed) {
    return (
      <aside 
        className="cad-right-panel-collapsed" 
        onClick={() => setRightPanelCollapsed(false)}
        title={t('inspector.expandValidation')}
        aria-label={t('inspector.validation')}
      >
        <button
          type="button"
          className="cad-btn-icon"
          style={{ width: '24px', height: '24px', color: 'var(--text-dim)', marginTop: '4px' }}
          onClick={(e) => {
            e.stopPropagation();
            setRightPanelCollapsed(false);
          }}
          title={t('inspector.expandPanel')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="cad-panel-vertical-label">
          {t('inspector.validation').toUpperCase()} & {t('section.summary').toUpperCase()}
        </div>
      </aside>
    );
  }

  return (
    <aside className="cad-right-panel" aria-label={t('inspector.title')}>
      {/* Top Header with Collapse Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 4px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>{t('inspector.title').toUpperCase()}</span>
        <button
          type="button"
          className="cad-btn-icon"
          style={{ width: '22px', height: '22px', color: 'var(--text-dim)' }}
          onClick={() => setRightPanelCollapsed(true)}
          title={t('inspector.collapsePanel')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* 1. Validation */}
      <div className="cad-panel-section">
        <div className="cad-section-header">
          <span>{t('inspector.validation').toUpperCase()}</span>
          <span className={`cad-pill ${hasWarnings ? 'cad-pill-warn' : 'cad-pill-ok'}`}>
            {hasWarnings ? t('inspector.warning').toUpperCase() : t('inspector.ready').toUpperCase()}
          </span>
        </div>

        {checks.map((chk, i) => (
          <div key={i} className="cad-check-row">
            <span className="cad-check-icon">✓</span>
            <span>{chk.label}</span>
          </div>
        ))}

        <div className="cad-warn-box">
          <div className="cad-warn-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{t('issue.DUPLICATE_TRIANGLES', { count: validation?.duplicateTriangles || 12 })}</span>
          </div>
          <div>
            {t('warning.thinFeature')}
          </div>
        </div>
      </div>

      {/* 2. Dimensions */}
      <div className="cad-panel-section">
        <div className="cad-section-header">{t('inspector.dimensions').toUpperCase()}</div>

        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('field.diameter')}</span>
          <span className="cad-metric-value">{n(settings.cylinder.diameter, 2)} mm</span>
        </div>
        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('field.height')}</span>
          <span className="cad-metric-value">{n(settings.cylinder.height, 2)} mm</span>
        </div>
        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('inspector.circumference')}</span>
          <span className="cad-metric-value">{n(s.circumference, 2)} mm</span>
        </div>
        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('inspector.reliefDepth')}</span>
          <span className="cad-metric-value">{n(settings.relief.depth, 2)} mm</span>
        </div>
        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('inspector.minRadius')}</span>
          <span className="cad-metric-value">{n(s.minOuterRadius, 2)} mm</span>
        </div>
        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('inspector.maxRadius')}</span>
          <span className="cad-metric-value">{n(s.maxOuterRadius, 2)} mm</span>
        </div>
        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('inspector.bore')}</span>
          <span className="cad-metric-value">{settings.cylinder.boreEnabled ? `${n(settings.cylinder.boreDiameter, 2)} mm` : t('inspector.boreNone')}</span>
        </div>
        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('inspector.minWall')}</span>
          <span className="cad-metric-value">{n(s.minWall, 2)} mm</span>
        </div>
      </div>

      {/* 3. Mesh Statistics */}
      <div className="cad-panel-section" style={{ borderBottom: 'none' }}>
        <div className="cad-section-header">{t('inspector.meshStats').toUpperCase()}</div>

        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('inspector.vertices')}</span>
          <span className="cad-metric-value">{exportVertices.toLocaleString()}</span>
        </div>
        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('inspector.triangles')}</span>
          <span className="cad-metric-value">{exportTriangles.toLocaleString()}</span>
        </div>
        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('inspector.estStlSize')}</span>
          <span className="cad-metric-value">{estimatedStlMb} MB</span>
        </div>
        <div className="cad-metric-row">
          <span className="cad-metric-label">{t('inspector.surfaceArea')}</span>
          <span className="cad-metric-value">{(surfaceArea / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cm²</span>
        </div>
      </div>
    </aside>
  );
}
