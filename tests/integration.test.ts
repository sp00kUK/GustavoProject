import { describe, expect, it } from 'vitest';
import { generateMoldAssembly } from '../src/geometry/assembly/generateMoldAssembly';
import { defaultProject, DIMENSION_PRESETS } from '../src/state/defaults';
import { checkerboardSampler } from '../src/pattern/procedural';
import { resolveResolution } from '../src/geometry/quality';
import { ThreeMFExporter } from '../src/exporters/threemf';
import { STLExporter } from '../src/exporters/stl';
import { createZip } from '../src/exporters/zip';
import type { ProcessedPattern } from '../src/pattern/types';

const testPattern: ProcessedPattern = {
  width: 32,
  height: 32,
  mask: new Uint8Array(32 * 32).fill(200),
  binary: true,
  signature: 'test',
};

describe('End-to-End Mold Assembly and Export Workflow', () => {
  it('successfully generates and exports authentic 600ml Mold assembly', async () => {
    const project = defaultProject();
    const preset = DIMENSION_PRESETS.find((p) => p.id === 'mold600ml')!;
    Object.assign(project.cylinder, preset.cylinder);
    Object.assign(project.assembly, preset.assembly);

    project.assembly.enabled = true;
    project.assembly.projectionTarget = 'both';
    project.handleName.enabled = true;
    project.handleName.text = 'Gustavo';
    project.handleName.font = 'bold';
    project.bottomLogo.enabled = true;
    project.bottomLogo.diameter = 30;

    const res = resolveResolution(project.cylinder.diameter, project.cylinder.height, 0.4);

    const result = generateMoldAssembly({
      settings: project,
      patternSampler: checkerboardSampler(4, 8),
      handlePattern: testPattern,
      bottomLogoPattern: testPattern,
      resolution: res,
      validate: true,
    });

    expect(result.parts.length).toBe(3);
    expect(result.validation.ok).toBe(true);

    // Verify 3MF exporter
    const exporter3mf = new ThreeMFExporter();
    const blob3mf = await exporter3mf.exportParts(result.parts, { settings: project });
    expect(blob3mf.size).toBeGreaterThan(1000);

    // Verify STL exporter & ZIP creation
    const stlExporter = new STLExporter();
    const zipEntries = [];
    for (const part of result.parts) {
      const partBlob = await stlExporter.export(part.mesh, { settings: project });
      expect(partBlob.size).toBeGreaterThan(100);
      zipEntries.push({
        name: `${part.name}.stl`,
        chunks: [new Uint8Array(await partBlob.arrayBuffer())],
        compress: false as const,
      });
    }
    const zipBlob = await createZip(zipEntries);
    expect(zipBlob.size).toBeGreaterThan(1000);
  });

  it('successfully generates and exports authentic 1L Mold assembly', async () => {
    const project = defaultProject();
    const preset = DIMENSION_PRESETS.find((p) => p.id === 'mold1l')!;
    Object.assign(project.cylinder, preset.cylinder);
    Object.assign(project.assembly, preset.assembly);

    project.assembly.enabled = true;
    project.assembly.projectionTarget = 'body';
    project.handleName.enabled = true;
    project.handleName.text = 'MUG 1L';
    project.handleName.font = 'modern';
    project.bottomLogo.enabled = false;

    const res = resolveResolution(project.cylinder.diameter, project.cylinder.height, 0.4);

    const result = generateMoldAssembly({
      settings: project,
      patternSampler: checkerboardSampler(6, 12),
      handlePattern: null,
      bottomLogoPattern: null,
      resolution: res,
      validate: true,
    });

    expect(result.parts.length).toBe(2);
    expect(result.validation.ok).toBe(true);

    const exporter3mf = new ThreeMFExporter();
    const blob3mf = await exporter3mf.exportParts(result.parts, { settings: project });
    expect(blob3mf.size).toBeGreaterThan(1000);
  });
});
