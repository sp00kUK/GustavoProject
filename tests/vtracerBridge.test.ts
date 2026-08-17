import { describe, expect, it } from 'vitest';
import { optionsForProfile } from '../server/vtracerBridge';

describe('open-source VTracer profiles', () => {
  it('uses spline binary tracing for logos and clamps the threshold', () => {
    expect(optionsForProfile('logo', 999)).toMatchObject({
      clustering: 'bw',
      mode: 'spline',
      binaryThreshold: 255,
      optimize: 2,
    });
  });

  it('uses adaptive thresholding for uneven drawings', () => {
    expect(optionsForProfile('drawing')).toMatchObject({
      clustering: 'bw',
      adaptive: true,
      mode: 'spline',
    });
  });

  it('retains a compact colour palette for colour artwork', () => {
    expect(optionsForProfile('photo')).toMatchObject({
      clustering: 'color-cluster',
      hierarchical: 'cutout',
      maxColors: 12,
    });
  });
});
