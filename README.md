# Cylindrical Pattern Debosser

Turn 2D artwork into a printable cylindrical negative relief — terrain rollers,
clay and pottery rollers, stamps, custom grips, cylindrical molds.

Everything runs in the browser. No account, no backend, no upload: your artwork
and your model never leave the machine.

## Quickstart Guide

```bash
# 1. Clone the repository
git clone https://github.com/sp00kUK/GustavoProject.git
cd GustavoProject

# 2. Install dependencies
npm install

# 3. Start the local development server
npm run dev        # http://localhost:5173

# Verification & Build commands:
npm run test       # Run complete geometry, pattern, and exporter test suites (Vitest)
npm run build      # Compile TypeScript and bundle production web app in dist/
npm run fixtures   # Generate reference STL verification fixtures in fixtures-out/
```

---

## The one idea this project is built on

**Do not subtract a texture from a cylinder. Generate the textured cylinder.**

The usual approach — boolean-subtracting thousands of little solids from a
cylinder — is exactly what this tool avoids. Repeated CSG on detailed meshes
produces non-manifold edges, coplanar faces, inverted normals, zero-area
triangles and self-intersections, and it is slow enough to hang a browser tab.

But the final outer radius is a *known function* of position:

```
theta = 2 * pi * u
y     = -H/2 + H * v
mask  = pattern(u, v)              0 = untouched, 1 = full depth
r     = R - depth * mask           (R + depth * mask when embossing)

x = r * cos(theta)
z = r * sin(theta)
```

So the surface is emitted directly at that radius and then closed with real end
caps and a real bore wall. There is no CSG anywhere in the pipeline. That is why
it scales to millions of triangles and why exports are watertight by
construction rather than by post-hoc repair.

---

## Mask convention

```
WHITE (255)  ->  mask 0     ->  radius = R              untouched
BLACK (0)    ->  mask 1     ->  radius = R - depth      fully carved
50% grey     ->  mask 0.5   ->  half depth
```

`mask = 1 - luminance`, so dark artwork carves inward. **Invert** flips it —
nobody should have to re-edit a PNG because it came out of the wrong tool.

Luminance is Rec.709 (`0.2126R + 0.7152G + 0.0722B`) on normalised sRGB, not a
single channel. Transparent pixels are composited onto white first, so an
alpha-zero black pixel reads as *untouched* rather than as a deep pit.

---

## Coordinate system

| | |
|---|---|
| Kernel / viewport | **Y is the cylinder axis**, X/Z is the radial plane, `theta = atan2(z, x)`, model centred on the origin |
| Exported files | **Z-up**, because every slicer treats +Z as the build direction |

`orientMesh` converts between them. All three orientations are proper rotations
(det = +1), so triangle winding — and therefore every outward normal — survives
unchanged. The part is then translated so its lowest point sits at Z = 0.

> The spec called the third orientation "Horizontal Z". In a Z-up export frame
> that is the same as vertical, so it ships as **Horizontal Y**: the two ways of
> laying the roller flat on the bed.

---

## The two relief generators

### Continuous (`grayscaleRelief.ts`)

A regular `Nu x (Nv+1)` lattice, one vertex per sample, radius from the mask.
Smooth normals. Used for heightmaps, stone, erosion, organic relief.

The circumference closes because the ring index wraps *arithmetically*
(`(i + 1) % Nu`). There is no duplicated seam column anywhere — which is
precisely why there is no seam. Nothing relies on two floating-point positions
comparing equal.

### Crisp binary (`binaryRelief.ts`)

The surface is a grid of cells in `(theta, y)`. Every cell sits at exactly one of
two radii, and neighbouring cells that disagree are joined by a **real wall**:

* base cell → `r = R`
* relief cell → `r = R - depth`
* theta boundary disagrees → radial wall in a plane containing the axis
* y boundary disagrees → annular-sector wall in a horizontal plane

The result has a flat cavity floor, a flat rim and a genuine vertical step —
an engraving, not a softened bump map.

Three problems had to be solved to make that watertight:

**1. Triangle count.** Each angular column is run-length merged vertically.
Merging along y is exact (the cylinder is straight in that direction), so a
blank roller collapses to two triangles per column instead of two per cell.
Merging *around* theta is deliberately not done — that would flatten the barrel
into a coarse polygon. An 8×10 checkerboard on a 50×100 mm roller at High
quality is ~29,500 triangles, not ~1.3 million.

**2. T-junctions.** A merged face's side edges are shared with the neighbouring
column, which may change state part way up. A single long edge against a
neighbour's two short ones is a hole. So each face is emitted as a strip whose
left chain is subdivided at every transition of the column to its left, and
whose right chain at every transition of the column to its right. Faces stay
merged; only the shared boundaries gain the collinear points needed to line up.

**3. Pinches.** Where two same-level cells touch only at a corner, four faces
meet along one edge and the surface stops being a manifold. That is not a
triangulation bug — the *solid* is degenerate there, two blocks meeting at a
knife point — so the fix has to change the shape. One of the two diagonal relief
cells is filled back to base level. The pass only ever removes relief cells, so
it is monotone and terminates; at export resolutions the altered cell is a
fraction of a millimetre. Anything that survives is reported, not hidden.

### End caps

The rim of a binary cap is a staircase, and triangulating that straight to the
bore leaves T-junctions where neighbouring sectors disagree about how far their
shared radial edge extends. So the rim is first bridged down to a **collar ring**
at the lowest radius present, and the collar — a clean regular polygon — is what
joins the bore. The collar band's side edges land exactly on the bottom/top edges
of the cavity walls. When the whole rim is at one radius the collar coincides
with it and no extra geometry is produced at all.

This is why a recess can run right off the top or bottom face and the model stays
closed (spec test 173).

### Bore

Real geometry, not a subtraction: an inward-facing cylindrical surface with the
caps as annuli terminating on it. Normals point **toward the axis**, because
"outward from the material" for a hole means into the empty space. Getting this
backwards is the most common cause of a slicer demanding repair, so the winding
is derived in the source rather than guessed.

---

## UV transform order

Fixed, documented, never reordered — so adjusting rotation never silently
changes what offset means, and two users with the same numbers get the same
geometry.

```
 1. cylinder UV      u around circumference, v up the usable height
 2. repetition       tu = u * columns,  tv = v * rows
 3. stagger          odd (or every) tile row shifted along tu
 4. tile-local       pu = frac(tu), pv = frac(tv)
 5. scale            about the tile centre
 6. rotation         about the tile centre
 7. offset           translation within the tile
 8. mirror           per axis
 9. tile fit         stretch / fit / fill
10. sample           nearest (binary) or bilinear (grayscale), wrapping
```

Polarity, thresholding and levels are baked into the mask by `processPattern`
beforehand. Interpolating a binary mask would soften every cavity wall, so
binary mode samples nearest-neighbour on an already-thresholded mask.

Horizontal sampling **wraps**, never clamps — sampling just left of pixel 0 must
return the right-hand edge, or the pattern smears at every tile boundary and at
the 0/360 seam. On the topmost vertex ring the vertical axis clamps instead, so
the last ring reads the *end* of the final tile rather than wrapping back to its
start.

Vertical margins are handled in `ReliefField`: the pattern's `v` is stretched
across the *usable* band between the margins, so `rows = 8` always gives eight
whole visible tiles rather than eight with the first and last partly hidden.

---

## Quality

Quality is a **physical sample spacing**, not a segment count — a 20 mm roller
and a 200 mm roller need very different segment counts to look equally smooth,
and "0.25 mm sampling" is something a 3D-printing user can reason about.

| Preset | Spacing |
|---|---|
| Draft | 1.0 mm |
| Standard | 0.5 mm |
| High | 0.25 mm |
| Ultra | 0.15 mm |

```
radialSegments   = ceil(pi * D / spacing)
verticalSegments = ceil(H / spacing)
```

Preview and export quality are independent. If the artwork contains finer detail
than the mesh can carry, the app says so rather than silently discarding it.

---

## Validation

Run on every generation, before the model is ever called ready.

1. **Every undirected edge is used by exactly two triangles.** Fewer means a
   hole; more means the surface self-touches.
2. **Every directed edge appears exactly once.** Combined with (1) this forces
   the two faces on each edge to traverse it in opposite directions — that is
   what consistent winding means.
3. Signed volume is positive, i.e. the shell is not inside out.
4. No zero-area faces, no NaN/infinite coordinates, no isolated vertices, no
   duplicate faces.

Both edge checks pack each edge into a single float64 key and sort a typed array
rather than filling a multi-million-entry hash map. Packing is exact while
`vertexCount² < 2^53`, i.e. up to ~94 million vertices.

**The bar is not "a slicer can repair the STL". It is "a slicer does not need
to."** Slicer repair is a last safety net, not part of this pipeline.

Geometry is also constrained before it is built: if `R - depth` reaches the bore,
export is blocked with the maximum safe depth stated and a one-click fix, rather
than producing a model that is not a solid.

---

## Architecture

```
src/
  types/          shared contracts, incl. the PatternSampler interface
  geometry/       pure TS - no React, no Three.js, no DOM, no images
    mesh/           MeshBuilder (integer-keyed vertex identity), mesh ops
    cylinder/       end caps, bore
    relief/         binary + grayscale generators, relief field
    validation/     manifold audit
    normals/        crease-aware display normals
    constraints.ts  wall thickness, safe depth, dimension summary
    quality.ts      spacing -> segments, triangle and file-size estimates
  pattern/        processing, sampler, procedural sources, loaders, seam analysis
  exporters/      binary STL, 3MF (hand-written OPC zip), filenames
  workers/        worker protocol, worker, client with job versioning
  state/          zustand store, defaults, persistence
  viewport/       imperative Three.js scene
  components/     control panels, info panels, overlays
  i18n/           en + es dictionaries, issue-code translation
```

The geometry kernel consumes exactly one abstraction:

```ts
interface PatternSampler {
  sample(u: number, v: number, atTopEdge?: boolean): number;
}
```

Raster, SVG, procedural generators and anything added later all satisfy it, and
the mesh generators work unchanged. `npm run fixtures` exercises the whole kernel
with nothing but procedural samplers — no canvas, no DOM, no image decoding.

### Worker

Image processing, mesh generation, validation and file serialisation all run off
the UI thread. Buffers come back as transferables.

* **Job versioning** — every request carries an incrementing id and any reply
  that is not the newest is dropped, so a slow Ultra preview finishing after the
  user changed the diameter can never overwrite newer geometry.
* **Cancellation by termination** — a synchronous mesh build cannot service a
  message mid-loop, and `SharedArrayBuffer` needs cross-origin isolation headers
  a static host may not provide. So the client terminates the worker and
  re-seeds a fresh one from its own cached pattern. Unconditionally reliable.
* **Caching** — the processed mask is keyed by a signature of only the inputs
  that affect it, so changing relief depth or mesh detail costs nothing on the
  image side.

### Preview vs export

The preview is **real geometry**, generated by the same kernel as the export —
just at the preview spacing. No shader displacement is ever presented as
printable geometry. Export regenerates at export quality and re-validates before
a byte is written.

---

## Export

**Binary STL** — 80-byte header, uint32 count, 50 bytes per facet. Facet normals
are recomputed from the triangle itself, never copied from a display normal. STL
carries no units, so the contract is that one unit is one millimetre: a 50 mm
roller exports with a 50-unit bounding box.

**3MF** — a genuine OPC package (`[Content_Types].xml`, `_rels/.rels`,
`3D/3dmodel.model`), zipped with a hand-written writer using the platform's
`CompressionStream`. Not an STL with the extension changed. It states its units
explicitly and shares vertices instead of repeating them per facet.

Filenames are descriptive and sanitised:
`gauchito_roller_50x100mm_bore8mm_depth2mm_4x8.stl`

---

## Security and privacy

* All processing is client-side. Nothing is uploaded.
* SVG is rasterised through an `<img>` with a blob URL, **never** by injecting
  markup into the document. As an image, scripts, external fetches and
  `foreignObject` cannot execute. The markup is additionally scanned first and
  rejected if it carries script or external references, so a hostile file fails
  loudly instead of silently rendering blank.
* Large uploads are downsampled to 2048 px with an explicit notice rather than
  failing silently — a 12000×12000 PNG is 576 MB as RGBA.
* Copy Debug Info includes dimensions and settings, never the artwork.

---

## Languages

English and Spanish, switchable in the header and remembered. Numbers are
formatted per locale (`0,80 mm` in Spanish).

The geometry kernel is locale-free by design — it emits issue *codes* plus
numeric detail, never presentation strings. The UI resolves the code against the
dictionary and formats the numbers, which is why a blocked-export message
appears fully translated.

Adding a locale: copy `src/i18n/es.ts`, translate, register it in
`src/i18n/index.ts`. Every dictionary is typed against the English one, so a
missing key is a compile error rather than a blank label.

---

## Tests

```bash
npm run test
```

* **`tests/geometry.test.ts`** — dimensional accuracy, mask polarity, tiling
  counts measured on the *mesh* (not just the sampler), seam continuity across
  0/360, end closure, bore and wall-thickness blocking, emboss, margins, export
  orientation, determinism, plus randomised property tests asserting every
  generated solid is closed, consistently wound, finite and non-degenerate.
* **`tests/pattern.test.ts`** — mask convention, threshold, transparency,
  luminance, wrap sampling, tile repetition, stagger, offsets, filters, seam
  analysis, tile sizing.
* **`tests/exporters.test.ts`** — STL layout and millimetre scale, facet normals
  agreeing with winding, 3MF unzipping to valid XML, CRC32, filenames.

`npm run fixtures` additionally writes real STL files for the reference cases
(checkerboard, sine heightmap, vertical split, seam-crossing recess, edge-
touching recesses, plain cylinder, all-black, solid, emboss) and audits each one.

### Slicer verification

The fixtures in `fixtures-out/` are intended to be opened in Bambu Studio,
OrcaSlicer, PrusaSlicer and Cura. Target: **no repair prompt, no open edges, no
non-manifold warning.** This has been verified by the automated manifold audit;
opening them in each slicer is a manual step that has not been performed here.

---

## Integration Guide

The project is structured to make it easy to extract or embed the 3D geometry engine and viewport into existing **React**, **Electron**, or **Node.js** applications.

### 1. Headless Geometry Kernel (Pure TypeScript)

The core geometry engine in `src/geometry/` has zero dependencies on React, the DOM, or Three.js. It runs in any JavaScript/TypeScript environment (Node.js, Electron main/renderer processes, Web Workers).

```ts
import { generateCylinderRelief } from './src/geometry/generateCylinderRelief';
import { checkerboardSampler } from './src/pattern/procedural';
import { writeBinarySTL } from './src/exporters/stl';

// Generate watertight cylindrical geometry
const result = generateCylinderRelief({
  cylinder: {
    diameter: 50,     // 50 mm outer diameter
    height: 100,      // 100 mm height
    boreEnabled: true,
    boreDiameter: 8,  // 8 mm shaft hole
  },
  relief: {
    depth: 2,         // 2 mm deboss depth
    direction: 'deboss',
    edgeTreatment: 'sharp',
    edgeSoftness: 0,
    bottomMargin: 2,  // 2 mm untouched safety margin at ends
    topMargin: 2,
  },
  mode: 'binary',     // 'binary' for sharp step walls, 'grayscale' for organic smooth relief
  sampler: checkerboardSampler(8, 10),
  resolution: {
    radialSegments: 315,
    verticalSegments: 200,
  },
  audit: true,        // Validates 2-manifoldness, orientation, and positive volume
});

// Export directly to a binary STL buffer (scale: 1 unit = 1 mm, Z-up)
const stlBytes = writeBinarySTL(result.mesh, 'roller');
```

### 2. Web Worker Pipeline (Non-blocking UI)

Offload intensive mesh generation and manifold validation to a Web Worker using `MeshWorkerClient`:

```ts
import { MeshWorkerClient } from './src/workers/MeshWorkerClient';

const workerClient = new MeshWorkerClient(() => {
  return new Worker(
    new URL('./src/workers/mesh.worker.ts', import.meta.url),
    { type: 'module' }
  );
});

// Request preview or export mesh asynchronously with job cancellation & caching
workerClient.requestPreview({
  cylinder,
  relief,
  pattern,
  transform,
  tiling,
  resolution,
  onSuccess: (mesh, stats, issues) => {
    // mesh contains Float32Array positions, normals, and Uint32Array indices
    console.log(`Generated ${stats.triangleCount} triangles in ${stats.buildTimeMs} ms`);
  },
  onError: (err) => console.error(err),
});
```

### 3. React / Electron 3D Viewport Component

The 3D interactive viewport can be dropped directly into any React or Electron application:

```tsx
import React from 'react';
import { Viewport } from './src/viewport/Viewport';
import { useAppStore } from './src/state/store';

export function RollerApp() {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <Viewport />
      </div>
    </div>
  );
}
```

---

## Resumen y Guía Rápida en Español (Para Gustavo)

¡Bienvenido, Gustavo! Esta sección resume los controles y parámetros principales para que puedas empezar a generar rodillos y piezas cilíndricas inmediatamente:

### 1. Parámetros del Cilindro (*Cylinder Dimensions*)
* **Diameter ($D$)**: Diámetro exterior total del cilindro en milímetros.
* **Height ($H$)**: Altura/longitud del cilindro en milímetros.
* **Bore / Orificio Central**: Diámetro del orificio interior para insertar un eje, varilla o rodamiento metálico. Si se desactiva, genera un cilindro sólido macizo.
* **Margins (Márgenes)**: Margen superior e inferior sin tallar en milímetros (ideal para crear bordes de apoyo lisos).

### 2. Modos de Relieve (*Relief Modes*)
* **Binario (*Binary*)**: Diseñado para grabados nítidos con paredes verticales y fondo de cavidad plano. Es el modo recomendado para rodillos de textura (ladrillos, adoquines, runas, logotipos) y sellos de arcilla/cerámica.
* **Escala de Grises (*Grayscale*)**: Modula el radio de forma suave y continua en función de la luminosidad del píxel. Ideal para terrenos naturales, roca, erosión, piel y texturas orgánicas.

### 3. Profundidad y Polaridad (*Depth & Polarity*)
* **Depth**: Profundidad del grabado en milímetros (el sistema bloquea automáticamente profundidades excesivas que choquen con el orificio central).
* **Direction**:
  * *Deboss (Hundido)*: Talla hacia el interior del cilindro ($R - \text{depth}$).
  * *Emboss (Relieve)*: Sobresale hacia el exterior del cilindro ($R + \text{depth}$).
* **Invert (Invertir)**: 
  * Por defecto: Color **Negro (0)** = tallado a profundidad máxima; Color **Blanco (255)** = superficie intacta.
  * Al activar *Invert*, se intercambia la polaridad sin necesidad de editar la imagen externamente.

### 4. Repetición y Ajuste UV (*Tiling & Pattern Placement*)
* **Columns / Rows (Repetición)**: Número de veces que se repite el motivo alrededor del cilindro (horizontal/circunferencia) y a lo largo de su altura (vertical).
* **Stagger (Escalonado)**: Desplaza filas alternas para crear patrones entrelazados (estilo aparejo de ladrillos o panal).
* **Rotation / Offset / Scale**: Permite rotar, centrar o ajustar la escala del motivo dentro de cada celda.

### 5. Exportación 3D (*Exporting*)
* **Formatos**:
  * **STL Binario**: Compatible con el 100% de los laminadores (1 unidad = 1 mm).
  * **3MF**: Formato moderno comprimido OPC XML que preserva unidades y reduce el peso del archivo.
* **Orientación**: Se exporta en orientación **Z-up** (con la base en Z = 0), lista para abrir en **Bambu Studio, OrcaSlicer, PrusaSlicer o Cura**.
* **Integridad Garantizada**: Cada modelo exportado pasa por una auditoría geométrica estricta de manifoldness (2-manifold estricto, normales orientadas hacia afuera, sin caras degeneradas ni huecos). ¡No requiere reparación en el laminador!

---

## Current limitations

* **End-edge bevel/chamfer is not implemented.** The spec listed it as optional
  and warned against risking manifold integrity for it in v1. Ends are sharp.
* **Vector contour geometry is not implemented.** SVG is rasterised at a chosen
  resolution and fed through the raster path. The `PatternSampler` boundary is
  the seam a future direct-triangulation backend would plug into.
* **Adaptive tessellation is not implemented** — sampling is uniform. Nothing in
  the architecture prevents adding it; the generators take a resolution, not a
  hardcoded constant.
* **Non-circular bores** (hex, square, D-shape, keyed) are not implemented.
  Circular only.
* Undo/redo covers parameter history, not the pattern bitmap.
* **3MF is capped at 4 GB** (no ZIP64). STL has no such limit.
* Binary mode with soft edges is, by definition, no longer binary — it routes
  through the continuous generator on a blurred mask. This is deliberate and
  labelled in the UI, not a fallback.

---

## Reference

[CNC Kitchen's stlTexturizer / BumpMesh](https://github.com/CNCKitchen/stlTexturizer)
solves a related but different problem: applying a displacement texture to an
*arbitrary imported mesh*, which forces adaptive subdivision plus QEM decimation
because the input topology is unknown. Here the topology is known — it is a
cylinder — so the surface is generated directly at its final radius and needs
neither subdivision nor decimation. Its crease-aware processing (>30° dihedral)
matches the approach taken in `creasedNormals.ts`. Its core technique cannot
produce flat cavity floors with vertical walls, which is the main thing binary
mode exists to do.
