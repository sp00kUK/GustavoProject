import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';

/* -------------------------------------------------------------------- *
 * Section
 * -------------------------------------------------------------------- */

interface SectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}

export function Section({ title, children, defaultOpen = true, badge }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="section">
      <h2>
        <button
          type="button"
          className="section-header"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`chevron ${open ? 'open' : ''}`} aria-hidden="true" />
          <span className="section-title">{title}</span>
          {badge}
        </button>
      </h2>
      <div id={id} className="section-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- *
 * Tooltip
 * -------------------------------------------------------------------- */

export function Hint({ text }: { text: string }) {
  return (
    <span className="hint" tabIndex={0} role="note" aria-label={text}>
      <span aria-hidden="true">?</span>
      <span className="hint-bubble">{text}</span>
    </span>
  );
}

/* -------------------------------------------------------------------- *
 * Number field
 * -------------------------------------------------------------------- */

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
  disabled?: boolean;
  /** Decimal places used when re-formatting after a commit. */
  decimals?: number;
}

/**
 * A numeric input that lets the user type freely.
 *
 * Clamping on every keystroke makes fields impossible to edit - typing "0.35"
 * over a min of 0.1 fights you at "0". So the raw text is held while focused
 * and only parsed and clamped on blur or Enter.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit,
  hint,
  disabled,
  decimals = 2,
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const display = draft ?? formatNumber(value, decimals);

  const commit = (raw: string) => {
    const parsed = Number.parseFloat(raw.replace(',', '.'));
    setDraft(null);
    if (!Number.isFinite(parsed)) return;
    let next = parsed;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    if (next !== value) onChange(next);
  };

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {hint && <Hint text={hint} />}
      </label>
      <div className="number-input">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={display}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setDraft(null);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const delta = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? step * 10 : step);
              commit(String(value + delta));
            }
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- *
 * Slider + number
 * -------------------------------------------------------------------- */

interface SliderFieldProps extends NumberFieldProps {
  min: number;
  max: number;
  /** Called while dragging, for temporary low-quality preview. */
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

export function SliderField(props: SliderFieldProps) {
  const {
    label,
    value,
    onChange,
    min,
    max,
    step = 0.1,
    unit,
    hint,
    disabled,
    decimals = 2,
    onScrubStart,
    onScrubEnd,
  } = props;
  const id = useId();

  return (
    <div className="field slider-field">
      <label htmlFor={id}>
        {label}
        {hint && <Hint text={hint} />}
      </label>
      <div className="slider-row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          disabled={disabled}
          onPointerDown={onScrubStart}
          onPointerUp={onScrubEnd}
          onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        />
        <NumberField
          label=""
          value={value}
          onChange={onChange}
          min={min}
          step={step}
          unit={unit}
          disabled={disabled}
          decimals={decimals}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- *
 * Select
 * -------------------------------------------------------------------- */

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  hint?: string;
  disabled?: boolean;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  disabled,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {hint && <Hint text={hint} />}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* -------------------------------------------------------------------- *
 * Toggle
 * -------------------------------------------------------------------- */

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, hint, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className="field toggle-field">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id}>
        {label}
        {hint && <Hint text={hint} />}
      </label>
    </div>
  );
}

/* -------------------------------------------------------------------- *
 * Segmented control
 * -------------------------------------------------------------------- */

interface SegmentedProps<T extends string> {
  label?: string;
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (value: T) => void;
  hint?: string;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: SegmentedProps<T>) {
  return (
    <div className="field">
      {label && (
        <span className="pseudo-label">
          {label}
          {hint && <Hint text={hint} />}
        </span>
      )}
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.title}
            className={option.value === value ? 'active' : ''}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- *
 * Read-only stat rows
 * -------------------------------------------------------------------- */

export function StatRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: ReactNode;
  emphasis?: 'warning' | 'error';
}) {
  return (
    <div className={`stat-row ${emphasis ?? ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

/** Focus trap helper for modal dialogs. */
export function useDialogFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;
    const focusable = node.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [open]);
  return ref;
}

function formatNumber(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  return String(rounded);
}
