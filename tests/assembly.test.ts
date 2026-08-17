import { describe, expect, it } from 'vitest';
import { generateMoldAssembly } from '../src/geometry/assembly/generateMoldAssembly';
import { computeMeshStats } from '../src/geometry/mesh/meshOps';
import { resolveResolution } from '../src/geometry/quality';
import { validateMesh } from '../src/geometry/validation/validateMesh';
import { checkerboardSampler, constantSampler } from '../src/pattern/procedural';
import { createRowPatternSampler } from '../src/pattern/sampler';
import type { ProcessedPattern } from '../src/pattern/types';
import { defaultProject, DIMENSION_PRESETS } from '../src/state/defaults';

const white: ProcessedPattern = {
  width: 4,
  height: 4,
  mask: new Uint8Array(16),
  binary: true,
  signature: 'white',
};
const black: ProcessedPattern = {
  width: 4,
  height: 4,
  mask: new Uint8Array(16).fill(255),
  binary: true,
  signature: 'black',
};

describe('authentic 600 ml and 1 L mold assemblies', () => {
  it('generates authentic 600 ml mold with base moldings, top rim, handle, text, and logo', () => {
    const settings = defaultProject('600 ml mold');
    const preset = DIMENSION_PRESETS.find((p) => p.id === 'mold600ml')!;
    Object.assign(settings.cylinder, preset.cylinder);
    Object.assign(settings.assembly, preset.assembly);

    settings.assembly.enabled = true;
    settings.assembly.projectionTarget = 'both';
    settings.handleName = { enabled: true, text: 'Gustavo', font: 'bold', depth: 0.8 };
    settings.bottomLogo.enabled = true;
    settings.bottomLogo.diameter = 32;

    const result = generateMoldAssembly({
      settings,
      patternSampler: checkerboardSampler(4, 4),
      handlePattern: black,
      bottomLogoPattern: black,
      resolution: resolveResolution(settings.cylinder.diameter, settings.cylinder.height, 0.5),
    });

    expect(result.parts.map((part) => part.id)).toEqual(['body', 'handle', 'bottomLogo']);
    expect(result.validation.ok).toBe(true);

    for (const part of result.parts) {
      const stats = computeMeshStats(part.mesh);
      const val = validateMesh(part.mesh, stats.volume);
      expect(val.ok, `${part.name} validation`).toBe(true);
      expect(val.boundaryEdges, `${part.name} boundary edges`).toBe(0);
      expect(stats.volume).toBeGreaterThan(0);
    }
  });

  it('generates authentic 1 L mold with base moldings, top rim, handle, and text', () => {
    const settings = defaultProject('1 L mold');
    const preset = DIMENSION_PRESETS.find((p) => p.id === 'mold1l')!;
    Object.assign(settings.cylinder, preset.cylinder);
    Object.assign(settings.assembly, preset.assembly);

    settings.assembly.enabled = true;
    settings.handleName = { enabled: true, text: 'Beer 1L', font: 'modern', depth: 1.0 };

    const result = generateMoldAssembly({
      settings,
      patternSampler: checkerboardSampler(6, 6),
      handlePattern: null,
      bottomLogoPattern: null,
      resolution: resolveResolution(settings.cylinder.diameter, settings.cylinder.height, 0.5),
    });

    expect(result.parts.map((part) => part.id)).toEqual(['body', 'handle']);
    expect(result.validation.ok).toBe(true);

    for (const part of result.parts) {
      const stats = computeMeshStats(part.mesh);
      const val = validateMesh(part.mesh, stats.volume);
      expect(val.ok, `${part.name} validation`).toBe(true);
      expect(stats.volume).toBeGreaterThan(0);
    }
  });

  it('sanitizes font outlines across all bundled fonts and mixed-case text without open edges', () => {
    const testCases: Array<{ text: string; font: 'modern' | 'bold' | 'classic' }> = [
      { text: 'Gustavo', font: 'bold' },
      { text: 'GUSTAVO', font: 'modern' },
      { text: 'Ceramic 2026', font: 'classic' },
      { text: 'Mold #1', font: 'bold' },
    ];

    for (const { text, font } of testCases) {
      const settings = defaultProject();
      settings.assembly.enabled = true;
      settings.handleName = { enabled: true, text, font, depth: 0.8 };

      const result = generateMoldAssembly({
        settings,
        patternSampler: constantSampler(0),
        handlePattern: null,
        bottomLogoPattern: null,
        resolution: resolveResolution(50, 100, 1),
      });

      const handlePart = result.parts.find((p) => p.id === 'handle')!;
      const stats = computeMeshStats(handlePart.mesh);
      const val = validateMesh(handlePart.mesh, stats.volume);
      expect(val.ok, `Font: ${font}, Text: ${text}`).toBe(true);
      expect(val.boundaryEdges, `Boundary edges for ${text}`).toBe(0);
    }
  });
});

describe('row-specific artwork', () => {
  it('switches source masks at exact repeat-row boundaries', () => {
    const settings = defaultProject().pattern;
    settings.rows = 2;
    settings.columns = 1;
    settings.rowPatternIds = [null, 'black'];
    const sampler = createRowPatternSampler(
      new Map([
        ['primary', white],
        ['black', black],
      ]),
      'primary',
      settings,
      { tileWidthMm: 20, tileHeightMm: 10 },
    );
    expect(sampler.sample(0.5, 0.24)).toBe(0);
    expect(sampler.sample(0.5, 0.76)).toBe(1);
    expect(sampler.sample(0.5, 1, true)).toBe(1);
  });
});
