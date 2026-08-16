import { useEffect } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { useDialogFocus } from './controls';
import { formatBytes } from './InfoPanels';

/* ==================================================================== *
 * Generic modal
 * ==================================================================== */

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

function Modal({ title, onClose, children, actions }: ModalProps) {
  const ref = useDialogFocus(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * First-run help
 * ==================================================================== */

export function HelpOverlay() {
  const { t } = useI18n();
  const dismissed = useStore((s) => s.helpDismissed);
  const dismiss = useStore((s) => s.dismissHelp);
  const hydrated = useStore((s) => s.hydrated);

  if (!hydrated || dismissed) return null;

  return (
    <Modal
      title={t('help.title')}
      onClose={dismiss}
      actions={
        <button type="button" className="primary" onClick={dismiss}>
          {t('action.dismiss')}
        </button>
      }
    >
      <ol className="help-steps">
        <li>{t('help.step1')}</li>
        <li>{t('help.step2')}</li>
        <li>{t('help.step3')}</li>
        <li>{t('help.step4')}</li>
        <li>{t('help.step5')}</li>
      </ol>
      <p className="convention">{t('help.convention')}</p>
      <p className="muted small">{t('app.privacy')}</p>
    </Modal>
  );
}

/* ==================================================================== *
 * Errors
 * ==================================================================== */

export function ErrorOverlay() {
  const { t } = useI18n();
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);
  if (!error) return null;

  return (
    <Modal
      title={error.title}
      onClose={() => setError(null)}
      actions={
        <button type="button" className="primary" onClick={() => setError(null)}>
          {t('action.close')}
        </button>
      }
    >
      <p className="pre-wrap">{error.message}</p>
    </Modal>
  );
}

/* ==================================================================== *
 * Large export confirmation
 * ==================================================================== */

export interface LargeExportPrompt {
  triangles: number;
  quality: string;
  onConfirm: () => void;
  onUseHigh: () => void;
  onCancel: () => void;
}

export function LargeExportOverlay({ prompt }: { prompt: LargeExportPrompt | null }) {
  const { t, n } = useI18n();
  if (!prompt) return null;

  return (
    <Modal
      title={t('status.exporting')}
      onClose={prompt.onCancel}
      actions={
        <>
          <button type="button" onClick={prompt.onCancel}>
            {t('action.cancel')}
          </button>
          <button type="button" onClick={prompt.onUseHigh}>
            {t('action.useHigh')}
          </button>
          <button type="button" className="primary" onClick={prompt.onConfirm}>
            {t('action.generateAnyway')}
          </button>
        </>
      }
    >
      <p className="pre-wrap">
        {t('warning.largeExport', {
          quality: prompt.quality,
          triangles: n(prompt.triangles, 0),
          size: formatBytes(84 + prompt.triangles * 50, n),
        })}
      </p>
    </Modal>
  );
}

/* ==================================================================== *
 * Progress with cancel
 * ==================================================================== */

export function ProgressOverlay() {
  const { t } = useI18n();
  const status = useStore((s) => s.status);
  const progress = useStore((s) => s.progress);
  const stage = useStore((s) => s.stage);
  const cancel = useStore((s) => s.cancel);

  if (status !== 'exporting') return null;

  const stageLabel =
    stage === 'writing'
      ? t('stage.writing')
      : stage
        ? t(`stage.${stage}` as 'stage.pattern')
        : '';

  return (
    <div className="progress-overlay" role="status" aria-live="polite">
      <div className="progress-card">
        <strong>{t('status.exporting')}</strong>
        <span className="muted small">{stageLabel}</span>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="muted small">{Math.round(progress * 100)}%</span>
        <button type="button" onClick={cancel}>
          {t('action.cancel')}
        </button>
      </div>
    </div>
  );
}
