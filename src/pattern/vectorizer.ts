/**
 * Vector Magic / Potrace-style Auto-Vectorizer.
 *
 * Converts discrete binary pixel grids into smooth, sub-pixel vector contours
 * with sharp corner preservation (for star tips and lettering) and cubic Bézier
 * curve fitting (for smooth arcs and shields).
 *
 * Pure TypeScript — runs in browser, Web Worker, and Node test suites.
 */

export interface Point {
  x: number;
  y: number;
}

export interface VectorizeOptions {
  /** Curve smoothing tolerance in pixels (default: 0.8) */
  smoothness?: number;
  /** Corner threshold in degrees: angles sharper than this are kept crisp (default: 55) */
  cornerAngleDeg?: number;
  /** Minimum contour area in pixels to ignore noise (default: 3) */
  minArea?: number;
  /** Output raster resolution multiplier (default: 1, up to 2048px max) */
  outputResolution?: number;
}

export interface VectorizeResult {
  svg: string;
  pathData: string;
  mask: Uint8Array;
  width: number;
  height: number;
}

/**
 * Auto-vectorizes a binary mask (0 = white/untouched, 255 = black/carved).
 */
export function autoVectorize(
  mask: Uint8Array,
  width: number,
  height: number,
  options: VectorizeOptions = {},
): VectorizeResult {
  const {
    smoothness = 0.8,
    cornerAngleDeg = 55,
    minArea = 3,
    outputResolution,
  } = options;

  if (width < 4 || height < 4) {
    return {
      svg: '',
      pathData: '',
      mask: new Uint8Array(mask),
      width,
      height,
    };
  }

  // 1. Extract raw polygon boundary loops from the pixel grid
  const rawContours = traceBoundaryLoops(mask, width, height);

  // 2. Filter, simplify and fit smooth Bézier curves to each contour
  const cornerAngleRad = (cornerAngleDeg * Math.PI) / 180;
  const pathCommands: string[] = [];

  for (const rawContour of rawContours) {
    const area = Math.abs(polygonArea(rawContour));
    if (area < minArea) continue;

    // Douglas-Peucker simplification
    const simplified = simplifyPolygon(rawContour, Math.max(0.2, smoothness * 0.75));
    if (simplified.length < 3) continue;

    // Fit cubic Bézier spline with corner preservation
    const pathString = fitSmoothPath(simplified, cornerAngleRad);
    if (pathString) {
      pathCommands.push(pathString);
    }
  }

  const pathData = pathCommands.join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><path d="${pathData}" fill="#000000" fill-rule="evenodd"/></svg>`;

  const outW = outputResolution ? Math.min(2048, Math.max(width, outputResolution)) : width;
  const outH = outputResolution ? Math.round((outW * height) / width) : height;

  const vectorMask = rasterizeVectorPath(pathCommands, mask, width, height, outW, outH);

  return {
    svg,
    pathData,
    mask: vectorMask,
    width: outW,
    height: outH,
  };
}

/* -------------------------------------------------------------------- *
 * Step 1: Boundary Loop Tracing (Directed Edge Matching)
 * -------------------------------------------------------------------- */

interface DirectedEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function traceBoundaryLoops(mask: Uint8Array, width: number, height: number): Point[][] {
  // Edge lookup: key = (x1, y1) -> DirectedEdge
  const edgesAt = new Map<number, DirectedEdge[]>();

  function addEdge(x1: number, y1: number, x2: number, y2: number) {
    const key = y1 * (width + 1) + x1;
    let list = edgesAt.get(key);
    if (!list) {
      list = [];
      edgesAt.set(key, list);
    }
    list.push({ x1, y1, x2, y2 });
  }

  const isSolid = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return mask[y * width + x] > 127;
  };

  // Horizontal edges: between (x, y) and (x+1, y)
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x < width; x++) {
      const above = isSolid(x, y - 1);
      const below = isSolid(x, y);
      if (above !== below) {
        if (below) {
          // Solid is below: edge goes Left -> Right
          addEdge(x, y, x + 1, y);
        } else {
          // Solid is above: edge goes Right -> Left
          addEdge(x + 1, y, x, y);
        }
      }
    }
  }

  // Vertical edges: between (x, y) and (x, y+1)
  for (let x = 0; x <= width; x++) {
    for (let y = 0; y < height; y++) {
      const left = isSolid(x - 1, y);
      const right = isSolid(x, y);
      if (left !== right) {
        if (left) {
          // Solid is left: edge goes Top -> Bottom
          addEdge(x, y, x, y + 1);
        } else {
          // Solid is right: edge goes Bottom -> Top
          addEdge(x, y + 1, x, y);
        }
      }
    }
  }

  // Assemble directed edges into closed loops
  const contours: Point[][] = [];
  const visited = new Set<DirectedEdge>();

  for (const edgeList of edgesAt.values()) {
    for (const startEdge of edgeList) {
      if (visited.has(startEdge)) continue;

      const loop: Point[] = [{ x: startEdge.x1, y: startEdge.y1 }];
      let current: DirectedEdge | null = startEdge;

      while (current && !visited.has(current)) {
        visited.add(current);
        loop.push({ x: current.x2, y: current.y2 });

        if (current.x2 === startEdge.x1 && current.y2 === startEdge.y1) {
          // Closed loop
          break;
        }

        const nextKey = current.y2 * (width + 1) + current.x2;
        const candidates = edgesAt.get(nextKey);
        let nextEdge: DirectedEdge | null = null;

        if (candidates) {
          for (const cand of candidates) {
            if (!visited.has(cand)) {
              nextEdge = cand;
              break;
            }
          }
        }
        current = nextEdge;
      }

      if (loop.length >= 4) {
        // Remove duplicate closing point for polygon processing
        loop.pop();
        contours.push(loop);
      }
    }
  }

  return contours;
}

/* -------------------------------------------------------------------- *
 * Step 2: Polygon Simplification (Douglas-Peucker)
 * -------------------------------------------------------------------- */

function simplifyPolygon(points: Point[], tolerance: number): Point[] {
  if (points.length <= 3) return points;

  // Find point furthest from line between start and midpoint to split closed loop
  let maxD = -1;
  let splitIdx = 1;
  const p0 = points[0];

  for (let i = 1; i < points.length; i++) {
    const d = distSq(p0, points[i]);
    if (d > maxD) {
      maxD = d;
      splitIdx = i;
    }
  }

  const half1 = simplifyOpenPath(points.slice(0, splitIdx + 1), tolerance);
  const half2 = simplifyOpenPath(points.slice(splitIdx).concat([points[0]]), tolerance);

  half1.pop();
  half2.pop();
  return half1.concat(half2);
}

function simplifyOpenPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  const sqTol = tolerance * tolerance;
  let maxSqDist = 0;
  let index = 0;
  const p1 = points[0];
  const p2 = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const sqDist = perpendicularSqDist(points[i], p1, p2);
    if (sqDist > maxSqDist) {
      maxSqDist = sqDist;
      index = i;
    }
  }

  if (maxSqDist > sqTol) {
    const left = simplifyOpenPath(points.slice(0, index + 1), tolerance);
    const right = simplifyOpenPath(points.slice(index), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [p1, p2];
}

function perpendicularSqDist(p: Point, a: Point, b: Point): number {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distSq(p, a);

  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const projX = a.x + clampedT * dx;
  const projY = a.y + clampedT * dy;

  const rx = p.x - projX;
  const ry = p.y - projY;
  return rx * rx + ry * ry;
}

function distSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function polygonArea(points: Point[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return area / 2;
}

/* -------------------------------------------------------------------- *
 * Step 3: Curve Fitting with Corner Preservation (Bézier Splines)
 * -------------------------------------------------------------------- */

function fitSmoothPath(points: Point[], cornerThresholdRad: number): string {
  const n = points.length;
  if (n < 3) return '';

  // Classify each vertex as corner (sharp) or smooth
  const isCorner: boolean[] = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 > 1e-5 && len2 > 1e-5) {
      const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > cornerThresholdRad) {
        isCorner[i] = true;
      }
    } else {
      isCorner[i] = true;
    }
  }

  // Compute smooth tangents for non-corner points
  const tangents: Point[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (isCorner[i]) {
      tangents[i] = { x: 0, y: 0 };
    } else {
      const prev = points[(i - 1 + n) % n];
      const next = points[(i + 1) % n];
      tangents[i] = {
        x: (next.x - prev.x) / 3,
        y: (next.y - prev.y) / 3,
      };
    }
  }

  // Build SVG path commands
  const commands: string[] = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p1 = points[i];
    const p2 = points[j];

    const t1 = tangents[i];
    const t2 = tangents[j];

    if (!isCorner[i] && !isCorner[j]) {
      // Smooth curve between both points
      const c1x = p1.x + t1.x;
      const c1y = p1.y + t1.y;
      const c2x = p2.x - t2.x;
      const c2y = p2.y - t2.y;
      commands.push(
        `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
      );
    } else if (!isCorner[i] && isCorner[j]) {
      // Quadratic-like curve ending at a sharp corner
      const c1x = p1.x + t1.x;
      const c1y = p1.y + t1.y;
      commands.push(`S ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
    } else {
      // Straight segment into/out of sharp corner
      commands.push(`L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
    }
  }

  commands.push('Z');
  return commands.join(' ');
}

/* -------------------------------------------------------------------- *
 * Step 4: Rasterization of Traced Vectors
 * -------------------------------------------------------------------- */

function rasterizeVectorPath(
  pathCommands: string[],
  srcMask: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
  const n = dstW * dstH;

  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const canvas = new OffscreenCanvas(dstW, dstH);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const mask = new Uint8Array(n);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, dstW, dstH);

        ctx.save();
        ctx.scale(dstW / srcW, dstH / srcH);
        ctx.fillStyle = '#000000';

        const fullPath = new Path2D(pathCommands.join(' '));
        ctx.fill(fullPath, 'evenodd');
        ctx.restore();

        const imgData = ctx.getImageData(0, 0, dstW, dstH);
        const data = imgData.data;
        for (let i = 0; i < n; i++) {
          // Invert so black vector fill (0) becomes mask 255 (carved)
          const l = data[i * 4];
          mask[i] = l < 128 ? 255 : 0;
        }
        return mask;
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback CPU copy/resample when OffscreenCanvas is unavailable (Node.js test environment)
  if (srcW === dstW && srcH === dstH) {
    return new Uint8Array(srcMask);
  }
  const mask = new Uint8Array(n);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
      mask[y * dstW + x] = srcMask[sy * srcW + sx];
    }
  }
  return mask;
}
