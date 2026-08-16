import type { PrintableMesh } from '../types';
import { APP_VERSION } from '../types';
import type { ExportContext, MeshExporter } from './types';
import { createZip, type Bytes } from './zip';

/**
 * ============================================================================
 * 3MF
 * ============================================================================
 *
 * A genuine OPC package: [Content_Types].xml, a relationships part, and the
 * model itself, zipped. Not an STL with the extension changed.
 *
 * Unlike STL, 3MF states its units explicitly (`unit="millimeter"`), shares
 * vertices instead of repeating them per facet, and carries metadata - so it
 * is both smaller and less ambiguous. STL remains the default because it is
 * universally accepted.
 */
export class ThreeMFExporter implements MeshExporter {
  readonly extension = '3mf';
  readonly mimeType = 'model/3mf';

  async export(mesh: PrintableMesh, context: ExportContext): Promise<Blob> {
    const model = buildModelXml(mesh, context);
    const encoder = new TextEncoder();

    return createZip([
      { name: '[Content_Types].xml', chunks: [encoder.encode(CONTENT_TYPES)] },
      { name: '_rels/.rels', chunks: [encoder.encode(RELS)] },
      { name: '3D/3dmodel.model', chunks: model },
    ]);
  }
}

function buildModelXml(mesh: PrintableMesh, context: ExportContext): Bytes[] {
  const { positions, indices } = mesh;
  const encoder = new TextEncoder();
  const chunks: Bytes[] = [];
  const vertexCount = positions.length / 3;
  const triangleCount = indices.length / 3;

  const { settings } = context;
  const meta = [
    ['Application', `Cylindrical Pattern Debosser ${APP_VERSION}`],
    ['Title', settings.name],
    ['Designer', ''],
    [
      'Description',
      `Cylinder ${settings.cylinder.diameter} x ${settings.cylinder.height} mm, ` +
        `relief ${settings.relief.depth} mm ${settings.relief.direction}, ` +
        `${settings.pattern.columns} x ${settings.pattern.rows} repeats`,
    ],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `  <metadata name="${esc(k)}">${esc(v)}</metadata>`)
    .join('\n');

  chunks.push(
    encoder.encode(
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<model unit="millimeter" xml:lang="en-US" ` +
        `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n` +
        `${meta}\n` +
        ` <resources>\n  <object id="1" type="model">\n   <mesh>\n    <vertices>\n`,
    ),
  );

  // Streamed in blocks so a multi-million triangle model never materialises as
  // one enormous JavaScript string.
  const BLOCK = 8192;
  let buf: string[] = [];

  for (let v = 0; v < vertexCount; v++) {
    buf.push(
      `     <vertex x="${num(positions[v * 3])}" y="${num(positions[v * 3 + 1])}" z="${num(
        positions[v * 3 + 2],
      )}"/>\n`,
    );
    if (buf.length >= BLOCK) {
      chunks.push(encoder.encode(buf.join('')));
      buf = [];
      context.onProgress?.((v / vertexCount) * 0.4);
      if (context.shouldCancel?.()) throw new Error('Export cancelled');
    }
  }
  chunks.push(encoder.encode(buf.join('') + `    </vertices>\n    <triangles>\n`));
  buf = [];

  for (let t = 0; t < triangleCount; t++) {
    buf.push(
      `     <triangle v1="${indices[t * 3]}" v2="${indices[t * 3 + 1]}" v3="${
        indices[t * 3 + 2]
      }"/>\n`,
    );
    if (buf.length >= BLOCK) {
      chunks.push(encoder.encode(buf.join('')));
      buf = [];
      context.onProgress?.(0.4 + (t / triangleCount) * 0.5);
      if (context.shouldCancel?.()) throw new Error('Export cancelled');
    }
  }

  chunks.push(
    encoder.encode(
      buf.join('') +
        `    </triangles>\n   </mesh>\n  </object>\n </resources>\n` +
        ` <build>\n  <item objectid="1"/>\n </build>\n</model>\n`,
    ),
  );

  context.onProgress?.(0.95);
  return chunks;
}

/** Six significant digits is well under a printer's resolution at these sizes. */
function num(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : '0';
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
  `</Types>`;

const RELS =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Target="/3D/3dmodel.model" Id="rel0" ` +
  `Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>` +
  `</Relationships>`;
