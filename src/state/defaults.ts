import type {
  CylinderSettings,
  ExportSettings,
  PatternSettings,
  ProjectSettings,
  QualitySettings,
  ReliefSettings,
} from '../types';

/**
 * Spec 69: the app opens on a sensible, immediately printable roller so a
 * first-time user sees the whole idea before touching a control.
 */
export const DEFAULT_CYLINDER: CylinderSettings = {
  diameter: 50,
  height: 100,
  boreEnabled: true,
  boreDiameter: 8,
};

export const DEFAULT_PATTERN: PatternSettings = {
  mode: 'binary',
  invert: false,
  threshold: 0.5,
  despeckle: 0,

  vectorize: false,
  vectorizeSmoothness: 0.8,
  vectorizeCornerThreshold: 55,

  brightness: 0,
  contrast: 0,
  gamma: 1,
  blackPoint: 0,
  whitePoint: 1,
  blur: 0,
  quantize: 0,

  tileFit: 'stretch',

  columns: 4,
  rows: 8,

  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  mirrorX: false,
  mirrorY: false,

  stagger: 0,
  staggerMode: 'none',
};

export const DEFAULT_RELIEF: ReliefSettings = {
  depth: 2,
  direction: 'deboss',
  edgeTreatment: 'sharp',
  edgeSoftness: 0.3,
  bottomMargin: 0,
  topMargin: 0,
};

export const DEFAULT_QUALITY: QualitySettings = {
  preview: 'standard',
  export: 'high',
  customSpacing: 0.25,
};

export const DEFAULT_EXPORT: ExportSettings = {
  format: 'stl',
  orientation: 'vertical',
};

export function defaultProject(name = 'Untitled Roller'): ProjectSettings {
  return {
    name,
    cylinder: { ...DEFAULT_CYLINDER },
    pattern: { ...DEFAULT_PATTERN },
    relief: { ...DEFAULT_RELIEF },
    quality: { ...DEFAULT_QUALITY },
    export: { ...DEFAULT_EXPORT },
  };
}

/** Spec 131: presets only ever fill in dimensions - nothing is hidden. */
export interface DimensionPreset {
  id: string;
  labelKey: string;
  cylinder: CylinderSettings;
}

export const DIMENSION_PRESETS: DimensionPreset[] = [
  {
    id: 'smallTerrain',
    labelKey: 'preset.smallTerrain',
    cylinder: { diameter: 30, height: 50, boreEnabled: true, boreDiameter: 6 },
  },
  {
    id: 'standardTerrain',
    labelKey: 'preset.standardTerrain',
    cylinder: { diameter: 50, height: 100, boreEnabled: true, boreDiameter: 8 },
  },
  {
    id: 'largeClay',
    labelKey: 'preset.largeClay',
    cylinder: { diameter: 70, height: 150, boreEnabled: true, boreDiameter: 10 },
  },
  {
    id: 'grip',
    labelKey: 'preset.grip',
    cylinder: { diameter: 25, height: 90, boreEnabled: true, boreDiameter: 12 },
  },
  {
    id: 'stamp',
    labelKey: 'preset.stamp',
    cylinder: { diameter: 40, height: 40, boreEnabled: false, boreDiameter: 8 },
  },
];
