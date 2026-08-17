import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore, type ViewMode } from '../state/store';
import type { PrintableMesh } from '../types';
import { buildAdjacency, buildExclusionOverlayGeo, bucketFill, radiusBrushSelect, type AdjacencyData } from './exclusion';

export type CameraView = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso';

export interface ViewportHandle {
  setView: (view: CameraView) => void;
  fit: () => void;
}

interface ViewportProps {
  onReady?: (handle: ViewportHandle) => void;
  onFps?: (fps: number) => void;
  onError?: (message: string) => void;
}

/**
 * Imperative Three.js viewport.
 *
 * Deliberately not a declarative renderer wrapper: geometry arrives as raw
 * typed arrays from a worker and is swapped wholesale, so what matters is
 * precise control over when buffers are uploaded and, more importantly, when
 * the previous ones are disposed. A preview at Ultra quality is tens of
 * megabytes of GPU memory; leaking one per slider drag would exhaust a tab in
 * under a minute.
 */
export type TankardPartId = 'body' | 'topRim' | 'bottomRim' | 'handle';

export interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  solid: THREE.Mesh;
  wire: THREE.LineSegments;
  materials: Record<ViewMode, THREE.Material>;
  disposed: boolean;
  refreshOverlay?: () => void;
  invalidateAdjacency?: () => void;
}

export function Viewport({ onReady, onFps, onError }: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);

  const lastFitRadius = useRef<number | null>(null);
  const preview = useStore((s) => s.preview);
  const viewMode = useStore((s) => s.viewMode);

  /* -- Scene setup, once ------------------------------------------------ */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      onError?.('WEBGL');
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x14161a, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x14161a, 400, 1400);

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.5,
      5000,
    );
    camera.position.set(120, 90, 160);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 5;
    controls.maxDistance = 2000;

    // Studio-ish neutral lighting: a key, a fill, a rim and a soft ambient.
    // No coloured lights - the point is to read the relief, not to look pretty.
    const hemi = new THREE.HemisphereLight(0xdfe6f0, 0x20242b, 1.15);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(1, 1.5, 1.2);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(-1.2, 0.4, -0.8);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.9);
    rim.position.set(-0.4, -1, 0.6);
    scene.add(rim);

    const grid = new THREE.GridHelper(400, 40, 0x2c313a, 0x212530);
    grid.position.y = -0.01;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    scene.add(grid);

    const materials: Record<ViewMode, THREE.Material> = {
      solid: new THREE.MeshStandardMaterial({
        color: 0xa4b9d6,
        roughness: 0.62,
        metalness: 0.08,
        vertexColors: false,
        side: THREE.FrontSide,
      }),
      wireframe: new THREE.MeshStandardMaterial({
        color: 0x6a7382,
        roughness: 0.9,
        metalness: 0,
        transparent: true,
        opacity: 0.25,
      }),
      normals: new THREE.MeshNormalMaterial({ flatShading: false }),
      mask: new THREE.MeshStandardMaterial({
        color: 0xb9c0cc,
        roughness: 0.72,
        metalness: 0.04,
        vertexColors: false,
      }),
      heatmap: new THREE.MeshStandardMaterial({
        color: 0xa4b9d6,
        roughness: 0.62,
        metalness: 0.08,
        vertexColors: false,
      }),
    };

    const solid = new THREE.Mesh(new THREE.BufferGeometry(), materials.solid);
    scene.add(solid);

    const wire = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x63d0ff, transparent: true, opacity: 0.45 }),
    );
    wire.visible = false;
    scene.add(wire);

    const state: SceneState = {
      renderer,
      scene,
      camera,
      controls,
      solid,
      wire,
      materials,
      disposed: false,
    };
    stateRef.current = state;

    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let frame = 0;
    let frames = 0;
    let fpsClock = performance.now();
    const animate = () => {
      if (state.disposed) return;
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);

      frames++;
      const now = performance.now();
      if (now - fpsClock >= 1000) {
        onFps?.(Math.round((frames * 1000) / (now - fpsClock)));
        frames = 0;
        fpsClock = now;
      }
    };
    animate();

    onReady?.({
      setView: (view) => setCameraView(state, view),
      fit: () => fitCamera(state),
    });

    /* -- Pointer interaction for 3D Mask Painting & Tools ------------- */
    /* Ported 1:1 from Bumpmesh (stlTexturizer): uses face-index Sets,
       BFS flood fill with dihedral angle adjacency, and a separate
       overlay mesh for visualisation.                                  */
    const raycaster = new THREE.Raycaster();
    const ndcResult = new THREE.Vector2();
    let isPainting = false;
    let adjacencyData: AdjacencyData | null = null;
    let exclusionOverlayMesh: THREE.Mesh | null = null;
    const exclMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const brushCursorGeo = new THREE.EdgesGeometry(new THREE.CircleGeometry(1, 64));
    const brushCursorMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      depthTest: false
    });
    const brushCursor = new THREE.LineSegments(brushCursorGeo, brushCursorMat);
    brushCursor.renderOrder = 999;
    brushCursor.visible = false;
    scene.add(brushCursor);

    const canvasNDC = (e: MouseEvent | PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndcResult.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        ((e.clientY - rect.top) / rect.height) * -2 + 1,
      );
      return ndcResult;
    };



    /**
     * Get the front-face hit (face normal pointing toward camera).
     * Mirrors Bumpmesh's getFrontFaceHit — needed because DoubleSide
     * materials can return back-face hits that are closer.
     */
    const getFrontFaceHit = (hits: THREE.Intersection[]) => {
      // NOTE: For hollow cylinders (or if camera is inside?), normal might point opposite of what we expect
      // If backface culling is off, we must ensure we only pick front faces.
      // But we just use the first hit, except we filter out hits where normal is pointing away.
      if (!hits.length) return undefined;
      const mesh = stateRef.current?.solid;
      if (!mesh) return hits[0];
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
      for (const h of hits) {
        if (h.face) {
          const worldNormal = h.face.normal.clone().applyMatrix3(normalMatrix).normalize();
          if (worldNormal.dot(raycaster.ray.direction) < 0) {
            return h;
          }
        }
      }
      return hits[0];
    };

    const pickTriangle = (e: MouseEvent | PointerEvent): number => {
      const mesh = stateRef.current?.solid;
      if (!mesh) return -1;
      raycaster.setFromCamera(canvasNDC(e), stateRef.current!.camera);
      const hits = raycaster.intersectObject(mesh);
      const hit = getFrontFaceHit(hits);
      if (!hit || hit.faceIndex == null) return -1;
      return hit.faceIndex;
    };

    const refreshOverlay = () => {
      const mesh = stateRef.current?.solid;
      if (!mesh) return;
      const geo = mesh.geometry;
      const faces = useStore.getState().excludedFaces;

      // Remove old overlay
      if (exclusionOverlayMesh) {
        scene.remove(exclusionOverlayMesh);
        exclusionOverlayMesh.geometry.dispose();
        exclusionOverlayMesh = null;
      }

      if (faces.size === 0) return;

      const overlayGeo = buildExclusionOverlayGeo(geo, faces);
      exclusionOverlayMesh = new THREE.Mesh(overlayGeo, exclMaterial);
      exclusionOverlayMesh.renderOrder = 1;
      // Copy the mesh transform so the overlay aligns perfectly
      exclusionOverlayMesh.position.copy(mesh.position);
      exclusionOverlayMesh.quaternion.copy(mesh.quaternion);
      exclusionOverlayMesh.scale.copy(mesh.scale);
      exclusionOverlayMesh.updateMatrixWorld();
      scene.add(exclusionOverlayMesh);
    };

    state.refreshOverlay = refreshOverlay;
    state.invalidateAdjacency = () => {
      adjacencyData = null;
    };

    const paintAt = (e: MouseEvent | PointerEvent) => {
      const mesh = stateRef.current?.solid;
      if (!mesh) return;
      raycaster.setFromCamera(canvasNDC(e), stateRef.current!.camera);
      const hits = raycaster.intersectObject(mesh);
      const hit = getFrontFaceHit(hits);
      if (!hit || hit.faceIndex == null) return;

      const store = useStore.getState();
      const erasing = store.eraseMode || store.activeViewportTool === 'erase';

      if (store.brushIsRadius && hit.point && adjacencyData) {
        // Radius brush: find all triangles whose centroid is within radius
        const geo = mesh.geometry;
        const indexAttr = geo.index;
        const triCount = indexAttr ? indexAttr.count / 3 : geo.attributes.position.count / 3;
        const localPoint = mesh.worldToLocal(hit.point.clone());
        const selected = radiusBrushSelect(
          localPoint,
          store.brushRadius,
          adjacencyData.centroids,
          triCount,
        );
        if (erasing) {
          store.removeExcludedFaces(selected);
        } else {
          store.addExcludedFaces(selected);
        }
      } else {
        // Single-face click
        if (erasing) {
          store.removeExcludedFaces([hit.faceIndex]);
        } else {
          store.addExcludedFaces([hit.faceIndex]);
        }
      }

      refreshOverlay();
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const tool = useStore.getState().activeViewportTool;

      if (tool === 'placeOnFace') {
        const triIdx = pickTriangle(e);
        if (triIdx >= 0) {
          raycaster.setFromCamera(canvasNDC(e), stateRef.current!.camera);
          const hits = raycaster.intersectObject(stateRef.current!.solid);
          const hit = getFrontFaceHit(hits);
          if (hit && hit.face) {
            const normal = hit.face.normal.clone()
              .transformDirection(stateRef.current!.solid.matrixWorld);
            const target = new THREE.Vector3(0, -1, 0);
            const q = new THREE.Quaternion().setFromUnitVectors(normal, target);
            stateRef.current!.solid.quaternion.premultiply(q);
            stateRef.current!.solid.updateMatrixWorld();
            fitCamera(stateRef.current!);
            useStore.getState().setActiveViewportTool('select');
          }
        }
        return;
      }

      if (tool === 'select') {
        const mesh = stateRef.current?.solid;
        if (mesh && mesh.geometry && mesh.geometry.getAttribute('position')) {
          raycaster.setFromCamera(canvasNDC(e), stateRef.current!.camera);
          const hits = raycaster.intersectObject(mesh);
          const hit = getFrontFaceHit(hits);
          if (hit && hit.point) {
            const localPoint = mesh.worldToLocal(hit.point.clone());
            const stats = useStore.getState().preview?.stats ?? { maxOuterRadius: 50, minOuterRadius: 40 };
            const bbox = mesh.geometry.boundingBox ?? new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute);
            const clickedPart = getHitPart(localPoint, bbox, stats.maxOuterRadius);
            
            const operations = useStore.getState().settings.operations;
            let op = operations.find((o) => o.targetPart === clickedPart);
            if (!op) {
              const newId = `op-${clickedPart}-${Date.now()}`;
              useStore.getState().addOperation({
                id: newId,
                name: `${clickedPart.charAt(0).toUpperCase() + clickedPart.slice(1)} Texture`,
                type: 'deboss',
                targetPart: clickedPart,
                mappingKind: 'grid',
                visible: true,
                projectionMode: 'cylindrical',
                projectionMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
                patternId: 'primary',
                maskId: null,
                depth: clickedPart === 'body' ? 1.7 : 0.8,
                smoothing: 0,
                tileFit: 'stretch',
                snapSeamlessWrap: true,
                columns: clickedPart === 'body' ? 4 : 16,
                rows: clickedPart === 'body' ? 8 : 2,
                offsetX: 0,
                offsetY: 0,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                mirrorX: false,
                mirrorY: false,
              });
              useStore.getState().setSelectedOperationId(newId);
            } else {
              if (!op.visible) {
                useStore.getState().updateOperation(op.id, { visible: true });
              }
              useStore.getState().setSelectedOperationId(op.id);
            }
          }
        }
        return;
      }

      if (tool === 'brush' || tool === 'erase' || tool === 'bucket') {
        // Ensure adjacency is built for current geometry
        if (!adjacencyData && stateRef.current) {
          adjacencyData = buildAdjacency(stateRef.current.solid.geometry);
        }

        if (tool === 'bucket') {
          const triIdx = pickTriangle(e);
          if (triIdx >= 0 && adjacencyData) {
            e.preventDefault();
            e.stopPropagation();
            const store = useStore.getState();
            const erasing = store.eraseMode;
            const filled = bucketFill(triIdx, adjacencyData.adjacency, store.bucketThreshold);
            if (erasing) {
              store.removeExcludedFaces(filled);
            } else {
              store.addExcludedFaces(filled);
            }
            refreshOverlay();
          }
        } else {
          // Brush / erase: only start painting if we hit the mesh
          const triIdx = pickTriangle(e);
          if (triIdx < 0) return;  // miss → let OrbitControls handle the drag
          e.preventDefault();
          e.stopPropagation();
          controls.enabled = false;
          isPainting = true;
          paintAt(e);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const store = useStore.getState();
      const tool = store.activeViewportTool;

      if (tool === 'select') {
        const mesh = stateRef.current?.solid;
        if (mesh && mesh.geometry && mesh.geometry.getAttribute('position')) {
          raycaster.setFromCamera(canvasNDC(e), stateRef.current!.camera);
          const hits = raycaster.intersectObject(mesh, false);
          const hit = getFrontFaceHit(hits);
          renderer.domElement.style.cursor = hit && hit.point ? 'pointer' : 'default';
        }
      }
      
      if ((tool === 'brush' || tool === 'erase') && store.brushIsRadius) {
        const mesh = stateRef.current?.solid;
        if (mesh) {
          raycaster.setFromCamera(canvasNDC(e), stateRef.current!.camera);
          const hits = raycaster.intersectObject(mesh, false);
          const hit = getFrontFaceHit(hits);
          if (hit && hit.face) {
            brushCursor.visible = true;
            brushCursor.position.copy(hit.point);
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
            const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
            const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
            brushCursor.quaternion.copy(targetQuat);
            brushCursor.scale.setScalar(store.brushRadius);
          } else {
            brushCursor.visible = false;
          }
        }
      } else {
        brushCursor.visible = false;
      }
      
      if (!isPainting) return;
      
      if (tool === 'brush' || tool === 'erase') {
        paintAt(e);
      }
    };

    const handlePointerUp = async (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (isPainting) {
        isPainting = false;
        controls.enabled = true;
        
        // Persist the mask to the active operation
        const store = useStore.getState();
        const { selectedOperationId, excludedFaces } = store;
        const mesh = stateRef.current?.solid;
        
        if (selectedOperationId && mesh) {
          const geo = mesh.geometry;
          const indexAttr = geo.index;
          const triCount = indexAttr ? indexAttr.count / 3 : geo.attributes.position.count / 3;
          
          const maskArray = new Uint8Array(triCount);
          for (const face of excludedFaces) maskArray[face] = 1;
          
          const { saveMask } = await import('../state/persistence');
          const maskId = crypto.randomUUID();
          await saveMask(maskId, maskArray);
          
          // Update the operation with the new maskId
          store.updateOperation(selectedOperationId, { maskId });
        }
      }
    };

    // Shift key toggles erase mode (like Bumpmesh)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        const tool = useStore.getState().activeViewportTool;
        if (tool === 'brush' || tool === 'bucket') {
          useStore.getState().setEraseMode(true);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        useStore.getState().setEraseMode(false);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      state.disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      
      scene.remove(brushCursor);
      brushCursorGeo.dispose();
      brushCursorMat.dispose();

      if (exclusionOverlayMesh) {
        scene.remove(exclusionOverlayMesh);
        exclusionOverlayMesh.geometry.dispose();
      }
      exclMaterial.dispose();
      solid.geometry.dispose();
      wire.geometry.dispose();
      for (const material of Object.values(materials)) material.dispose();
      (wire.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
    };
    // Mount once; handles are delivered through onReady.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -- Geometry swap ---------------------------------------------------- */
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;

    const previous = state.solid.geometry;
    const previousWire = state.wire.geometry;

    if (!preview) {
      state.solid.geometry = new THREE.BufferGeometry();
      state.wire.geometry = new THREE.BufferGeometry();
      state.solid.position.y = 0;
      state.wire.position.y = 0;
    } else {
      const geometry = toBufferGeometry(preview.mesh);
      state.solid.geometry = geometry;

      // Position the model so its lowest point sits on the floor grid (Y = 0)
      const minY = geometry.boundingBox?.min.y ?? -50;
      const yOffset = -minY;
      state.solid.position.y = yOffset;
      state.wire.position.y = yOffset;

      // A full wireframe of a million-triangle heightmap is unreadable and
      // costs more to build than the mesh itself.
      state.wire.geometry =
        preview.stats.triangleCount <= 400_000
          ? new THREE.WireframeGeometry(geometry)
          : new THREE.BufferGeometry();

      // Only re-frame when the part actually changes size. Refitting on every
      // regeneration would yank the camera away mid-orbit.
      const radius = geometry.boundingSphere?.radius ?? 60;
      const previousRadius = lastFitRadius.current;
      if (previousRadius === null || Math.abs(radius - previousRadius) / radius > 0.2) {
        fitCamera(state, previousRadius !== null);
        lastFitRadius.current = radius;
      }
    }

    previous.dispose();
    previousWire.dispose();

    state.invalidateAdjacency?.();
    state.refreshOverlay?.();
  }, [preview]);

  /* -- Sync mask overlay on external updates (Clear / Invert / Operation switch) -- */
  const maskVersion = useStore((s) => s.maskVersion);
  const excludedFaces = useStore((s) => s.excludedFaces);

  useEffect(() => {
    stateRef.current?.refreshOverlay?.();
  }, [maskVersion, excludedFaces]);

  /* -- View mode -------------------------------------------------------- */
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    state.solid.material = state.materials[viewMode];
    state.wire.visible = viewMode === 'wireframe';
  }, [viewMode]);



  return <div ref={containerRef} className="viewport" />;
}

export function getHitPart(
  localPoint: THREE.Vector3,
  bb: THREE.Box3,
  maxOuterRadius: number,
): TankardPartId {
  const yMin = bb.min.y;
  const yMax = bb.max.y;
  const radius = maxOuterRadius > 0 ? maxOuterRadius : 50;

  // 1. Handle: extends out along +X from the cylinder body
  if (localPoint.x > radius * 0.98 + 0.5) {
    return 'handle';
  }

  // 2. Top Rim: top ring of the mug (within 14 mm of top)
  if (localPoint.y > yMax - 14) {
    return 'topRim';
  }

  // 3. Bottom Rim: bottom ring of the mug (within 16 mm of bottom)
  if (localPoint.y < yMin + 16) {
    return 'bottomRim';
  }

  // 4. Body Wall: central cylinder wall
  return 'body';
}





/* -------------------------------------------------------------------- *
 * Helpers
 * -------------------------------------------------------------------- */

function toBufferGeometry(mesh: PrintableMesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  if (mesh.normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}



function modelRadius(state: SceneState): number {
  const sphere = state.solid.geometry.boundingSphere;
  return sphere && sphere.radius > 0 ? sphere.radius : 60;
}

function fitCamera(state: SceneState, keepDirection = false): void {
  const radius = modelRadius(state);
  const distance = radius / Math.sin((state.camera.fov * Math.PI) / 360) / 1.35;
  const centerY = state.solid.position.y;

  state.controls.target.set(0, centerY, 0);
  if (keepDirection) {
    const direction = state.camera.position.clone().sub(state.controls.target).normalize();
    if (direction.lengthSq() < 1e-6) direction.set(0.6, 0.45, 0.8).normalize();
    state.camera.position.copy(direction.multiplyScalar(distance).add(state.controls.target));
  } else {
    const dir = new THREE.Vector3(0.62, 0.48, 0.82).normalize().multiplyScalar(distance);
    state.camera.position.set(dir.x, centerY + dir.y, dir.z);
  }
  state.camera.near = Math.max(0.1, distance / 500);
  state.camera.far = distance * 20;
  state.camera.updateProjectionMatrix();
  state.controls.update();
}

function setCameraView(state: SceneState, view: CameraView): void {
  const radius = modelRadius(state);
  const distance = radius / Math.sin((state.camera.fov * Math.PI) / 360) / 1.35;
  const centerY = state.solid.position.y;
  const directions: Record<CameraView, [number, number, number]> = {
    front: [0, 0, 1],
    back: [0, 0, -1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    top: [0, 1, 0.0001],
    bottom: [0, -1, 0.0001],
    iso: [0.62, 0.48, 0.82],
  };
  const [x, y, z] = directions[view];
  state.controls.target.set(0, centerY, 0);
  const offset = new THREE.Vector3(x, y, z).normalize().multiplyScalar(distance);
  state.camera.position.set(offset.x, centerY + offset.y, offset.z);
  state.camera.updateProjectionMatrix();
  state.controls.update();
}
