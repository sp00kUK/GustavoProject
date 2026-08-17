import type {
  BottomLogoSettings,
  CylinderSettings,
  ExportSettings,
  HandleNameSettings,
  MoldAssemblySettings,
  OperationSettings,
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
  diameter: 95,
  height: 105,
  boreEnabled: false,
  boreDiameter: 8,
};

export const DEFAULT_PATTERN: PatternSettings = {
  mode: 'grayscale',
  invert: false,
  threshold: 0.5,
  despeckle: 0,

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
  rowPatternIds: [],

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

export const DEFAULT_ASSEMBLY: MoldAssemblySettings = {
  enabled: true,
  projectionTarget: 'body',
  handleExtension: 46.2,
  handleBarWidth: 12,
  handleDepth: 25,
  partGap: 0.4,
};

export const DEFAULT_HANDLE_NAME: HandleNameSettings = {
  enabled: false,
  text: '',
  font: 'modern',
  depth: 0.8,
};

export const DEFAULT_BOTTOM_LOGO: BottomLogoSettings = {
  enabled: false,
  diameter: 32,
  plateThickness: 2,
  reliefDepth: 1,
  invert: false,
  previewGap: 1,
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
  scope: 'assembly',
};

export const DEFAULT_PRIMARY_OPERATION: OperationSettings = {
  id: 'op-body',
  name: 'Body Texture',
  type: 'deboss',
  targetPart: 'body',
  mappingKind: 'grid',
  visible: true,
  projectionMode: 'cylindrical',
  projectionMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
  patternId: 'primary',
  maskId: null,
  depth: 1.7,
  smoothing: 0,
  tileFit: 'stretch',
  snapSeamlessWrap: true,
  columns: 4,
  rows: 8,
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  mirrorX: false,
  mirrorY: false,
};

export const DEFAULT_TOP_RIM_OPERATION: OperationSettings = {
  id: 'op-top-rim',
  name: 'Top Rim Accent',
  type: 'deboss',
  targetPart: 'topRim',
  mappingKind: 'grid',
  visible: false,
  projectionMode: 'cylindrical',
  projectionMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
  patternId: 'primary',
  maskId: null,
  depth: 0.8,
  smoothing: 0,
  tileFit: 'stretch',
  snapSeamlessWrap: true,
  columns: 16,
  rows: 2,
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  mirrorX: false,
  mirrorY: false,
};

export const DEFAULT_BOTTOM_RIM_OPERATION: OperationSettings = {
  id: 'op-bottom-rim',
  name: 'Bottom Rim Base',
  type: 'deboss',
  targetPart: 'bottomRim',
  mappingKind: 'grid',
  visible: false,
  projectionMode: 'cylindrical',
  projectionMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
  patternId: 'primary',
  maskId: null,
  depth: 0.8,
  smoothing: 0,
  tileFit: 'stretch',
  snapSeamlessWrap: true,
  columns: 16,
  rows: 2,
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  mirrorX: false,
  mirrorY: false,
};

export const DEFAULT_HANDLE_OPERATION: OperationSettings = {
  id: 'op-handle',
  name: 'Handle Texture',
  type: 'deboss',
  targetPart: 'handle',
  mappingKind: 'grid',
  visible: false,
  projectionMode: 'cylindrical',
  projectionMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
  patternId: 'primary',
  maskId: null,
  depth: 0.8,
  smoothing: 0,
  tileFit: 'stretch',
  snapSeamlessWrap: true,
  columns: 8,
  rows: 4,
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  mirrorX: false,
  mirrorY: false,
};

export function defaultProject(name = '600 ml mold assembly'): ProjectSettings {
  return {
    name,
    baseMesh: { type: 'cylinder', ...DEFAULT_CYLINDER },
    operations: [
      { ...DEFAULT_PRIMARY_OPERATION },
      { ...DEFAULT_TOP_RIM_OPERATION },
      { ...DEFAULT_BOTTOM_RIM_OPERATION },
      { ...DEFAULT_HANDLE_OPERATION },
    ],
    
    // Legacy fields
    cylinder: { ...DEFAULT_CYLINDER },
    pattern: { ...DEFAULT_PATTERN },
    relief: { ...DEFAULT_RELIEF },
    
    assembly: { ...DEFAULT_ASSEMBLY },
    handleName: { ...DEFAULT_HANDLE_NAME },
    bottomLogo: { ...DEFAULT_BOTTOM_LOGO },
    quality: { ...DEFAULT_QUALITY },
    export: { ...DEFAULT_EXPORT },
  };
}

/** Spec 131: presets only ever fill in dimensions - nothing is hidden. */
export interface DimensionPreset {
  id: string;
  labelKey: string;
  cylinder: CylinderSettings;
  assembly?: Partial<MoldAssemblySettings>;
}

export const DIMENSION_PRESETS: DimensionPreset[] = [
  {
    id: 'mold600ml',
    labelKey: 'preset.mold600ml',
    // 95 mm body diameter x 105 mm pattern cylinder height (150.1 mm total mug height).
    cylinder: { diameter: 95, height: 105, boreEnabled: false, boreDiameter: 8 },
    assembly: {
      enabled: true,
      projectionTarget: 'body',
      handleExtension: 46.2,
      handleBarWidth: 12,
      handleDepth: 25,
      partGap: 0.4,
    },
  },
  {
    id: 'mold1l',
    labelKey: 'preset.mold1l',
    // 112.74 mm body diameter x 126.73 mm pattern cylinder height (178.75 mm total mug height).
    cylinder: { diameter: 112.74, height: 126.73, boreEnabled: false, boreDiameter: 8 },
    assembly: {
      enabled: true,
      projectionTarget: 'body',
      handleExtension: 58.7,
      handleBarWidth: 14,
      handleDepth: 29.7,
      partGap: 0.5,
    },
  },
];

/**
 * Playtested workflow presets for small logos, organic wave relief,
 * convex cobblestones, terraced contours, and raised stamps.
 */
export interface ReliefWorkflowPreset {
  id: string;
  labelKey: string;
  relief: Partial<ReliefSettings>;
  pattern?: Partial<PatternSettings>;
  quality?: Partial<QualitySettings>;
}

export const RELIEF_PRESETS: ReliefWorkflowPreset[] = [
  {
    id: 'intricateLogo',
    labelKey: 'preset.intricateLogo',
    relief: {
      depth: 0.4,
      direction: 'deboss',
      edgeTreatment: 'sharp',
      edgeSoftness: 0,
    },
    pattern: {
      mode: 'binary',
      tileFit: 'fit',
      quantize: 0,
    },
    quality: {
      preview: 'ultra',
      export: 'ultra',
    },
  },
  {
    id: 'organicWaves',
    labelKey: 'preset.organicWaves',
    relief: {
      depth: 1.0,
      direction: 'deboss',
      edgeTreatment: 'soft',
      edgeSoftness: 0.2,
    },
    pattern: {
      mode: 'grayscale',
      gamma: 1.0,
      blackPoint: 0.05,
      whitePoint: 0.95,
      blur: 0.5,
      quantize: 0,
    },
    quality: {
      preview: 'ultra',
      export: 'ultra',
    },
  },
  {
    id: 'pillowedCobble',
    labelKey: 'preset.pillowedCobble',
    relief: {
      depth: 1.2,
      direction: 'deboss',
      edgeTreatment: 'soft',
      edgeSoftness: 0.1,
    },
    pattern: {
      mode: 'grayscale',
      gamma: 1.8,
      blackPoint: 0.05,
      whitePoint: 0.95,
      blur: 0,
      quantize: 0,
    },
    quality: {
      preview: 'high',
      export: 'ultra',
    },
  },
  {
    id: 'terracedContours',
    labelKey: 'preset.terracedContours',
    relief: {
      depth: 0.8,
      direction: 'deboss',
      edgeTreatment: 'sharp',
      edgeSoftness: 0,
    },
    pattern: {
      mode: 'grayscale',
      gamma: 1.0,
      blackPoint: 0.0,
      whitePoint: 1.0,
      blur: 0,
      quantize: 8,
    },
    quality: {
      preview: 'ultra',
      export: 'ultra',
    },
  },
  {
    id: 'raisedBadge',
    labelKey: 'preset.raisedBadge',
    relief: {
      depth: 0.5,
      direction: 'emboss',
      edgeTreatment: 'sharp',
      edgeSoftness: 0,
    },
    pattern: {
      mode: 'binary',
      tileFit: 'fit',
      quantize: 0,
    },
    quality: {
      preview: 'ultra',
      export: 'ultra',
    },
  },
];

