import type { PrintableMesh, ProjectSettings } from '../types';

export interface ExportContext {
  settings: ProjectSettings;
  onProgress?: (fraction: number) => void;
  shouldCancel?: () => boolean;
}

/**
 * Every output format implements this and nothing else, so adding a format
 * never touches the geometry kernel.
 */
export interface MeshExporter {
  readonly extension: string;
  readonly mimeType: string;
  export(mesh: PrintableMesh, context: ExportContext): Promise<Blob>;
}

/** `roller_50x100mm_depth2mm_4x8.stl` - readable, sortable, sanitised. */
export function buildFilename(settings: ProjectSettings, extension: string): string {
  const { cylinder, relief, pattern } = settings;
  const base = sanitise(settings.name || 'roller');
  const parts = [
    base,
    `${trim(cylinder.diameter)}x${trim(cylinder.height)}mm`,
    `depth${trim(relief.depth)}mm`,
    `${pattern.columns}x${pattern.rows}`,
  ];
  if (cylinder.boreEnabled) parts.splice(2, 0, `bore${trim(cylinder.boreDiameter)}mm`);
  return `${parts.join('_')}.${extension}`;
}

function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function sanitise(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'roller'
  );
}
