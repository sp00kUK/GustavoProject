/**
 * Standalone geometry proof - spec development tasks 169 to 173.
 *
 * Runs the kernel with no React, no Three.js, no DOM and no image decoding,
 * writes real STL files, and audits every one of them. If this script does not
 * pass, nothing built on top of it is worth looking at.
 *
 *   npm run fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCylinderRelief } from '../src/geometry/generateCylinderRelief';
import { orientMesh } from '../src/geometry/mesh/meshOps';
import { resolveResolution, spacingForPreset } from '../src/geometry/quality';
import { writeBinarySTL } from '../src/exporters/stl';
import {
  checkerboardSampler,
  constantSampler,
  edgeRectangleSampler,
  seamRectangleSampler,
  sineSampler,
  verticalSplitSampler,
} from '../src/pattern/procedural';
import type {
  CylinderSettings,
  PatternMode,
  PatternSampler,
  ReliefSettings,
} from '../src/types';

const OUT = join(process.cwd(), 'fixtures-out');
mkdirSync(OUT, { recursive: true });

const cylinder: CylinderSettings = {
  diameter: 50,
  height: 100,
  boreEnabled: true,
  boreDiameter: 8,
};

const relief: ReliefSettings = {
  depth: 2,
  direction: 'deboss',
  edgeTreatment: 'sharp',
  edgeSoftness: 0,
  bottomMargin: 0,
  topMargin: 0,
};

interface Case {
  name: string;
  sampler: PatternSampler;
  mode: PatternMode;
  quality?: 'draft' | 'standard' | 'high';
  cylinder?: Partial<CylinderSettings>;
  relief?: Partial<ReliefSettings>;
  expect?: (r: ReturnType<typeof generateCylinderRelief>) => string[];
}

const cases: Case[] = [
  {
    // Task 169 - the reference model. 8 columns x 10 rows of carved cells.
    name: '169_checkerboard_8x10',
    sampler: checkerboardSampler(8, 10),
    mode: 'binary',
    quality: 'high',
    expect: (r) => {
      const out: string[] = [];
      const { min, max } = r.stats.bounds;
      if (Math.abs(max[1] - min[1] - 100) > 1e-3) out.push('height is not 100 mm');
      if (Math.abs(max[0] - 25) > 0.05) out.push('outer radius is not 25 mm');
      if (Math.abs(r.stats.minOuterRadius - 4) > 1e-3) out.push('bore is not 8 mm');
      return out;
    },
  },
  {
    // Task 170 - continuous displacement, no image parsing involved.
    name: '170_sine_heightmap',
    sampler: sineSampler(6, 8),
    mode: 'grayscale',
    quality: 'high',
  },
  {
    // Task 171 - one untouched region, one recessed region, one clean wall.
    name: '171_vertical_split',
    sampler: verticalSplitSampler(0.5),
    mode: 'binary',
    quality: 'high',
  },
  {
    // Task 172 - a recess straddling u = 0. Must be ONE continuous cavity.
    name: '172_seam_rectangle',
    sampler: seamRectangleSampler(0.1, 0.3, 0.7),
    mode: 'binary',
    quality: 'high',
  },
  {
    // Task 173 - recesses running into the top and bottom faces.
    name: '173_edge_rectangles',
    sampler: {
      sample: (u, v) => {
        const top = edgeRectangleSampler(0.1, 0.35, 0.75, 1.0).sample(u, v);
        const bottom = edgeRectangleSampler(0.55, 0.8, 0.0, 0.25).sample(u, v);
        return Math.max(top, bottom);
      },
    },
    mode: 'binary',
    quality: 'high',
  },
  {
    // Task 77 - depth 0 must give a mathematically perfect cylinder.
    name: '077_plain_cylinder',
    sampler: constantSampler(0),
    mode: 'binary',
    relief: { depth: 0 },
    quality: 'standard',
  },
  {
    // Task 78 - a fully black pattern carves the whole barrel to R - depth.
    name: '078_all_black',
    sampler: constantSampler(1),
    mode: 'binary',
    quality: 'standard',
    expect: (r) => {
      const out: string[] = [];
      const maxXZ = Math.max(Math.abs(r.stats.bounds.max[0]), Math.abs(r.stats.bounds.min[0]));
      if (Math.abs(maxXZ - 23) > 0.05) out.push(`barrel radius ${maxXZ.toFixed(3)} != 23`);
      return out;
    },
  },
  {
    // A solid roller with no bore, to exercise the centre-fan cap path.
    name: '079_solid_no_bore',
    sampler: checkerboardSampler(6, 6),
    mode: 'binary',
    cylinder: { boreEnabled: false },
    quality: 'standard',
  },
  {
    // Emboss, so the caps have to cope with a rim ABOVE the base radius.
    name: '080_emboss',
    sampler: checkerboardSampler(6, 8),
    mode: 'binary',
    relief: { direction: 'emboss' },
    quality: 'standard',
  },
];

let failures = 0;

for (const testCase of cases) {
  const cyl = { ...cylinder, ...testCase.cylinder };
  const rel = { ...relief, ...testCase.relief };
  const spacing = spacingForPreset(testCase.quality ?? 'standard', 0.5);
  const resolution = resolveResolution(cyl.diameter, cyl.height, spacing);

  const started = Date.now();
  const result = generateCylinderRelief({
    cylinder: cyl,
    relief: rel,
    mode: testCase.mode,
    patternSampler: testCase.sampler,
    resolution,
  });
  const ms = Date.now() - started;

  const oriented = orientMesh(result.mesh, 'vertical');
  const stl = writeBinarySTL(oriented);
  writeFileSync(join(OUT, `${testCase.name}.stl`), Buffer.from(stl));

  const v = result.validation;
  const problems: string[] = [];
  if (!v.closed) problems.push(`not closed (${v.boundaryEdges} open, ${v.nonManifoldEdges} non-manifold)`);
  if (!v.consistentWinding) problems.push('inconsistent winding');
  if (!v.outwardWinding) problems.push('inverted shell');
  if (v.degenerateTriangles) problems.push(`${v.degenerateTriangles} degenerate`);
  if (v.nonFiniteVertices) problems.push(`${v.nonFiniteVertices} non-finite`);
  problems.push(...(testCase.expect?.(result) ?? []));

  const b = result.stats.bounds;
  const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
    .map((n) => n.toFixed(2))
    .join(' x ');

  const status = problems.length === 0 ? 'PASS' : 'FAIL';
  if (problems.length) failures++;

  console.log(
    `${status}  ${testCase.name.padEnd(26)} ` +
      `${String(result.stats.triangleCount).padStart(9)} tris  ` +
      `${size.padStart(22)} mm  ` +
      `${String(ms).padStart(5)} ms  ` +
      `${(stl.byteLength / 1048576).toFixed(1)} MB`,
  );
  for (const p of problems) console.log(`        - ${p}`);
}

console.log(
  `\n${cases.length - failures}/${cases.length} passed. STL files written to ${OUT}`,
);
process.exit(failures ? 1 : 0);
