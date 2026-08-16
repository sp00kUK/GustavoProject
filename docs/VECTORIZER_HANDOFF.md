# In-Browser Vectorizer Architecture & Implementation Handoff (For Codex / Engineers)

## 1. Executive Summary & Objective

When users upload raster images (such as low-resolution PNGs, JPEGs with DCT compression noise, or web logos) to the **Cylindrical Pattern Debosser**, raster thresholding alone causes visible pixelation and staircase aliasing around curved edges and delicate shapes (such as star tips, shield curves, and fine lettering).

**Core Requirement**: 
All raster images uploaded in Binary mode **must be automatically vectorised in the browser** without requiring manual toggles, converting pixel bitmaps into smooth, infinite-resolution mathematical Bézier curves while strictly preserving sharp corners and star points.

This document serves as the complete mathematical specification, architectural blueprint, and step-by-step implementation guide for **Codex** (or any autonomous agent/engineer) to maintain, optimize, or replace the vectorization engine with WebAssembly (WASM) / Rust / C++ high-performance modules.

---

## 2. Current Architecture & Pipeline Flow

The vectorization pipeline is organized as follows:

```
+---------------------+
| Uploaded PNG / JPG  |
+----------+----------+
           |
           v
+---------------------+
| Luminance & Levels  |  (Normalizes alpha over white, applies black/white points)
+----------+----------+
           |
           v
+---------------------+
| Binary Thresholding |  (Converts to 0 or 255 Uint8Array mask)
+----------+----------+
           |
           v
+---------------------+
|  autoVectorize()    |  <--- AUTOMATIC & NON-TOGGLABLE FOR ALL RASTER IMAGES
|  src/pattern/       |       1. Dual-grid boundary edge extraction
|  vectorizer.ts      |       2. Directed loop assembly (outer contours & holes)
|                     |       3. Douglas-Peucker polygon simplification
|                     |       4. Turning-angle corner detection (star preservation)
|                     |       5. C1 cubic Bézier curve fitting
|                     |       6. SVG generation & sub-pixel vector rasterization
+----------+----------+
           |
           v
+---------------------+
| ProcessedPattern    |  Contains both high-res smoothed mask and vectorSvg
+----------+----------+
           |
           v
+---------------------+
| Cylindrical Surface |  Displacement evaluated: r(u, v) = R - depth * mask(u, v)
| Geometry Kernel     |
+---------------------+
```

---

## 3. Mathematical Foundations of Vector Magic / Curve Tracing

### A. Sub-Pixel Dual-Grid Boundary Extraction
A standard pixel grid has vertices at integer coordinates $(x, y)$. The boundary edges between carved pixels ($M(x, y) = 255$) and uncarved pixels ($M(x, y) = 0$) lie on a dual grid shifted by $+0.5$:
- **Top edge**: $(x, y) \to (x + 1, y)$ when $M(x, y) = 1 \land M(x, y - 1) = 0$.
- **Right edge**: $(x + 1, y) \to (x + 1, y + 1)$ when $M(x, y) = 1 \land M(x + 1, y) = 0$.
- **Bottom edge**: $(x + 1, y + 1) \to (x, y + 1)$ when $M(x, y) = 1 \land M(x, y + 1) = 0$.
- **Left edge**: $(x, y + 1) \to (x, y)$ when $M(x, y) = 1 \land M(x - 1, y) = 0$.

All edges are directed such that the carved interior is always on the **left side** of the directed edge.

### B. Topological Loop Assembly
Directed edges are chained by endpoint matching into closed topological cycles:
- **Counter-Clockwise (CCW)** loops represent **outer boundaries** (positive area).
- **Clockwise (CW)** loops represent **interior holes** (negative area).
- SVG output uses `fill-rule="evenodd"` to automatically handle arbitrary nesting of holes within islands within holes.

### C. Turning-Angle Corner Classification
To avoid rounding off sharp star tips or logo corners, every vertex $P_i$ is evaluated against its neighbors $P_{i-1}$ and $P_{i+1}$:

$$\vec{v}_1 = \frac{P_i - P_{i-1}}{\|P_i - P_{i-1}\|}, \quad \vec{v}_2 = \frac{P_{i+1} - P_i}{\|P_{i+1} - P_i\|}$$

$$\cos \theta = \vec{v}_1 \cdot \vec{v}_2, \quad \theta = \arccos(\text{clamp}(\cos \theta, -1, 1)) \times \frac{180^\circ}{\pi}$$

* **If $\theta \ge \theta_{\text{corner}}$ (default $55^\circ$)**: Classify $P_i$ as a **sharp corner** ($C^0$ continuity). Do not blend tangents across this vertex!
* **If $\theta < \theta_{\text{corner}}$**: Classify $P_i$ as a **smooth curve point** ($C^1$ continuity).

### D. Cubic Bézier Spline Fitting
For any smooth sequence of vertices $(P_0, P_1, \dots, P_k)$, cubic Bézier control points $C_1, C_2$ between $P_i$ and $P_{i+1}$ are computed using Catmull-Rom tangent estimation:

$$\vec{t}_i = \frac{P_{i+1} - P_{i-1}}{2}, \quad \vec{t}_{i+1} = \frac{P_{i+2} - P_i}{2}$$

$$C_{1, i} = P_i + \frac{1}{3} \vec{t}_i, \quad C_{2, i} = P_{i+1} - \frac{1}{3} \vec{t}_{i+1}$$

---

## 4. WebAssembly (WASM) Upgrade Blueprint for Codex

For extreme vectorization performance on massive 4K bitmaps or multi-color clustering directly in the browser, Codex can compile a dedicated WASM engine using **Rust (`visioncortex` / `vtracer`)** or **C++ (`potrace`)**.

### Blueprint A: Rust + `vtracer` via `wasm-pack`

1. **Install `wasm-pack`**:
   ```bash
   cargo install wasm-pack
   ```

2. **Create `crates/vtracer_wasm/Cargo.toml`**:
   ```toml
   [package]
   name = "vtracer_wasm"
   version = "0.1.0"
   edition = "2021"

   [lib]
   crate-type = ["cdylib"]

   [dependencies]
   wasm-bindgen = "0.2"
   visioncortex = { git = "https://github.com/visioncortex/vtracer" }
   ```

3. **Implement `crates/vtracer_wasm/src/lib.rs`**:
   ```rust
   use wasm_bindgen::prelude::*;
   use visioncortex::ColorImage;
   use vtracer::{convert_image_to_svg, Config, ColorMode, Hierarchical};

   #[wasm_bindgen]
   pub fn trace_to_svg(
       rgba_data: &[u8],
       width: usize,
       height: usize,
       filter_speckle: usize,
       corner_threshold: f64,
   ) -> Result<String, JsValue> {
       let img = ColorImage {
           pixels: rgba_data.to_vec(),
           width,
           height,
       };
       let config = Config {
           color_mode: ColorMode::Binary,
           hierarchical: Hierarchical::Stacked,
           filter_speckle,
           corner_threshold,
           segment_length: 4.0,
           splice_threshold: 45.0,
           curve_fitting: true,
           ..Default::default()
       };
       convert_image_to_svg(&img, config)
           .map_err(|e| JsValue::from_str(&e.to_string()))
   }
   ```

4. **Compile to WASM**:
   ```bash
   wasm-pack build crates/vtracer_wasm --target web --out-dir ../../src/wasm/vtracer
   ```

5. **Consume in `src/pattern/vectorizer.ts`**:
   ```typescript
   import initVtracer, { trace_to_svg } from '../wasm/vtracer/vtracer_wasm';

   let wasmReady = false;
   export async function initWasmVectorizer(): Promise<void> {
     if (!wasmReady) {
       await initVtracer();
       wasmReady = true;
     }
   }
   ```

---

## 5. Web Worker Integration

To ensure zero UI hitching during heavy vectorization:
1. `src/workers/mesh.worker.ts` handles geometric tessellation.
2. `src/pattern/vectorizer.ts` can run inside a dedicated `vector.worker.ts` or directly within `mesh.worker.ts` using `OffscreenCanvas` for headless rasterization.

---

## 6. Verification & Test Suite

All vectorization changes must pass:
1. `npm run typecheck` (zero TypeScript errors).
2. `npm test` (`tests/pattern.test.ts`, `tests/geometry.test.ts`, `tests/exporters.test.ts`).
3. `npm run fixtures` (geometry manifoldness proofs).
