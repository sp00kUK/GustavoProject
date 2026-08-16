/**
 * Core project types.
 *
 * ALL LINEAR DIMENSIONS ARE MILLIMETRES. There are no other units in this
 * codebase; if a number describes a distance, it is mm.
 *
 * Angles are degrees at the settings boundary (user-facing) and radians
 * inside the geometry kernel.
 */

export const APP_VERSION = '0.1.0';

/* ------------------------------------------------------------------ *
 * Cylinder
 * ------------------------------------------------------------------ */

export interface CylinderSettings {
  /** Outer diameter of the untouched roller body, mm. */
  diameter: number;
  /** Overall height along the Y axis, mm. */
  height: number;
  /** Whether a through-bore (axle hole) is generated. */
  boreEnabled: boolean;
  /** Bore diameter, mm. Ignored when boreEnabled is false. */
  boreDiameter: number;
}

/* ------------------------------------------------------------------ *
 * Pattern
 * ------------------------------------------------------------------ */

export type PatternMode = 'binary' | 'grayscale';

/** How a single source image is fitted into one repeat tile. */
export type TileFit = 'stretch' | 'fit' | 'fill';

/** Which rows receive the stagger offset. */
export type StaggerMode = 'none' | 'alternate' | 'every';

export interface PatternSettings {
  mode: PatternMode;

  /** Invert polarity. Default convention: black carves, white is untouched. */
  invert: boolean;

  /** Binary mode threshold on normalised luminance, 0..1. */
  threshold: number;

  /** Binary mode: remove isolated islands/holes smaller than this many px. */
  despeckle: number;

  /** Grayscale level controls, applied to normalised luminance. */
  brightness: number; // -1..1 additive
  contrast: number; //  -1..1
  gamma: number; //  0.1..5
  blackPoint: number; // 0..1
  whitePoint: number; // 0..1
  /** Gaussian-ish blur radius in source pixels. */
  blur: number;
  /** Quantise the mask into N steps. 0 = off. */
  quantize: number;

  /** How the source image maps into one tile. */
  tileFit: TileFit;

  /** Repeats around the circumference. */
  columns: number;
  /** Repeats up the height (within the usable, un-margined band). */
  rows: number;

  /** Tile-local transforms. */
  offsetX: number; // 0..1 of one tile
  offsetY: number; // 0..1 of one tile
  scaleX: number; // multiplier about tile centre
  scaleY: number;
  rotation: number; // degrees, about tile centre
  mirrorX: boolean;
  mirrorY: boolean;

  /** Brick-style row shift, 0..1 of one tile width. */
  stagger: number;
  staggerMode: StaggerMode;
}

/* ------------------------------------------------------------------ *
 * Relief
 * ------------------------------------------------------------------ */

export type ReliefDirection = 'deboss' | 'emboss';
export type EdgeTreatment = 'sharp' | 'soft';

export interface ReliefSettings {
  /** Maximum carve (or raise) distance, mm. */
  depth: number;
  direction: ReliefDirection;
  /**
   * Binary mode only. 'sharp' builds true stepped topology with vertical
   * cavity walls. 'soft' blurs the binary mask and uses continuous
   * displacement, giving rounded cavity edges.
   */
  edgeTreatment: EdgeTreatment;
  /** Radius of the soft-edge blur, mm. Only used when edgeTreatment==='soft'. */
  edgeSoftness: number;
  /** Untouched band at the bottom of the roller, mm. */
  bottomMargin: number;
  /** Untouched band at the top of the roller, mm. */
  topMargin: number;
}

/* ------------------------------------------------------------------ *
 * Quality
 * ------------------------------------------------------------------ */

export type QualityPreset = 'draft' | 'standard' | 'high' | 'ultra' | 'custom';

export interface QualitySettings {
  preview: QualityPreset;
  export: QualityPreset;
  /** Target surface sample spacing in mm, used when preset === 'custom'. */
  customSpacing: number;
}

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

export type ExportFormat = 'stl' | '3mf';

/**
 * Orientation of the cylinder axis in the *exported* file.
 *
 * Exports are Z-up because every slicer treats +Z as the build direction,
 * while the internal kernel and the WebGL viewport are Y-up. `vertical`
 * therefore means "standing on end on the bed"; the two horizontal modes lay
 * the roller down along the bed's X or Y axis.
 */
export type ExportOrientation = 'vertical' | 'horizontalX' | 'horizontalY';

export interface ExportSettings {
  format: ExportFormat;
  orientation: ExportOrientation;
}

/* ------------------------------------------------------------------ *
 * Project
 * ------------------------------------------------------------------ */

export interface ProjectSettings {
  name: string;
  cylinder: CylinderSettings;
  pattern: PatternSettings;
  relief: ReliefSettings;
  quality: QualitySettings;
  export: ExportSettings;
}

/* ------------------------------------------------------------------ *
 * Pattern sampling contract
 * ------------------------------------------------------------------ */

/**
 * The single abstraction the geometry kernel consumes.
 *
 * Anything that can answer "how deeply is this point carved?" - an uploaded
 * bitmap, a rasterised SVG, a procedural generator - implements this and the
 * mesh generators work unchanged.
 *
 * @param u cylinder parameter around the circumference, [0, 1)
 * @param v cylinder parameter up the height, [0, 1]
 * @param atTopEdge true only for the topmost vertex ring, so the sampler can
 *        return the *end* of the last tile instead of wrapping to its start
 * @returns carve mask, 0 = untouched surface, 1 = full relief depth
 */
export interface PatternSampler {
  sample(u: number, v: number, atTopEdge?: boolean): number;
}

/* ------------------------------------------------------------------ *
 * Geometry kernel I/O
 * ------------------------------------------------------------------ */

/**
 * Neutral, renderer-independent triangle mesh.
 * Positions are mm, indices reference vertex triples.
 */
export interface PrintableMesh {
  positions: Float32Array;
  indices: Uint32Array;
  /** Optional smooth/creased normals for display. Never required for export. */
  normals?: Float32Array;
}

export interface MeshStats {
  vertexCount: number;
  triangleCount: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  /** Signed volume via divergence theorem, mm^3. Positive == outward winding. */
  volume: number;
  surfaceArea: number;
  minOuterRadius: number;
  maxOuterRadius: number;
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  /** Optional machine-readable detail for auto-fix affordances. */
  detail?: Record<string, number | string>;
}

export interface ValidationReport {
  closed: boolean;
  consistentWinding: boolean;
  outwardWinding: boolean;
  nonManifoldEdges: number;
  boundaryEdges: number;
  degenerateTriangles: number;
  duplicateTriangles: number;
  isolatedVertices: number;
  nonFiniteVertices: number;
  issues: ValidationIssue[];
  ok: boolean;
}

export interface GeneratedModel {
  mesh: PrintableMesh;
  stats: MeshStats;
  validation: ValidationReport;
  resolution: { radialSegments: number; verticalSegments: number; spacingMm: number };
}
