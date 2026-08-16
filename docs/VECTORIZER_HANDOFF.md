# Vector Magic In-Browser Integration & Architecture Master Handoff

> **Target Audience**: Codex, Autonomous AI Agents, and Core Systems Engineers.  
> **Mission**: Implement and run true Vector Magic-grade vectorization **flawlessly directly inside the web application**, ensuring every uploaded raster image is converted into pristine, infinite-resolution mathematical Bézier curves with zero pixel stepping, zero compression noise, and 100% preservation of sharp corners, star points, and fine text.

---

## 1. The Core Problem & Solution

### The Problem: Raster Staircasing & Compression Noise
When a user uploads a raster image (PNG, JPEG, WebP) to the Cylindrical Pattern Debosser:
1. **JPEG DCT Compression Artifacts**: Web images contain faint high-frequency compression halos ($1\text{--}5\%$ grey levels). In heightmap/grayscale or un-vectorized binary mode, these translate into rough, noisy cavity floors and jagged walls.
2. **Pixel Stepping (Aliasing)**: Low-resolution artwork (e.g. $512 \times 512\text{ px}$) mapped across a $150\text{ mm}$ roller creates visible polygon staircase steps when wrapped around the cylinder circumference.
3. **Star Tips & Corner Blunting**: Naive smoothing algorithms round off critical $30^\circ\text{--}60^\circ$ sharp tips on stars, shields, and typography.

### The Solution: Vector Magic in the Web App
Vector Magic (developed from Stanford research by James Diebel & Sebastian Thrun) uses **Minimum Description Length (MDL) image segmentation, sub-pixel edge antialiasing, and constrained Bézier spline fitting**.

By embedding this technology directly into the web application, every raster upload is automatically transformed on-the-fly into mathematical vector splines, guaranteeing **mirror-smooth flat cavity floors and vertical walls**.

---

## 2. Four Flawless Integration Strategies for Codex

Codex can execute any of the following 4 production strategies depending on deployment target:

```
+---------------------------------------------------------------------------------------------------+
|                                  INCOMING RASTER PATTERN (PNG/JPG)                                |
+---------------------------------------------------------------------------------------------------+
                                                  |
         +----------------------------------------+----------------------------------------+
         |                                        |                                        |
         v                                        v                                        v
+-----------------------+              +-----------------------+              +-----------------------+
|  STRATEGY 1 (WASM)    |              |  STRATEGY 2 (LOCAL)   |              |  STRATEGY 3 (CLOUD)   |
|  In-Browser WebAssembly|             |  Vector Magic Desktop |              |  Vector Magic Cloud   |
|  Rust/visioncortex    |              |  vmde.exe Auto-Bridge |              |  Official REST API    |
|  - 100% Client-Side   |              |  - Local C++ Engine   |              |  - Server-Side Proxy  |
|  - 0ms Latency        |              |  - Instant Desktop UI |              |  - Enterprise Grade   |
|  - Zero Server Cost   |              |  - Seamless SVG Sync  |              |  - SHA-256 Cached     |
+-----------------------+              +-----------------------+              +-----------------------+
         |                                        |                                        |
         +----------------------------------------+----------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                      STRATEGY 4 (BUILT-IN TS)                                     |
|                       Pure TypeScript Zero-Dependency Sub-Pixel Bézier Engine                     |
|                                     (Active Fallback Baseline)                                    |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                  CYLINDRICAL GEOMETRY PIPELINE                                    |
|                      Displacement Kernel: r(u, v) = R - depth * vectorMask(u, v)                  |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. STRATEGY 1: Full In-Browser WebAssembly (WASM) Engine

This is the **gold standard** for web applications: it brings full C++/Rust VectorMagic-grade segmentation directly into the browser tab via WebAssembly with zero external dependencies and zero server costs.

### A. The Engine: Rust `visioncortex` / `vtracer`
`vtracer` is an open-source raster-to-vector engine based on vision research that implements multi-scale hierarchical color clustering and spline fitting matching Vector Magic's core algorithms.

### B. Step-by-Step Implementation for Codex

#### Step 1: Initialize WASM Crate
In the repository root, create `crates/vtracer_wasm/Cargo.toml`:
```toml
[package]
name = "vtracer_wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
visioncortex = { git = "https://github.com/visioncortex/vtracer", rev = "master" }
```

#### Step 2: Implement Rust Binding (`crates/vtracer_wasm/src/lib.rs`)
```rust
use wasm_bindgen::prelude::*;
use visioncortex::ColorImage;
use visioncortex::color::Color;
use vtracer::{convert_image_to_svg, Config, ColorMode, Hierarchical};

#[wasm_bindgen]
pub struct WasmVectorizeOptions {
    pub filter_speckle: usize,
    pub corner_threshold: f64,
    pub segment_length: f64,
    pub splice_threshold: f64,
    pub curve_fitting: bool,
}

#[wasm_bindgen]
pub fn vectorize_image_rgba(
    rgba_bytes: &[u8],
    width: usize,
    height: usize,
    filter_speckle: usize,
    corner_threshold_deg: f64,
) -> Result<String, JsValue> {
    if rgba_bytes.len() != width * height * 4 {
        return Err(JsValue::from_str("Invalid RGBA buffer length"));
    }

    let img = ColorImage {
        pixels: rgba_bytes.to_vec(),
        width,
        height,
    };

    let config = Config {
        color_mode: ColorMode::Binary,
        hierarchical: Hierarchical::Stacked,
        filter_speckle: filter_speckle.max(1),
        color_precision: 8,
        layer_difference: 16,
        corner_threshold: corner_threshold_deg.to_radians(),
        segment_length: 3.5,
        splice_threshold: 45.0f64.to_radians(),
        curve_fitting: true,
        ..Default::default()
    };

    convert_image_to_svg(&img, config)
        .map_err(|e| JsValue::from_str(&format!("Vectorization failed: {}", e)))
}
```

#### Step 3: Compile WASM Module
```bash
wasm-pack build crates/vtracer_wasm --target web --out-dir ../../src/wasm/vtracer --release
```

#### Step 4: Vite WASM Support Configuration (`vite.config.ts`)
Install `vite-plugin-wasm`:
```bash
npm install -D vite-plugin-wasm vite-plugin-top-level-await
```
Update `vite.config.ts`:
```typescript
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait(), vectorMagicPlugin()],
  // ...
});
```

#### Step 5: Wire WASM into `src/pattern/vectorizer.ts`
```typescript
import initVtracer, { vectorize_image_rgba } from '../wasm/vtracer/vtracer_wasm';

let wasmLoaded = false;
let wasmInitPromise: Promise<void> | null = null;

export async function ensureWasmReady(): Promise<boolean> {
  if (wasmLoaded) return true;
  if (!wasmInitPromise) {
    wasmInitPromise = initVtracer()
      .then(() => {
        wasmLoaded = true;
      })
      .catch((err) => {
        console.warn('WASM Vectorizer failed to load, using TypeScript fallback:', err);
      });
  }
  await wasmInitPromise;
  return wasmLoaded;
}

export function autoVectorizeWithWasm(
  rgba: Uint8Array,
  width: number,
  height: number,
  options: VectorizeOptions = {},
): string | null {
  if (!wasmLoaded) return null;
  try {
    return vectorize_image_rgba(
      rgba,
      width,
      height,
      options.minArea ?? 3,
      options.cornerAngleDeg ?? 55,
    );
  } catch (e) {
    console.error('WASM vectorization error:', e);
    return null;
  }
}
```

---

## 4. STRATEGY 2: Local Vector Magic Desktop (`vmde.exe`) Bridge

For native desktop execution using the user's installed **Vector Magic Desktop Edition** (`C:\Program Files (x86)\Vector Magic\vmde.exe`):

### A. Architecture
1. The web app sends a base64/binary image buffer to the local Node/Vite bridge endpoint `/api/open-vector-magic`.
2. The server creates a temp file (`%TEMP%/vectormagic_pattern.png`) and spawns `vmde.exe` with the image argument.
3. The user makes any desired manual adjustments or presses Vector Magic's **Fully Automatic** button.
4. When saved as SVG, a file watcher immediately hot-reloads the SVG directly into the debosser viewport.

### B. Auto-Sync File Watcher Code (`vite.config.ts` backend)
```typescript
import { spawn } from 'node:child_process';
import { watch, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export function vectorMagicLiveBridge(): Plugin {
  return {
    name: 'vector-magic-live-bridge',
    configureServer(server) {
      const watchedSvg = join(tmpdir(), 'vectormagic_output.svg');

      // Watch for Vector Magic saving the SVG output
      if (existsSync(watchedSvg)) {
        watch(watchedSvg, (eventType) => {
          if (eventType === 'change') {
            server.ws.send({
              type: 'custom',
              event: 'vectormagic:svg-updated',
              data: { path: watchedSvg },
            });
          }
        });
      }
    },
  };
}
```

---

## 5. STRATEGY 3: Vector Magic Cloud API Service

For commercial cloud deployments where Vector Magic's exact proprietary server engine is desired:

### A. Vector Magic API Endpoint Spec
- **Endpoint**: `https://vectormagic.com/api/v1/vectorize`
- **Method**: `POST` (multipart/form-data)
- **Parameters**:
  - `image`: Image file bytes
  - `mode`: `logo` | `illustration` | `photo`
  - `quality`: `high`
  - `output_format`: `svg`

### B. Secure Backend Proxy Implementation (`server/vectormagic.ts`)
```typescript
import express from 'express';
import fetch from 'node-fetch';
import FormData from 'form-data';
import crypto from 'crypto';

const apiCache = new Map<string, string>(); // SHA-256 -> SVG string

export async function handleVectorMagicApi(req: express.Request, res: express.Response) {
  const { imageBuffer, apiKey } = req.body;
  
  // 1. Check SHA-256 cache to avoid API costs on identical images
  const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
  if (apiCache.has(hash)) {
    return res.json({ svg: apiCache.get(hash), cached: true });
  }

  // 2. Call official Vector Magic API
  const form = new FormData();
  form.append('image', imageBuffer, { filename: 'pattern.png' });
  form.append('output_format', 'svg');

  const response = await fetch('https://vectormagic.com/api/v1/vectorize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey || process.env.VECTOR_MAGIC_API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    return res.status(response.status).json({ error: 'Vector Magic API call failed' });
  }

  const svg = await response.text();
  apiCache.set(hash, svg);
  return res.json({ svg, cached: false });
}
```

---

## 6. STRATEGY 4: Pure TypeScript Sub-Pixel Engine (`src/pattern/vectorizer.ts`)

The active baseline is a zero-dependency, pure TypeScript implementation that runs instantly in any JavaScript environment (browsers, workers, Node.js):

### Core Algorithm Breakdown:

1. **Dual-Grid Contour Extraction**:
   Evaluates adjacent pixel pairs $(x, y)$ vs $(x+1, y)$ and $(x, y+1)$ to extract 4-neighbor boundary line segments with sub-pixel alignment $+0.5\text{ px}$.

2. **Topological Loop Assembly**:
   Chains directed segments into closed counter-clockwise (outer solid) and clockwise (inner cavity holes) loops.

3. **Douglas-Peucker Simplification**:
   Eliminates high-frequency pixel staircasing while preserving geometric structure:
   $$d = \frac{|(P_y - A_y)B_x - (P_x - A_x)B_y + B_y A_x - B_x A_y|}{\sqrt{(B_x - A_x)^2 + (B_y - A_y)^2}}$$

4. **Corner Classification & Bézier Tangent Blending**:
   Calculates the turning angle $\theta = \arccos(\hat{v}_1 \cdot \hat{v}_2)$.
   - If $\theta \ge \theta_{\text{corner}}$ ($55^\circ$): Hard corner vertex ($C^0$ continuity).
   - If $\theta < \theta_{\text{corner}}$: Smooth curve point ($C^1$ cubic Bézier fitting using Catmull-Rom tangent estimates).

5. **Direct SVG & Mask Emission**:
   Outputs both valid standard SVG `<path d="..." fill-rule="evenodd"/>` XML and hardware-accelerated anti-aliased subpixel mask buffers.

---

## 7. Quality Assurance & Regression Checklist for Codex

Before submitting changes to the vectorization pipeline:

- [ ] **Typecheck**: `npm run typecheck` passes with zero errors.
- [ ] **Unit Tests**: `npm test` passes all 67+ tests across pattern, geometry, and export suites.
- [ ] **Geometry Verification**: `npm run fixtures` verifies 9/9 manifold solid verification cases.
- [ ] **Corner Preservation**: Ensure 5-pointed star tips and serifs are sharp ($C^0$), not rounded ovals.
- [ ] **Cavity Flatness**: Verify that binary carves produce an analytically flat floor ($r = R - \text{depth}$) without ripple noise.
