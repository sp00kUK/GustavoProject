# Gemini Handoff — Mold Roadmap + Open-Source Vectorizer

Date: 2026-08-17 (Europe/London)  
Workspace: `F:\GustavoProject`  
Branch: `main`  
Baseline commit: `1695d0e feat(presets): add playtested relief and heightmap workflow presets (logos, waves, cobblestone, contours, stamp)`  
Current app version in the worktree: `0.2.0`  
No commit has been created for this work.

## User request

The user supplied a roadmap asking for:

1. A 600 ml mold preset.
2. A 1 L mold preset.
3. Two assembled pieces that are not fused into one mesh.
4. A selector for which piece receives the projected artwork.
5. Replacement of the broken Vector Magic integration with a very good open-source vectorizer.
6. A second, independent bottom-logo image that produces its own STL and leaves the main body intact.
7. A name on the handle with several fonts.
8. Individual artwork selection row by row.

The attached UI screenshot looked like a cylindrical body plus a handle. I interpreted “the 2 molds/models” as **body + handle**, aligned in one preview but exported as separate printable objects. Confirm this interpretation with the user if their actual intent was two mold halves.

## High-level result

The worktree now contains a broad first implementation of every roadmap item:

- 600 ml and 1 L presets.
- Optional separate body/handle assembly.
- Body / handle / both projection target.
- VTracer replacing Vector Magic.
- Independent bottom-logo stamp/insert.
- Handle name with three bundled font choices.
- Per-row artwork library and assignments.
- Separate-object exports: multi-object 3MF or ZIP of individual STLs.
- IndexedDB persistence for primary art, row art, and bottom-logo art.
- English and Spanish UI strings.
- New geometry, vectorizer, row-sampler, and exporter tests.

TypeScript, all unit tests, and the production build pass. One full browser workflow still needs diagnosis: after combining all features with complex screenshots as artwork, the 3MF export button stayed disabled (details below).

## Important interpretation and geometry caveats

These should be understood before extending the implementation:

1. **The cylindrical body remains the original relief-cylinder generator.** It is not yet a physically hollow cup or a two-part casting mold. The capacity presets use practical approximate dimensions, but the kernel does not calculate liquid volume.
2. **Body and handle are separate closed shells.** They are not welded or boolean-unioned. A small configurable gap keeps them separate in the assembled preview.
3. **Handle projection uses a closed relief plaque on the handle’s outer bar.** It does not remesh the entire C-shaped handle surface. For deboss, the plaque is modeled as a raised field with the pattern carved down into it, avoiding CSG.
4. **Handle lettering is generated with Three.js `TextGeometry`.** The text shell overlaps the handle slightly and is concatenated into the handle object; it is not boolean-unioned. The topology audit reports closed shells, but the validator does not detect shell intersections.
5. **The bottom logo is a separate circular stamp/insert below the body.** It never subtracts from or damages the body. If the user expects a keyed cavity in the body for the insert, that is not implemented yet.
6. **Project JSON files still do not embed image bytes.** Artwork persists locally in IndexedDB. This was already true for the primary pattern and now also applies to row designs and the bottom logo.

## Open-source vectorizer replacement

### Decision

Vector Magic was replaced with the official Vision Cortex VTracer package:

```json
"@visioncortex/vtracer": "^1.0.0-alpha.3"
```

Reasons:

- Official package from the VTracer project.
- MIT OR Apache-2.0.
- Rust engine compiled to WebAssembly.
- No native executable, licensed desktop install, hidden window, or UI automation.
- Supports spline fitting, binary/adaptive tracing, colour clustering, speckle removal, simplification, and SVG optimisation.

### New flow

```text
raster upload
  -> POST /api/vectorizer/trace
  -> official @visioncortex/vtracer WASM package
  -> SVG
  -> existing safe SVG loader
  -> processed mask / geometry
```

Three profiles exist:

- `logo`: fixed-threshold black/white spline tracing.
- `drawing`: adaptive black/white thresholding for scans and uneven lighting.
- `photo`: poster-style colour clustering with a compact palette.

The app’s binary threshold is sent to the logo profile. Input is capped at 25 MiB.

### New vectorizer files

- `server/vtracerBridge.ts`
- `src/pattern/openSourceVectorizer.ts`
- `docs/VECTORIZER.md`
- `tests/vtracerBridge.test.ts`

### Removed Vector Magic implementation

The following obsolete files are deleted in the worktree:

- `server/vectorMagicBridge.ts`
- `src/pattern/vectorMagicDesktop.ts`
- `scripts/vectorMagicAutomation.ps1`
- `tests/vectorMagicBridge.test.ts`
- `docs/VECTORIZER_HANDOFF.md`
- old `PUSH_HANDOFF.md`
- the entire tracked `vendor/vector-magic/` runtime (EXE, DLLs, samples, and licences)

The runtime deletion is intentional and recoverable from Git history. `vendor/README.md` now documents the open-source-only vendor policy.

### Verified vectorizer behavior

A real PNG was posted through the running endpoint and returned:

- HTTP 200
- `Content-Type: image/svg+xml; charset=utf-8`
- valid SVG with two `<path>` elements

The browser also successfully replaced a raster upload with the returned VTracer SVG and displayed “The VTracer SVG is now the active pattern.”

The Vite plugin installs the endpoint in both `configureServer` and `configurePreviewServer`. A purely static deployment of `dist/` alone will not have this endpoint; local `vite`/`vite preview` is still required for vectorization.

## Settings and data model

`src/types/index.ts` now adds:

- `PatternSettings.rowPatternIds`
- `ProjectionTarget = 'body' | 'handle' | 'both'`
- `HandleFont = 'modern' | 'bold' | 'classic'`
- `MoldAssemblySettings`
- `HandleNameSettings`
- `BottomLogoSettings`
- `ExportScope = 'assembly' | 'body' | 'handle' | 'bottomLogo'`
- `PrintablePart` / `PrintablePartId`

`ProjectSettings` now includes:

```ts
assembly: MoldAssemblySettings;
handleName: HandleNameSettings;
bottomLogo: BottomLogoSettings;
```

`APP_VERSION`, `package.json`, and `package-lock.json` are updated to `0.2.0`.

Migration in `src/state/persistence.ts` merges all new defaults and normalizes `rowPatternIds`, so old local settings should continue to load.

## Capacity presets

Added in `src/state/defaults.ts`:

### 600 ml

```ts
cylinder: { diameter: 90, height: 111, boreEnabled: false, boreDiameter: 8 }
assembly: {
  enabled: true,
  projectionTarget: 'body',
  handleExtension: 40,
  handleBarWidth: 12,
  handleDepth: 16,
  partGap: 0.4,
}
```

The comment documents an approximate 84 mm internal diameter × 108 mm usable height (~600 ml), with nominal wall allowance reflected in the outer dimensions.

### 1 L

```ts
cylinder: { diameter: 102, height: 141, boreEnabled: false, boreDiameter: 8 }
assembly: {
  enabled: true,
  projectionTarget: 'body',
  handleExtension: 48,
  handleBarWidth: 14,
  handleDepth: 20,
  partGap: 0.5,
}
```

The comment documents an approximate 96 mm internal diameter × 138 mm usable height (~1 litre).

Selecting either preset updates both cylinder and assembly settings.

## Multi-part assembly geometry

Main file:

- `src/geometry/assembly/generateMoldAssembly.ts`

It generates:

1. `body` — existing cylindrical relief mesh.
2. `handle` — watertight C/U-shaped extruded prism.
3. Optional handle artwork plaque.
4. Optional handle text geometry.
5. Optional `bottomLogo` — circular radial height-field stamp/insert.

The returned `parts` remain independent. A concatenated preview mesh is built with `mergeMeshes`, which concatenates buffers but performs no welding/boolean fusion.

`src/geometry/mesh/meshOps.ts` adds:

- `mergeMeshes`
- `orientPartsTogether`
- shared bed translation for multi-object 3MF

Three.js extrusion UV/normal attributes are discarded before positional welding. This fixed initially open handle seams caused by duplicated UV vertices.

## Handle name

UI location: nested **Handle name** section under **Mold assembly**.

Choices:

- Modern — `helvetiker_regular`
- Bold — `helvetiker_bold`
- Classic — `optimer_regular`

Maximum text length is 24 characters. The lettering is rotated vertically and fitted to the handle’s outer bar. Typeface JSON comes from `three/examples/fonts` and is bundled into the mesh worker.

## Projection target

UI location: **Mold assembly → Project artwork onto**.

Options:

- Body only
- Handle only
- Body and handle

When the body is not targeted, it receives a constant zero sampler and stays smooth. When the handle is targeted, the primary processed pattern generates the closed relief plaque.

## Row-by-row artwork

### UI

`src/components/PatternSection.tsx` contains a collapsed **Designs by row** section:

- Multi-file upload for additional PNG/JPG/WebP/SVG designs.
- Removable design library.
- One selector for each configured repeat row.
- `null` assignment means “Primary artwork”.

### Sampling

`src/pattern/sampler.ts` adds `createRowPatternSampler`.

The source is selected at exact tile-row boundaries before tile-local transforms. Existing repeat, stagger, seam, top-edge, fit/fill/stretch, and nearest/bilinear behavior is preserved.

### Worker and persistence

- Worker protocol now uploads a pattern set rather than one pattern.
- Worker caches processed masks by processing signature.
- Primary, row-library, and bottom-logo patterns are deduplicated by stable ID.
- Row designs persist under IndexedDB key `row-designs`.

## Independent bottom logo

UI location: collapsed **Independent bottom logo** section in the pattern panel.

Controls:

- Enable independent insert.
- Upload/remove separate image.
- Insert diameter.
- Plate thickness.
- Relief depth.
- Independent invert toggle.

The mesh is a circular polar height field with a closed outer wall and bottom cap. It is positioned below the body in the assembled preview and exported as `bottomLogo`.

Bottom-logo art persists under IndexedDB key `bottom-logo`.

## Export behavior

`ExportSettings.scope` and the UI support:

- Complete assembly
- Body only
- Handle only (when enabled)
- Bottom logo only (when enabled and loaded)

Behavior:

- One selected STL part -> normal binary STL.
- Complete multi-part STL -> ZIP containing one binary STL per part.
- 3MF -> one package with a separate `<object>` for each part and a build item for each object.

`src/exporters/threemf.ts` adds `exportParts`. Existing single-mesh `export` delegates to it.

The store automatically falls back from an unavailable handle/bottom-logo export scope to `body` when that feature is disabled or removed.

## State, worker, and protocol changes

Relevant files:

- `src/state/store.ts`
- `src/state/persistence.ts`
- `src/workers/protocol.ts`
- `src/workers/MeshWorkerClient.ts`
- `src/workers/mesh.worker.ts`

Notable changes:

- Store state now has `rowPatterns` and `bottomLogoPattern`.
- New actions update assembly/name/logo settings and assets.
- Worker receives `SET_PATTERNS` / `CLEAR_PATTERNS`.
- Generate request includes `bottomLogoPatternId`.
- Preview response includes `partIds`.
- Dimensions panel shows the number of separate parts.
- Export worker filters parts by scope and returns the actual filename (`.stl`, `.3mf`, or `_parts.zip`).

## UI and localization

Files:

- `src/App.tsx`
- `src/components/SettingsPanels.tsx`
- `src/components/PatternSection.tsx`
- `src/components/InfoPanels.tsx`
- `src/styles.css`
- `src/i18n/en.ts`
- `src/i18n/es.ts`

Added UI includes the assembly section, projection target, handle dimensions, handle name, vectorizer profiles, row library, row assignments, independent bottom logo, export scope, and separate-part count.

Both English and Spanish dictionaries typecheck.

## Documentation changes

- `README.md` now documents VTracer and the new roadmap features.
- `docs/VECTORIZER.md` documents the new vectorization flow and files.
- `vendor/README.md` documents that proprietary/native vectorizers must not be bundled.
- The obsolete Vector Magic and push handoff documents are deleted.

## Tests added/updated

### `tests/assembly.test.ts`

Tests:

- Body and handle remain independent closed printable objects.
- Handle name and bottom-logo insert remain topologically closed.
- Row-specific artwork switches at exact row boundaries, including the top edge.

### `tests/vtracerBridge.test.ts`

Tests profile options for logo, adaptive drawing, and colour artwork.

### `tests/exporters.test.ts`

Adds a multi-object 3MF test confirming:

- two `<object>` elements
- object names
- second build item

## Verification already completed

The following all passed after the latest implementation changes:

```text
npm run typecheck
  PASS

npm test
  5 test files passed
  73 tests passed

npm run build
  PASS
```

Build output warning only:

- Main JS chunk ~813.78 kB (gzip ~225.81 kB).
- Mesh worker ~394.12 kB.
- Vite warns that a chunk exceeds 500 kB.

The larger worker is expected partly because of bundled Three.js typeface data. Optimizing font loading is optional future work.

## Browser playtesting completed

Running dev server:

```text
http://127.0.0.1:4175
PID 4556 (node)
```

Confirmed in a clean Playwright browser:

- App loads with no page errors.
- Existing default model remains valid.
- 600 ml preset enables the assembly.
- Preview reports two separate parts for body + handle.
- Projection selector accepts body/both.
- Raster upload works.
- VTracer action performs a real trace and imports the SVG.
- Row-design upload and assignment controls are reachable.
- Bottom-logo upload increases the displayed part count to three.

## Unresolved browser issue — highest-priority next task

The final combined Playwright workflow did the following:

1. Selected 600 ml preset.
2. Selected projection target `both`.
3. Enabled handle name `Gustavo`, bold font.
4. Uploaded and VTracer-vectorized the roadmap screenshot.
5. Uploaded the large app screenshot as an alternate row design.
6. Assigned that design to row 2.
7. Uploaded the roadmap screenshot as the independent bottom logo.
8. UI displayed `Separate parts: 3`.
9. Changed export format to 3MF.

At step 9, the **Export 3MF** button remained disabled for the 30-second Playwright click timeout. The script ended before capturing whether model status was still `generating` or had become `invalid`.

This is the first thing Gemini should diagnose. Suggested approach:

1. Reproduce with simpler generated artwork first (e.g. Brick), then add features one at a time.
2. Wait explicitly for store/model status instead of using stale `Separate parts: 3` text.
3. Capture the validation panel and any worker error.
4. Test lowercase handle text (`Gustavo`) directly; the unit test currently uses uppercase `GUSTAVO`.
5. Determine whether the very detailed screenshots merely make binary preview generation slow or whether one combined shell becomes invalid.
6. Add a browser/export regression after the cause is fixed.

The relevant UI disabling condition is in `src/components/SettingsPanels.tsx`: export is disabled when status is `invalid` or `exporting`; generation may also be racing with rapid setting changes.

## Recommended next steps, in order

1. Diagnose the disabled combined export described above.
2. Add an end-to-end test for assembly STL ZIP output (entry names and binary STL headers).
3. Add an end-to-end browser test for multi-object 3MF download.
4. Confirm with the user whether “two molds” means body + handle or two physical mold halves.
5. Confirm whether 600 ml / 1 L must be true hollow vessel capacities. If yes, implement a dedicated vessel/mold kernel instead of treating them as external cylinder dimensions.
6. Confirm whether the bottom insert needs a matching keyed recess in the body. Current behavior intentionally leaves the body untouched.
7. Decide whether handle artwork/text must be true boolean-unioned geometry. Current overlapping closed-shell approach is slicer-friendly but not a mathematical union.
8. Consider embedding artwork in project files if projects need to be portable between computers.
9. Consider lazy-loading fonts or moving typeface assets into separate worker chunks.
10. Run the full tests/build again, review the large deletion list, then commit intentionally.

## Useful commands

```powershell
cd F:\GustavoProject

npm run typecheck
npm test
npm run build

# Dev server (a server is already listening on 4175 during this handoff)
npm run dev -- --host 127.0.0.1 --port 4175

git status --short
git diff --stat
git diff
```

To stop the currently running dev server if necessary:

```powershell
Stop-Process -Id 4556
```

## Worktree warning

The worktree is intentionally very dirty and includes many tracked deletions from the proprietary Vector Magic runtime. Do not reset or discard changes. Review all changes before committing, especially:

- obsolete Vector Magic deletions
- new VTracer package and server bridge
- new assembly geometry
- new worker protocol
- new persistence schema behavior
- updated export semantics

No unrelated user edits were present when this work began; the initial worktree was clean.
