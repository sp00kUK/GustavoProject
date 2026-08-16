import { useI18n, type TranslationKey } from '../i18n';
import { useStore } from '../state/store';
import { DIMENSION_PRESETS, RELIEF_PRESETS } from '../state/defaults';
import { maxSafeDepth, validateSettings } from '../geometry/constraints';
import { QUALITY_SPACING_MM } from '../geometry/quality';
import {
  NumberField,
  Section,
  Segmented,
  SelectField,
  SliderField,
  Toggle,
} from './controls';
import type {
  ExportFormat,
  ExportOrientation,
  PatternMode,
  QualityPreset,
  ReliefDirection,
  StaggerMode,
  TileFit,
} from '../types';

/* ==================================================================== *
 * Cylinder
 * ==================================================================== */

export function CylinderSection() {
  const { t } = useI18n();
  const cylinder = useStore((s) => s.settings.cylinder);
  const update = useStore((s) => s.updateCylinder);
  const replace = useStore((s) => s.replaceSettings);
  const settings = useStore((s) => s.settings);

  const activePreset =
    DIMENSION_PRESETS.find(
      (p) =>
        p.cylinder.diameter === cylinder.diameter &&
        p.cylinder.height === cylinder.height &&
        p.cylinder.boreEnabled === cylinder.boreEnabled &&
        p.cylinder.boreDiameter === cylinder.boreDiameter,
    )?.id ?? 'custom';

  return (
    <Section title={t('section.cylinder')}>
      <SelectField
        label={t('field.preset')}
        value={activePreset}
        options={[
          { value: 'custom', label: t('preset.customLabel') },
          ...DIMENSION_PRESETS.map((p) => ({
            value: p.id,
            label: t(p.labelKey as 'preset.smallTerrain'),
          })),
        ]}
        onChange={(id) => {
          const preset = DIMENSION_PRESETS.find((p) => p.id === id);
          if (preset) replace({ ...settings, cylinder: { ...preset.cylinder } });
        }}
      />
      <NumberField
        label={t('field.diameter')}
        value={cylinder.diameter}
        onChange={(diameter) => update({ diameter })}
        min={1}
        max={1000}
        step={1}
        unit={t('units.mm')}
        hint={t('tooltip.diameter')}
      />
      <NumberField
        label={t('field.height')}
        value={cylinder.height}
        onChange={(height) => update({ height })}
        min={1}
        max={1000}
        step={1}
        unit={t('units.mm')}
        hint={t('tooltip.height')}
      />
      <Toggle
        label={t('field.boreEnabled')}
        checked={cylinder.boreEnabled}
        onChange={(boreEnabled) => update({ boreEnabled })}
        hint={t('tooltip.bore')}
      />
      <NumberField
        label={t('field.boreDiameter')}
        value={cylinder.boreDiameter}
        onChange={(boreDiameter) => update({ boreDiameter })}
        min={0.5}
        max={Math.max(1, cylinder.diameter - 1)}
        step={0.5}
        unit={t('units.mm')}
        disabled={!cylinder.boreEnabled}
      />
    </Section>
  );
}

/* ==================================================================== *
 * Repeat
 * ==================================================================== */

export function RepeatSection() {
  const { t } = useI18n();
  const pattern = useStore((s) => s.settings.pattern);
  const update = useStore((s) => s.updatePattern);

  return (
    <Section title={t('section.repeat')}>
      <NumberField
        label={t('field.columns')}
        value={pattern.columns}
        onChange={(columns) => update({ columns: Math.round(columns) })}
        min={1}
        max={200}
        step={1}
        decimals={0}
        hint={t('tooltip.columns')}
      />
      <NumberField
        label={t('field.rows')}
        value={pattern.rows}
        onChange={(rows) => update({ rows: Math.round(rows) })}
        min={1}
        max={200}
        step={1}
        decimals={0}
        hint={t('tooltip.rows')}
      />
      <SelectField<StaggerMode>
        label={t('field.staggerMode')}
        value={pattern.staggerMode}
        options={[
          { value: 'none', label: t('option.staggerNone') },
          { value: 'alternate', label: t('option.staggerAlternate') },
          { value: 'every', label: t('option.staggerEvery') },
        ]}
        onChange={(staggerMode) => update({ staggerMode })}
        hint={t('tooltip.stagger')}
      />
      <SliderField
        label={t('field.stagger')}
        value={pattern.stagger * 100}
        onChange={(value) => update({ stagger: value / 100 })}
        min={0}
        max={100}
        step={0.5}
        unit={t('units.percent')}
        decimals={1}
        disabled={pattern.staggerMode === 'none'}
      />
      <SliderField
        label={t('field.offsetX')}
        value={pattern.offsetX * 100}
        onChange={(value) => update({ offsetX: value / 100 })}
        min={-100}
        max={100}
        step={0.5}
        unit={t('units.percent')}
        decimals={1}
      />
      <SliderField
        label={t('field.offsetY')}
        value={pattern.offsetY * 100}
        onChange={(value) => update({ offsetY: value / 100 })}
        min={-100}
        max={100}
        step={0.5}
        unit={t('units.percent')}
        decimals={1}
      />
    </Section>
  );
}

/* ==================================================================== *
 * Transform
 * ==================================================================== */

export function TransformSection() {
  const { t } = useI18n();
  const pattern = useStore((s) => s.settings.pattern);
  const update = useStore((s) => s.updatePattern);

  return (
    <Section title={t('section.transform')} defaultOpen={false}>
      <SelectField<TileFit>
        label={t('field.tileFit')}
        value={pattern.tileFit}
        options={[
          { value: 'stretch', label: t('option.stretch') },
          { value: 'fit', label: t('option.fit') },
          { value: 'fill', label: t('option.fill') },
        ]}
        onChange={(tileFit) => update({ tileFit })}
        hint={t('tooltip.tileFit')}
      />
      <SliderField
        label={t('field.rotation')}
        value={pattern.rotation}
        onChange={(rotation) => update({ rotation })}
        min={-180}
        max={180}
        step={1}
        unit={t('units.deg')}
        decimals={0}
      />
      <div className="button-row">
        {[90, 180, 270].map((angle) => (
          <button
            key={angle}
            type="button"
            className="chip"
            onClick={() => update({ rotation: normaliseAngle(pattern.rotation + angle) })}
          >
            +{angle}
            {t('units.deg')}
          </button>
        ))}
      </div>
      <SliderField
        label={t('field.scaleX')}
        value={pattern.scaleX}
        onChange={(scaleX) => update({ scaleX })}
        min={0.1}
        max={4}
        step={0.05}
      />
      <SliderField
        label={t('field.scaleY')}
        value={pattern.scaleY}
        onChange={(scaleY) => update({ scaleY })}
        min={0.1}
        max={4}
        step={0.05}
      />
      <Toggle
        label={t('field.mirrorX')}
        checked={pattern.mirrorX}
        onChange={(mirrorX) => update({ mirrorX })}
      />
      <Toggle
        label={t('field.mirrorY')}
        checked={pattern.mirrorY}
        onChange={(mirrorY) => update({ mirrorY })}
      />
    </Section>
  );
}

function normaliseAngle(angle: number): number {
  let a = angle;
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
}

/* ==================================================================== *
 * Relief
 * ==================================================================== */

export function ReliefSection() {
  const { t, n } = useI18n();
  const relief = useStore((s) => s.settings.relief);
  const cylinder = useStore((s) => s.settings.cylinder);
  const update = useStore((s) => s.updateRelief);
  const updatePattern = useStore((s) => s.updatePattern);
  const updateQuality = useStore((s) => s.updateQuality);
  const pattern = useStore((s) => s.settings.pattern);

  const check = validateSettings(cylinder, relief);
  const blocked = check.issues.find((i) => i.code === 'DEPTH_BREACHES_BORE');
  const safe = maxSafeDepth(cylinder, relief.direction);

  const activePreset =
    RELIEF_PRESETS.find((p) => {
      const matchRelief =
        (p.relief.depth === undefined || p.relief.depth === relief.depth) &&
        (p.relief.direction === undefined || p.relief.direction === relief.direction) &&
        (p.relief.edgeTreatment === undefined || p.relief.edgeTreatment === relief.edgeTreatment) &&
        (p.relief.edgeSoftness === undefined || p.relief.edgeSoftness === relief.edgeSoftness);
      const matchPattern =
        !p.pattern ||
        ((p.pattern.mode === undefined || p.pattern.mode === pattern.mode) &&
          (p.pattern.gamma === undefined || p.pattern.gamma === pattern.gamma) &&
          (p.pattern.blur === undefined || p.pattern.blur === pattern.blur) &&
          (p.pattern.quantize === undefined || p.pattern.quantize === pattern.quantize));
      return matchRelief && matchPattern;
    })?.id ?? 'custom';


  return (
    <Section title={t('section.relief')}>
      <SelectField
        label={t('field.preset')}
        value={activePreset}
        options={[
          { value: 'custom', label: t('preset.customLabel') },
          ...RELIEF_PRESETS.map((p) => ({
            value: p.id,
            label: t(p.labelKey as TranslationKey),
          })),
        ]}
        onChange={(id) => {
          const preset = RELIEF_PRESETS.find((p) => p.id === id);
          if (preset) {
            if (preset.relief) update(preset.relief);
            if (preset.pattern) updatePattern(preset.pattern);
            if (preset.quality) updateQuality(preset.quality);
          }
        }}
      />
      <Segmented<ReliefDirection>
        label={t('field.direction')}
        value={relief.direction}
        options={[
          { value: 'deboss', label: t('option.deboss') },
          { value: 'emboss', label: t('option.emboss') },
        ]}
        onChange={(direction) => update({ direction })}
        hint={t('tooltip.direction')}
      />
      <SliderField
        label={t('field.depth')}
        value={relief.depth}
        onChange={(depth) => update({ depth })}
        min={0}
        max={5}
        step={0.05}
        unit={t('units.mm')}
        hint={t('tooltip.depth')}
      />
      {blocked && Number.isFinite(safe) && (
        <button
          type="button"
          className="fix-button"
          onClick={() => update({ depth: Math.round(safe * 100) / 100 })}
        >
          {t('action.setMaxDepth')} ({n(safe, 2)} {t('units.mm')})
        </button>
      )}
      <Segmented
        label={t('field.edgeTreatment')}
        value={relief.edgeTreatment}
        options={[
          { value: 'sharp', label: t('option.sharp') },
          { value: 'soft', label: t('option.soft') },
        ]}
        onChange={(edgeTreatment) => update({ edgeTreatment })}
        hint={t('tooltip.edgeTreatment')}
      />
      <SliderField
        label={t('field.edgeSoftness')}
        value={relief.edgeSoftness}
        onChange={(edgeSoftness) => update({ edgeSoftness })}
        min={0}
        max={2}
        step={0.05}
        unit={t('units.mm')}
        disabled={relief.edgeTreatment !== 'soft'}
      />
      <NumberField
        label={t('field.bottomMargin')}
        value={relief.bottomMargin}
        onChange={(bottomMargin) => update({ bottomMargin })}
        min={0}
        max={cylinder.height / 2}
        step={0.5}
        unit={t('units.mm')}
        hint={t('tooltip.margins')}
      />
      <NumberField
        label={t('field.topMargin')}
        value={relief.topMargin}
        onChange={(topMargin) => update({ topMargin })}
        min={0}
        max={cylinder.height / 2}
        step={0.5}
        unit={t('units.mm')}
      />
    </Section>
  );
}

/* ==================================================================== *
 * Quality
 * ==================================================================== */

export function QualitySection() {
  const { t, n } = useI18n();
  const quality = useStore((s) => s.settings.quality);
  const update = useStore((s) => s.updateQuality);

  const presetOptions = (['draft', 'standard', 'high', 'ultra', 'custom'] as const).map(
    (value) => ({
      value: value as QualityPreset,
      label:
        value === 'custom'
          ? t('option.custom')
          : `${t(`option.${value}` as 'option.draft')} · ${n(
              QUALITY_SPACING_MM[value],
              2,
            )} ${t('units.mm')}`,
    }),
  );

  return (
    <Section title={t('section.quality')}>
      <SelectField<QualityPreset>
        label={t('field.previewQuality')}
        value={quality.preview}
        options={presetOptions}
        onChange={(preview) => update({ preview })}
        hint={t('tooltip.quality')}
      />
      <SelectField<QualityPreset>
        label={t('field.exportQuality')}
        value={quality.export}
        options={presetOptions}
        onChange={(value) => update({ export: value })}
      />
      {(quality.preview === 'custom' || quality.export === 'custom') && (
        <NumberField
          label={t('field.customSpacing')}
          value={quality.customSpacing}
          onChange={(customSpacing) => update({ customSpacing })}
          min={0.02}
          max={5}
          step={0.01}
          unit={t('units.mm')}
          decimals={3}
        />
      )}
    </Section>
  );
}

/* ==================================================================== *
 * Export
 * ==================================================================== */

export function ExportSection({ onExport }: { onExport: () => void }) {
  const { t } = useI18n();
  const exportSettings = useStore((s) => s.settings.export);
  const update = useStore((s) => s.updateExport);
  const status = useStore((s) => s.status);
  const mode = useStore((s) => s.settings.pattern.mode);
  const updatePattern = useStore((s) => s.updatePattern);

  return (
    <Section title={t('section.export')}>
      <Segmented<PatternMode>
        label={t('field.mode')}
        value={mode}
        options={[
          { value: 'binary', label: t('option.binary') },
          { value: 'grayscale', label: t('option.grayscale') },
        ]}
        onChange={(value) => updatePattern({ mode: value })}
        hint={t('tooltip.mode')}
      />
      <SelectField<ExportFormat>
        label={t('field.format')}
        value={exportSettings.format}
        options={[
          { value: 'stl', label: 'STL (binary)' },
          { value: '3mf', label: '3MF' },
        ]}
        onChange={(format) => update({ format })}
      />
      <SelectField<ExportOrientation>
        label={t('field.orientation')}
        value={exportSettings.orientation}
        options={[
          { value: 'vertical', label: t('option.vertical') },
          { value: 'horizontalX', label: t('option.horizontalX') },
          { value: 'horizontalY', label: t('option.horizontalY') },
        ]}
        onChange={(orientation) => update({ orientation })}
        hint={t('tooltip.orientation')}
      />
      <button
        type="button"
        className="primary export-button"
        onClick={onExport}
        disabled={status === 'invalid' || status === 'exporting'}
      >
        {t('action.export')} {exportSettings.format.toUpperCase()}
      </button>
    </Section>
  );
}
