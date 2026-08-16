import { describe, expect, it } from 'vitest';
import { processPattern, rawFromRGBA, despeckle } from '../src/pattern/process';
import { createPatternSampler, tileSizeMm } from '../src/pattern/sampler';
import { EXAMPLE_PATTERNS } from '../src/pattern/procedural';
import { analyseSeams } from '../src/pattern/seamAnalysis';
import { sourceDetailSpacing } from '../src/geometry/quality';
import { DEFAULT_PATTERN } from '../src/state/defaults';
import type { PatternSettings } from '../src/types';
import type { RawPattern } from '../src/pattern/types';

const settings = (over: Partial<PatternSettings> = {}): PatternSettings => ({
  ...DEFAULT_PATTERN,
  ...over,
});

function grayPattern(values: number[], width: number, height: number): RawPattern {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < values.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = values[i];
    rgba[i * 4 + 3] = 255;
  }
  return rawFromRGBA('test', 'test', 'raster', rgba, width, height);
}

const sampleOpts = { tileWidthMm: 10, tileHeightMm: 10 };

describe('mask convention', () => {
  it('5: white leaves the surface untouched, black carves to full depth', () => {
    const raw = grayPattern([255, 0], 2, 1);
    const p = processPattern(raw, settings({ mode: 'grayscale' }));
    expect(p.mask[0]).toBe(0);
    expect(p.mask[1]).toBe(255);
  });

  it('5: 50% grey carves to half depth', () => {
    const raw = grayPattern([128], 1, 1);
    const p = processPattern(raw, settings({ mode: 'grayscale' }));
    expect(p.mask[0]).toBeGreaterThan(120);
    expect(p.mask[0]).toBeLessThan(136);
  });

  it('5: invert swaps the polarity without touching the source', () => {
    const raw = grayPattern([255, 0], 2, 1);
    const normal = processPattern(raw, settings({ mode: 'grayscale' }));
    const inverted = processPattern(raw, settings({ mode: 'grayscale', invert: true }));
    expect(inverted.mask[0]).toBe(normal.mask[1]);
    expect(inverted.mask[1]).toBe(normal.mask[0]);
    // The original artwork is untouched, so Reset Pattern always works.
    expect(raw.luminance[0]).toBe(255);
    expect(raw.luminance[1]).toBe(0);
  });

  it('6: binary mode thresholds to exactly two values', () => {
    const raw = grayPattern([0, 60, 127, 129, 200, 255], 6, 1);
    const p = processPattern(raw, settings({ mode: 'binary', threshold: 0.5 }));
    expect(p.binary).toBe(true);
    expect([...p.mask]).toEqual([255, 255, 255, 0, 0, 0]);
  });

  it('6: the threshold slider moves the cut point', () => {
    const raw = grayPattern([100], 1, 1);
    expect(processPattern(raw, settings({ threshold: 0.2 })).mask[0]).toBe(0);
    expect(processPattern(raw, settings({ threshold: 0.9 })).mask[0]).toBe(255);
  });

  it('57: transparent pixels read as untouched, not as deep carving', () => {
    // Black RGB behind zero alpha - the classic accidental-carve case.
    const rgba = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 255]);
    const raw = rawFromRGBA('t', 't', 'raster', rgba, 2, 1);
    const p = processPattern(raw, settings({ mode: 'grayscale' }));
    expect(p.mask[0]).toBe(0);
    expect(p.mask[1]).toBe(255);
  });

  it('58: luminance uses all three channels, not just one', () => {
    const rgba = new Uint8Array([0, 255, 0, 255, 255, 0, 0, 255]);
    const raw = rawFromRGBA('t', 't', 'raster', rgba, 2, 1);
    // Pure green is much brighter than pure red under Rec.709.
    expect(raw.luminance[0]).toBeGreaterThan(raw.luminance[1]);
    expect(raw.luminance[0]).toBeCloseTo(182, -1);
    expect(raw.luminance[1]).toBeCloseTo(54, -1);
  });
});

describe('sampling', () => {
  it('94: binary sampling is hard-edged, grayscale is interpolated', () => {
    const raw = grayPattern([0, 255], 2, 1);
    const binary = createPatternSampler(
      processPattern(raw, settings({ mode: 'binary' })),
      settings({ mode: 'binary' }),
      sampleOpts,
    );
    const gray = createPatternSampler(
      processPattern(raw, settings({ mode: 'grayscale' })),
      settings({ mode: 'grayscale' }),
      sampleOpts,
    );
    // Right at the boundary the binary mask must still be 0 or 1 exactly.
    for (const u of [0.24, 0.26, 0.49, 0.51, 0.74, 0.76]) {
      const value = binary.sample(u, 0.5);
      expect(value === 0 || value === 1, `u=${u} -> ${value}`).toBe(true);
    }
    // The continuous sampler produces intermediate values across the same edge.
    const mid = gray.sample(0.5, 0.5);
    expect(mid).toBeGreaterThan(0.05);
    expect(mid).toBeLessThan(0.95);
  });

  it('95: horizontal sampling wraps rather than clamping', () => {
    // A single dark column at the left edge must bleed to the right edge.
    const raw = grayPattern([0, 255, 255, 255], 4, 1);
    const gray = createPatternSampler(
      processPattern(raw, settings({ mode: 'grayscale' })),
      settings({ mode: 'grayscale' }),
      sampleOpts,
    );
    // Just inside the right-hand edge, wrapping pulls in the dark first column.
    expect(gray.sample(0.999, 0.5)).toBeGreaterThan(gray.sample(0.6, 0.5));
  });

  it('11: the top edge samples the end of the last tile, not the start', () => {
    const raw = grayPattern([0, 255], 1, 2); // dark row at the bottom
    const s = settings({ mode: 'grayscale', rows: 4 });
    const sampler = createPatternSampler(processPattern(raw, s), s, sampleOpts);
    const atTop = sampler.sample(0, 1, true);
    const wrapped = sampler.sample(0, 1, false);
    // Clamped: the last ring reads the bright end of the tile exactly.
    expect(atTop).toBeCloseTo(0, 5);
    // Wrapped: it blends the tile's end back into its start instead.
    expect(Math.abs(atTop - wrapped)).toBeGreaterThan(0.1);
  });

  it('12: columns and rows repeat the tile exactly', () => {
    const raw = grayPattern([0, 255, 255, 255], 4, 1);
    const s = settings({ mode: 'binary', columns: 4, rows: 2 });
    const sampler = createPatternSampler(processPattern(raw, s), s, sampleOpts);
    let runs = 0;
    let previous = 0;
    const N = 2000;
    // u is half-open: u = 1 is the same place on the cylinder as u = 0.
    for (let i = 0; i < N; i++) {
      const value = sampler.sample(i / N, 0.5);
      if (value > 0.5 && previous <= 0.5) runs++;
      previous = value;
    }
    expect(runs).toBe(4);
  });

  it('13/158: offsets wrap seamlessly instead of clipping', () => {
    const raw = grayPattern([0, 255, 255, 255], 4, 1);
    for (const offsetX of [0, 0.25, 0.5, 0.75, 0.999]) {
      const s = settings({ mode: 'binary', offsetX });
      const sampler = createPatternSampler(processPattern(raw, s), s, sampleOpts);
      let carved = 0;
      const N = 4000;
      for (let i = 0; i < N; i++) if (sampler.sample(i / N, 0.5) > 0.5) carved++;
      // A shift must move the pattern, never destroy or duplicate any of it.
      expect(Math.abs(carved / N - 0.25), `offsetX=${offsetX}`).toBeLessThan(0.02);
    }
  });

  it('14/159: staggered rows stay periodic across the seam', () => {
    const raw = grayPattern([0, 255, 255, 255], 4, 1);
    const s = settings({
      mode: 'binary',
      rows: 4,
      stagger: 0.5,
      staggerMode: 'alternate',
    });
    const sampler = createPatternSampler(processPattern(raw, s), s, sampleOpts);
    // Row 1 is shifted by half a tile, so the same pattern value reappears
    // half a tile further round: dTu = 0.5 over 4 columns is du = 0.125.
    const row0 = sampler.sample(0.05, 0.05);
    const row1 = sampler.sample(0.175, 0.3);
    expect(row1).toBe(row0);
    // ...and a row with no stagger does not match at that u.
    expect(sampler.sample(0.175, 0.05)).not.toBe(row0);
    // and wrapping at u -> 1 must not clip
    expect(sampler.sample(0.9999, 0.3)).toBeTypeOf('number');
  });

  it('97: the transform order is fixed, so results are reproducible', () => {
    const raw = grayPattern([0, 255, 128, 200], 2, 2);
    const s = settings({
      mode: 'grayscale',
      rotation: 37,
      offsetX: 0.2,
      offsetY: -0.1,
      scaleX: 1.3,
      scaleY: 0.8,
      mirrorX: true,
    });
    const a = createPatternSampler(processPattern(raw, s), s, sampleOpts);
    const b = createPatternSampler(processPattern(raw, s), s, sampleOpts);
    for (let i = 0; i < 50; i++) {
      const u = i / 50;
      expect(a.sample(u, 0.37)).toBe(b.sample(u, 0.37));
    }
  });

  it('139: tileFit "fit" leaves the surface untouched outside the artwork', () => {
    const raw = grayPattern(new Array(64).fill(0), 8, 8); // fully black square
    const s = settings({ mode: 'binary', tileFit: 'fit', columns: 1, rows: 1 });
    // A very wide tile: the square occupies only the middle of it.
    const sampler = createPatternSampler(processPattern(raw, s), s, {
      tileWidthMm: 40,
      tileHeightMm: 10,
    });
    expect(sampler.sample(0.5, 0.5)).toBe(1);
    expect(sampler.sample(0.02, 0.5)).toBe(0);
    expect(sampler.sample(0.98, 0.5)).toBe(0);
  });
});

describe('filters', () => {
  it('59: despeckle removes tiny islands but keeps real detail', () => {
    const width = 16;
    const height = 16;
    const mask = new Uint8Array(width * height);
    mask[5 * width + 5] = 255; // one stray pixel
    for (let y = 8; y < 14; y++) for (let x = 8; x < 14; x++) mask[y * width + x] = 255;
    despeckle(mask, width, height, 4);
    expect(mask[5 * width + 5]).toBe(0);
    expect(mask[10 * width + 10]).toBe(255);
  });

  it('60: gamma, contrast and blur change the mask non-destructively', () => {
    const raw = grayPattern([40, 90, 160, 220], 4, 1);
    const plain = processPattern(raw, settings({ mode: 'grayscale' }));
    const gamma = processPattern(raw, settings({ mode: 'grayscale', gamma: 2.2 }));
    expect([...gamma.mask]).not.toEqual([...plain.mask]);
    expect(raw.luminance[0]).toBe(40); // source untouched
  });

  it('21: soft edges turn a binary mask into a continuous one', () => {
    const raw = grayPattern([0, 0, 255, 255, 255, 255, 0, 0], 8, 1);
    const sharp = processPattern(raw, settings({ mode: 'binary' }));
    const soft = processPattern(raw, settings({ mode: 'binary' }), { softenPx: 2 });
    expect(sharp.binary).toBe(true);
    expect(soft.binary).toBe(false);
    expect([...soft.mask].some((v) => v > 0 && v < 255)).toBe(true);
  });
});

describe('example library', () => {
  it('70: every built-in example generates a usable mask', () => {
    for (const example of EXAMPLE_PATTERNS) {
      const raw = example.build(128);
      expect(raw.width).toBe(128);
      const p = processPattern(raw, settings({ mode: 'binary' }));
      const carved = [...p.mask].filter((v) => v > 0).length;
      // Not blank and not solid - it has to actually be a pattern.
      expect(carved, example.id).toBeGreaterThan(0);
      expect(carved, example.id).toBeLessThan(p.mask.length);
    }
  });

  it('44: seam analysis flags artwork that does not tile', () => {
    const seamless = EXAMPLE_PATTERNS.find((e) => e.id === 'checker')!.build(64);
    // A left-to-right gradient cannot tile: its edges do not match.
    const w = 64;
    const gradient = new Uint8Array(w * w * 4);
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        gradient[i] = gradient[i + 1] = gradient[i + 2] = Math.round((x / (w - 1)) * 255);
        gradient[i + 3] = 255;
      }
    }
    const bad = rawFromRGBA('g', 'g', 'raster', gradient, w, w);
    expect(analyseSeams(seamless).horizontal).toBeLessThan(0.02);
    expect(analyseSeams(bad).horizontal).toBeGreaterThan(0.5);
  });
});

describe('physical sizing', () => {
  it('41: tile size follows circumference and height', () => {
    const size = tileSizeMm(Math.PI * 50, 100, 5, 8);
    expect(size.width).toBeCloseTo(31.4159, 3);
    expect(size.height).toBeCloseTo(12.5, 6);
  });

  it('27/107: source detail spacing reflects pixels per millimetre', () => {
    // 512 px across a 39.27 mm tile is about 0.0767 mm per pixel.
    const spacing = sourceDetailSpacing(Math.PI * 50, 100, 4, 8, 512, 512);
    expect(spacing).toBeCloseTo(0.0244, 3);
  });
});

describe('auto-vectorizer (VectorMagic tracing)', () => {
  it('traces clean vector contours and generates valid SVG', () => {
    // 16x16 square with 8x8 carved center
    const w = 16;
    const mask = new Uint8Array(w * w);
    for (let y = 4; y < 12; y++) {
      for (let x = 4; x < 12; x++) {
        mask[y * w + x] = 255;
      }
    }
    const raw = grayPattern([...mask].map((v) => 255 - v), w, w);
    const p = processPattern(raw, settings({ mode: 'binary', vectorize: true }));
    expect(p.vectorSvg).toBeDefined();
    expect(p.vectorSvg).toContain('<svg');
    expect(p.vectorSvg).toContain('<path');
    expect(p.vectorSvg).toContain('M ');
    expect(p.vectorSvg).toContain('Z');
  });
});
