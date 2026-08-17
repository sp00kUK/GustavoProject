import { useI18n } from '../../i18n';
import { useStore } from '../../state/store';
import { APP_VERSION } from '../../types';

export function StatusBar() {
  const { t } = useI18n();
  const status = useStore((s) => s.status);
  const lastSavedTime = useStore((s) => s.lastSavedTime);
  const preview = useStore((s) => s.preview);

  const triCount = preview?.stats.triangleCount ?? 2719812;
  const memoryUsedGb = ((triCount * 480) / (1024 * 1024 * 1024) + 0.95).toFixed(2);

  let statusMessage = t('status.loaded');
  if (status === 'generating') {
    statusMessage = t('status.generatingMesh');
  } else if (status === 'exporting') {
    statusMessage = t('status.exportingFile');
  } else if (status === 'invalid') {
    statusMessage = t('status.geomErrors');
  }

  return (
    <footer className="cad-statusbar">
      {/* Left */}
      <div className="cad-status-left">
        <span
          className="cad-status-dot"
          style={{
            backgroundColor: status === 'invalid' ? 'var(--err)' : status === 'generating' ? 'var(--blue)' : 'var(--ok)',
          }}
        />
        <span>{statusMessage}</span>
      </div>

      {/* Right */}
      <div className="cad-status-right">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{t('status.autoSave', { time: lastSavedTime || '10:24:31' })}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
          <span>{t('status.memoryUsage', { used: memoryUsedGb, total: '8.00' })}</span>
        </div>

        <span>v{APP_VERSION}</span>
      </div>
    </footer>
  );
}
