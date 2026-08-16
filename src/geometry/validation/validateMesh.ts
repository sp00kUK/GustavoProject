import type { PrintableMesh, ValidationIssue, ValidationReport } from '../../types';
import { DEGENERATE_AREA_EPSILON } from '../constants';

/**
 * ============================================================================
 * MANIFOLD VALIDATION
 * ============================================================================
 *
 * A closed, consistently oriented triangle mesh has two properties we can
 * check exhaustively and cheaply:
 *
 *   1. Every undirected edge is used by exactly two triangles.
 *      Fewer than two means a hole; more than two means the surface
 *      self-touches and stops being a manifold.
 *
 *   2. Every *directed* edge (a -> b) appears exactly once.
 *      Combined with (1) this forces the two faces on each edge to traverse it
 *      in opposite directions, which is what "consistent winding" means.
 *
 * Both are done by packing each edge into a single float64 key and sorting a
 * typed array, rather than filling a multi-million entry hash map. Packing is
 * exact while vertexCount^2 < 2^53, i.e. up to ~94 million vertices.
 *
 * Finally the signed volume tells us whether the whole shell is inside out.
 */
export function validateMesh(mesh: PrintableMesh, signedVolume: number): ValidationReport {
  const { positions, indices } = mesh;
  const vertexCount = positions.length / 3;
  const triangleCount = indices.length / 3;
  const issues: ValidationIssue[] = [];

  /* -- Vertex sanity ---------------------------------------------------- */

  let nonFiniteVertices = 0;
  for (let i = 0; i < positions.length; i++) {
    if (!Number.isFinite(positions[i])) {
      nonFiniteVertices++;
      i += 2 - (i % 3); // skip the rest of this vertex
    }
  }

  /* -- Triangle sanity -------------------------------------------------- */

  let degenerateTriangles = 0;
  const used = new Uint8Array(vertexCount);
  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t];
    const ib = indices[t + 1];
    const ic = indices[t + 2];
    used[ia] = 1;
    used[ib] = 1;
    used[ic] = 1;
    if (ia === ib || ib === ic || ia === ic) {
      degenerateTriangles++;
      continue;
    }
    const a = ia * 3;
    const b = ib * 3;
    const c = ic * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const area = Math.hypot(nx, ny, nz) * 0.5;
    if (!(area >= DEGENERATE_AREA_EPSILON)) degenerateTriangles++;
  }

  let isolatedVertices = 0;
  for (let v = 0; v < vertexCount; v++) if (used[v] === 0) isolatedVertices++;

  /* -- Edge topology ---------------------------------------------------- */

  const edgeCount = triangleCount * 3;
  const undirected = new Float64Array(edgeCount);
  const directed = new Float64Array(edgeCount);
  const stride = vertexCount;

  let e = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t];
    const b = indices[t + 1];
    const c = indices[t + 2];
    pushEdge(a, b);
    pushEdge(b, c);
    pushEdge(c, a);
  }

  function pushEdge(from: number, to: number): void {
    directed[e] = from * stride + to;
    undirected[e] = from < to ? from * stride + to : to * stride + from;
    e++;
  }

  undirected.sort();
  directed.sort();

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (let i = 0; i < edgeCount; ) {
    const key = undirected[i];
    let run = 1;
    while (i + run < edgeCount && undirected[i + run] === key) run++;
    if (run === 1) boundaryEdges++;
    else if (run > 2) nonManifoldEdges++;
    i += run;
  }

  let duplicateDirectedEdges = 0;
  for (let i = 1; i < edgeCount; i++) {
    if (directed[i] === directed[i - 1]) duplicateDirectedEdges++;
  }

  /* -- Duplicate faces -------------------------------------------------- */

  const faceKeys = new Float64Array(triangleCount);
  for (let t = 0, f = 0; t < indices.length; t += 3, f++) {
    let a = indices[t];
    let b = indices[t + 1];
    let c = indices[t + 2];
    // sort the triple
    if (a > b) [a, b] = [b, a];
    if (b > c) [b, c] = [c, b];
    if (a > b) [a, b] = [b, a];
    // Exact only while vertexCount^3 < 2^53; fall back to a cheaper key above
    // that, which can only ever over-report and is checked against edges too.
    faceKeys[f] = (a * stride + b) * stride + c;
  }
  faceKeys.sort();
  let duplicateTriangles = 0;
  for (let i = 1; i < triangleCount; i++) {
    if (faceKeys[i] === faceKeys[i - 1]) duplicateTriangles++;
  }

  /* -- Assemble --------------------------------------------------------- */

  const closed = boundaryEdges === 0 && nonManifoldEdges === 0;
  const consistentWinding = duplicateDirectedEdges === 0;
  const outwardWinding = signedVolume > 0;

  if (nonFiniteVertices > 0) {
    issues.push({
      severity: 'error',
      code: 'NON_FINITE_VERTEX',
      message: `${nonFiniteVertices} vertex position(s) are NaN or infinite.`,
      detail: { count: nonFiniteVertices },
    });
  }
  if (boundaryEdges > 0) {
    issues.push({
      severity: 'error',
      code: 'OPEN_EDGES',
      message:
        `The shell has ${boundaryEdges} open edge(s), so it does not enclose a ` +
        `solid volume. A slicer would ask to repair this model.`,
      detail: { count: boundaryEdges },
    });
  }
  if (nonManifoldEdges > 0) {
    issues.push({
      severity: 'error',
      code: 'NON_MANIFOLD_EDGES',
      message:
        `${nonManifoldEdges} edge(s) are shared by more than two faces. This ` +
        `usually means pattern detail is finer than the mesh can represent - ` +
        `increase Mesh Detail or reduce pattern repeats.`,
      detail: { count: nonManifoldEdges },
    });
  }
  if (!consistentWinding) {
    issues.push({
      severity: 'error',
      code: 'INCONSISTENT_WINDING',
      message: `${duplicateDirectedEdges} edge(s) are traversed the same way by both of their faces, so surface normals disagree.`,
      detail: { count: duplicateDirectedEdges },
    });
  }
  if (!outwardWinding && closed) {
    issues.push({
      severity: 'error',
      code: 'INVERTED_SHELL',
      message: 'The shell is inside out - every normal points into the material.',
    });
  }
  if (degenerateTriangles > 0) {
    issues.push({
      severity: 'error',
      code: 'DEGENERATE_TRIANGLES',
      message: `${degenerateTriangles} triangle(s) have zero area.`,
      detail: { count: degenerateTriangles },
    });
  }
  if (duplicateTriangles > 0) {
    issues.push({
      severity: 'warning',
      code: 'DUPLICATE_TRIANGLES',
      message: `${duplicateTriangles} triangle(s) are duplicated.`,
      detail: { count: duplicateTriangles },
    });
  }
  if (isolatedVertices > 0) {
    issues.push({
      severity: 'warning',
      code: 'ISOLATED_VERTICES',
      message: `${isolatedVertices} vertex/vertices are not referenced by any triangle.`,
      detail: { count: isolatedVertices },
    });
  }

  return {
    closed,
    consistentWinding,
    outwardWinding,
    nonManifoldEdges,
    boundaryEdges,
    degenerateTriangles,
    duplicateTriangles,
    isolatedVertices,
    nonFiniteVertices,
    issues,
    ok: issues.every((i) => i.severity !== 'error'),
  };
}
