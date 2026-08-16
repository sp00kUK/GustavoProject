export type PatternSourceKind = 'raster' | 'svg' | 'procedural';

/**
 * Artwork as it arrived, normalised to a single luminance plane.
 *
 * Kept immutable: every filter in the app is non-destructive and re-derives
 * `ProcessedPattern` from this, so "Reset Pattern" is always possible.
 */
export interface RawPattern {
  id: string;
  name: string;
  kind: PatternSourceKind;
  width: number;
  height: number;
  /** Rec.709 luminance, 0..255. */
  luminance: Uint8Array;
  /** Alpha channel, 0..255, or null when the source is opaque. */
  alpha: Uint8Array | null;
  /** Pixel dimensions before any downsampling, for the UI to report honestly. */
  originalWidth: number;
  originalHeight: number;
  /**
   * Original uploaded file bytes. Kept so Vector Magic Desktop receives the
   * real source artwork instead of a grayscale reconstruction. Procedural
   * patterns do not have an original file and leave these fields undefined.
   */
  sourceBytes?: Uint8Array;
  sourceMimeType?: string;
}

/**
 * Artwork after polarity, levels and thresholding have been applied.
 *
 * `mask` is the carve amount: 0 = untouched surface, 255 = full relief depth.
 * When `binary` is true every value is exactly 0 or 255, which is what lets
 * the binary relief generator use nearest-neighbour sampling and get genuinely
 * hard cavity edges instead of interpolated mush.
 */
export interface ProcessedPattern {
  width: number;
  height: number;
  mask: Uint8Array;
  binary: boolean;
  /** Hash of the inputs that produced it, for cache invalidation. */
  signature: string;
}
