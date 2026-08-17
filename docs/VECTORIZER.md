# Open-source vectorization

The application uses [Vision Cortex VTracer](https://github.com/visioncortex/vtracer)
through its official `@visioncortex/vtracer` npm package. The engine is written
in Rust, runs as WebAssembly under the local Vite server, and is licensed under
MIT or Apache-2.0. It needs no desktop program, licence key, UI automation, or
cloud upload.

## Flow

```text
uploaded raster bytes
        |
        v
local /api/vectorizer/trace endpoint
        |
        v
official VTracer WASM engine
        |
        v
validated SVG -> existing safe SVG loader -> pattern mask
```

The endpoint is installed for both `vite` development and `vite preview`.
Three fabrication-oriented profiles are exposed:

- **Logo / line art:** fixed-threshold black-and-white spline tracing.
- **Drawing / scan:** adaptive thresholding for uneven paper or lighting.
- **Colour artwork:** compact poster-style colour clustering.

All profiles apply speckle filtering, curve simplification, and SVG
optimisation. The binary threshold follows the value already selected in the
pattern panel.

## Key files

- `server/vtracerBridge.ts` — local endpoint and trace profiles.
- `src/pattern/openSourceVectorizer.ts` — browser transport and source-byte handling.
- `src/components/PatternSection.tsx` — profile selection, progress, and SVG import.
- `tests/vtracerBridge.test.ts` — profile contract tests.

The maximum accepted raster payload is 25 MiB. Imported SVG still passes the
application's existing script/external-resource safety checks before it is
rasterised for mesh generation.
