# Vector Magic Desktop Integration Handoff

## Decision

This project uses the real Vector Magic Desktop application for raster-to-vector
conversion. It does not bundle a substitute tracer and it does not describe
third-party tracing code as "Vector Magic-grade".

The verified local runtime is:

```text
F:\GustavoProject\vendor\vector-magic\vmde.exe
Vector Magic Desktop Edition 1.15
47 files / 24,988,890 bytes
```

That local tree was SHA-256 compared with the Program Files installation with
zero differences and passed a native SVG round-trip. `vendor/vector-magic/` is
ignored by Git and is not emitted by the Vite build. The bundled Vector Magic
EULA permits backup copies but does not grant redistribution rights, so the
runtime must not be force-added or pushed without express authorization. The
original Program Files installation was still present at the last verification.

## Implemented flow

```text
uploaded PNG/JPG bytes
        |
        v
local Vite bridge  --->  real local vmde.exe
                              |
                      hidden Fully Automatic
                      trace + SVG export
                              |
                              v
local Vite bridge  <---  actual Vector Magic SVG
        |
        v
browser validates and rasterises the SVG at the 2048 px mask limit
        |
        v
cylindrical geometry pipeline
```

1. `src/pattern/loaders.ts` retains the original compressed upload bytes.
2. `src/pattern/vectorMagicDesktop.ts` sends native PNG/JPG files byte-for-byte
   to the local bridge. WebP and procedural sources are converted to PNG first
   because this Desktop release does not accept WebP.
3. `server/vectorMagicBridge.ts` creates an isolated job directory and starts
   `scripts/vectorMagicAutomation.ps1` with explicit input, output, status, and
   cancellation paths.
4. The helper launches the resolved `vmde.exe` hidden, targets the real Qt
   wizard window, selects Fully Automatic, completes Review Result, and opens
   Export Result. It then drives the native Windows Save dialog by control ID,
   explicitly selects `Scalable Vector Graphics (*.svg)`, and saves the file.
5. The helper writes monotonic phase/progress JSON. The browser polls the local
   bridge and shows a loading bar; no native interaction or export path is
   presented to the user.
6. Once a complete SVG exists in the isolated directory, the app imports that
   exact Vector Magic output as the active pattern and closes Desktop.

This is a desktop round-trip, not an in-browser port. A normal browser cannot
load a native Win32 executable or its DLLs as WebAssembly.

## Executable discovery

The bridge checks these locations in order:

1. `VECTOR_MAGIC_EXE` environment variable
2. `<repo>/vendor/vector-magic/vmde.exe`
3. `C:\Program Files (x86)\Vector Magic\vmde.exe`
4. `C:\Program Files\Vector Magic\vmde.exe`

Example for a custom installation in PowerShell:

```powershell
$env:VECTOR_MAGIC_EXE = 'D:\Apps\Vector Magic\vmde.exe'
npm run dev
```

The repo-local runtime is a machine-local convenience, not a distributable
project dependency. See `vendor/README.md` and the root `PUSH_HANDOFF.md`.

## Product behavior and limitations

- Vector Magic Desktop does not expose unattended SVG export as a documented
  command-line contract. This integration automates its actual Windows UI; it
  does not reimplement or substitute the tracing engine.
- Desktop is single-instance. The helper refuses to control an already-running
  Vector Magic window, so the user must close any independently opened instance
  before starting a job.
- Saving must be enabled by the user's Vector Magic licence. The trial can
  preview results but may disable saving.
- The local bridge exists in Vite's development and preview servers. A static
  deployment cannot start native desktop programs and must let the user upload
  a separately exported SVG instead.
- Vector Magic SVG is still rasterised to a 2048 px binary mask before
  mesh generation because the current cylindrical kernel consumes a sampled
  `PatternSampler`. The contour creation itself is performed only by Vector
  Magic.
- SVG is treated as untrusted input: scripts and external references are
  rejected before it is rendered as an image.

## Security boundary

- Only supported bitmap MIME types and matching file signatures are accepted.
- Requests from non-loopback network clients are rejected; only the browser on
  the same machine may start the desktop application or read a result.
- Input and SVG result sizes are capped at 50 MiB.
- Session identifiers are random UUIDs.
- Results are read only from the server-created session directory; request
  parameters can never select an arbitrary filesystem path.
- The bridge never reads activation data or product keys. It starts the
  resolved local executable and reads only the SVG written into its isolated
  job directory.

## Verification checklist

```bash
npm run typecheck
npm test
npm run fixtures
npm run build
```

Native automatic acceptance test:

1. Run `npm run dev`.
2. Upload a PNG or JPG.
3. Click **Auto-vectorize with Vector Magic**.
4. Confirm that only the web loading bar is visible while the real Desktop
   process runs in the background.
5. Confirm that the source name changes to the SVG filename and that the SVG
   notice appears.
6. Confirm that `vmde.exe` exits after export.
7. Generate and export a roller, then verify the mesh is manifold.
