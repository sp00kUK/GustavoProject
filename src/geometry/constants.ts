/**
 * Central tolerances for the geometry kernel.
 *
 * There is exactly one epsilon family in this codebase. Do not sprinkle
 * `+ 0.0001` anywhere; if a comparison needs slack, name the reason and use
 * one of these.
 */

/**
 * General linear tolerance in millimetres.
 *
 * Chosen relative to the working domain: parts are 1..1000 mm and positions
 * are stored as Float32 (~7 significant decimal digits), so the smallest
 * meaningful distance at 1000 mm is around 1e-4 mm. 1e-6 mm is comfortably
 * below anything a printer or slicer can resolve while staying well above
 * Float32 noise for parts up to ~100 mm.
 */
export const GEOMETRY_EPSILON = 1e-6;

/**
 * Area threshold below which a triangle is considered degenerate and is
 * dropped before export. 1e-9 mm^2 corresponds to a triangle roughly
 * 45 nm on a side - far below any physical process.
 */
export const DEGENERATE_AREA_EPSILON = 1e-9;

/**
 * Minimum wall left between the deepest carve and the bore before the app
 * refuses to export, in mm. Below this the part is not a solid any more.
 */
export const ABSOLUTE_MIN_WALL = 0.05;

/** Default wall thickness below which the app warns but still exports, mm. */
export const DEFAULT_MIN_WALL_WARNING = 1.2;

/** Lower bound on angular segments; below this a cylinder stops being round. */
export const MIN_RADIAL_SEGMENTS = 24;

/** Lower bound on vertical segments. */
export const MIN_VERTICAL_SEGMENTS = 2;

/**
 * Upper bound on either axis of the sampling grid. Guards against a user
 * typing 0.001 mm spacing on a 300 mm roller and allocating 30 GB.
 */
export const MAX_SEGMENTS_PER_AXIS = 16384;

/** Hard ceiling on generated triangles before the kernel refuses outright. */
export const MAX_TRIANGLES = 24_000_000;

/** Crease angle (degrees) used when building display normals. */
export const DEFAULT_CREASE_ANGLE = 35;

export const TWO_PI = Math.PI * 2;
