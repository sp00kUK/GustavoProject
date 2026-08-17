import { describe, expect, it } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import { writeBinarySTL, STLExporter } from '../src/exporters/stl';
import { ThreeMFExporter } from '../src/exporters/threemf';
import { crc32 } from '../src/exporters/zip';
import { buildFilename } from '../src/exporters/types';
import { orientMesh } from '../src/geometry/mesh/meshOps';
import { estimateStlBytes } from '../src/geometry/quality';
import { defaultProject } from '../src/state/defaults';
import { checkerboardSampler } from '../src/pattern/procedural';
import { build } from './helpers';

const model = build(checkerboardSampler(4, 6));
const mesh = orientMesh(model.mesh, 'vertical');
const settings = defaultProject('Gauchito Roller');

describe('binary STL', () => {
  const buffer = writeBinarySTL(mesh);
  const view = new DataView(buffer);

  it('45: uses the binary layout - 84 byte header plus 50 bytes per facet', () => {
    const triangleCount = view.getUint32(80, true);
    expect(triangleCount).toBe(mesh.indices.length / 3);
    expect(buffer.byteLength).toBe(84 + triangleCount * 50);
    expect(estimateStlBytes(triangleCount)).toBe(buffer.byteLength);
  });

  it('45: is not ASCII STL', () => {
    const header = new TextDecoder().decode(new Uint8Array(buffer, 0, 6));
    expect(header.startsWith('solid')).toBe(false);
  });

  it('45: coordinates are millimetres - a 50 mm roller spans 50 units', () => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const count = view.getUint32(80, true);
    for (let t = 0; t < count; t++) {
      const base = 84 + t * 50 + 12;
      for (let v = 0; v < 3; v++) {
        const x = view.getFloat32(base + v * 12, true);
        const z = view.getFloat32(base + v * 12 + 8, true);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
    }
    expect(maxX - minX).toBeCloseTo(50, 1);
    expect(maxZ - minZ).toBeCloseTo(100, 3); // Z is the build direction
  });

  it('47/48: every facet normal is unit length and matches its winding', () => {
    const count = view.getUint32(80, true);
    let checked = 0;
    for (let t = 0; t < count; t += Math.max(1, Math.floor(count / 500))) {
      const o = 84 + t * 50;
      const n = [0, 1, 2].map((k) => view.getFloat32(o + k * 4, true));
      const p = [0, 1, 2].map((v) =>
        [0, 1, 2].map((k) => view.getFloat32(o + 12 + v * 12 + k * 4, true)),
      );
      const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
      const w = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
      const cross = [
        u[1] * w[2] - u[2] * w[1],
        u[2] * w[0] - u[0] * w[2],
        u[0] * w[1] - u[1] * w[0],
      ];
      const len = Math.hypot(...cross);
      expect(len).toBeGreaterThan(0); // no zero-area facets
      expect(Math.hypot(...n)).toBeCloseTo(1, 4);
      const dot = (n[0] * cross[0] + n[1] * cross[1] + n[2] * cross[2]) / len;
      expect(dot).toBeCloseTo(1, 3);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('48: contains no NaN or infinite coordinates', () => {
    const floats = new Float32Array(buffer, 84);
    for (let i = 0; i < floats.length; i++) {
      // The trailing attribute uint16 of each facet lands inside this view,
      // so only check the 12 real floats of each 50 byte record.
      if (i % 12.5 >= 12) continue;
      expect(Number.isFinite(floats[i])).toBe(true);
    }
  });

  it('exposes the exporter interface', async () => {
    const exporter = new STLExporter();
    const blob = await exporter.export(mesh, { settings });
    expect(exporter.extension).toBe('stl');
    expect(blob.size).toBe(buffer.byteLength);
  });
});

describe('3MF', () => {
  it('preserves separate assembly objects', async () => {
    const exporter = new ThreeMFExporter();
    const blob = await exporter.exportParts(
      [
        { id: 'body', name: 'Body', mesh },
        { id: 'handle', name: 'Handle', mesh },
      ],
      { settings },
    );
    const xml = extractEntry(new Uint8Array(await blob.arrayBuffer()), '3D/3dmodel.model');
    expect((xml.match(/<object /g) ?? []).length).toBe(2);
    expect(xml).toContain('name="Body"');
    expect(xml).toContain('name="Handle"');
    expect(xml).toContain('<item objectid="2"/>');
  });

  it('46: produces a real OPC zip, not a renamed STL', async () => {
    const blob = await new ThreeMFExporter().export(mesh, { settings });
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // Local file header signature
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // End of central directory, with three entries
    const eocd = bytes.length - 22;
    expect([...bytes.slice(eocd, eocd + 4)]).toEqual([0x50, 0x4b, 0x05, 0x06]);
    const view = new DataView(bytes.buffer);
    expect(view.getUint16(eocd + 8, true)).toBe(3);
  });

  it('46: the model part inflates to valid 3MF XML in millimetres', async () => {
    const blob = await new ThreeMFExporter().export(mesh, { settings });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const xml = extractEntry(bytes, '3D/3dmodel.model');

    expect(xml).toContain('unit="millimeter"');
    expect(xml).toContain(
      'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"',
    );
    expect(xml).toContain('<build>');
    expect(xml).toContain('<item objectid="1"/>');
    const triangles = (xml.match(/<triangle /g) ?? []).length;
    expect(triangles).toBe(mesh.indices.length / 3);
    const vertices = (xml.match(/<vertex /g) ?? []).length;
    expect(vertices).toBe(mesh.positions.length / 3);
  });

  it('163: carries project metadata', async () => {
    const blob = await new ThreeMFExporter().export(mesh, { settings });
    const xml = extractEntry(new Uint8Array(await blob.arrayBuffer()), '3D/3dmodel.model');
    expect(xml).toContain('Cylindrical Pattern Debosser');
    expect(xml).toContain('Gauchito Roller');
  });

  it('escapes XML metacharacters in the project name', async () => {
    const blob = await new ThreeMFExporter().export(mesh, {
      settings: { ...settings, name: 'A <b> & "c"' },
    });
    const xml = extractEntry(new Uint8Array(await blob.arrayBuffer()), '3D/3dmodel.model');
    expect(xml).toContain('A &lt;b&gt; &amp; &quot;c&quot;');
    expect(xml).not.toContain('<b>');
  });

  it('CRC32 matches the well-known check value', () => {
    expect(crc32([new TextEncoder().encode('123456789')])).toBe(0xcbf43926);
  });
});

describe('filenames', () => {
  it('103: are descriptive and sanitised', () => {
    expect(buildFilename(settings, 'stl')).toBe(
      'gauchito_roller_95x105mm_depth2mm_4x8.stl',
    );
  });

  it('103: strips characters that are illegal in a filename', () => {
    const name = buildFilename({ ...settings, name: '../../etc/passwd ?*' }, 'stl');
    expect(name.startsWith('etc_passwd_')).toBe(true);
    expect(name).not.toMatch(/[/\\?*:"<>|]/);
  });

  it('omits the bore segment for a solid roller', () => {
    const solid = {
      ...settings,
      cylinder: { ...settings.cylinder, boreEnabled: false },
    };
    expect(buildFilename(solid, '3mf')).not.toContain('bore');
  });
});

/** Locate a stored/deflated entry by name and return it as text. */
function extractEntry(bytes: Uint8Array, name: string): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset < bytes.length - 4 && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const entryName = new TextDecoder().decode(
      bytes.subarray(offset + 30, offset + 30 + nameLength),
    );
    const dataStart = offset + 30 + nameLength + extraLength;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);
    if (entryName === name) {
      return new TextDecoder().decode(method === 8 ? inflateRawSync(data) : data);
    }
    offset = dataStart + compressedSize;
  }
  throw new Error(`entry ${name} not found`);
}
