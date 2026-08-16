import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore, type ViewMode } from '../state/store';
import type { PrintableMesh } from '../types';

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
export function Viewport({ onReady, onFps, onError }: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    solid: THREE.Mesh;
    wire: THREE.LineSegments;
    materials: Record<ViewMode, THREE.Material>;
    disposed: boolean;
  } | null>(null);

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
        color: 0xb9c0cc,
        roughness: 0.72,
        metalness: 0.04,
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
        vertexColors: true,
      }),
      heatmap: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.85,
        metalness: 0,
        vertexColors: true,
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

    const state = {
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

    return () => {
      state.disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
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
    } else {
      const geometry = toBufferGeometry(preview.mesh);
      addReliefColours(geometry, preview.stats);
      state.solid.geometry = geometry;
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
  }, [preview]);

  /* -- View mode -------------------------------------------------------- */
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    state.solid.material = state.materials[viewMode];
    state.wire.visible = viewMode === 'wireframe';
  }, [viewMode]);

  return <div ref={containerRef} className="viewport" />;
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

/**
 * Per-vertex colours used by the mask and heatmap view modes: radius is mapped
 * across the relief range, so a carved floor reads dark/blue and an untouched
 * surface reads light/red. Debug aid, never part of the exported geometry.
 */
function addReliefColours(
  geometry: THREE.BufferGeometry,
  stats: { minOuterRadius: number; maxOuterRadius: number },
): void {
  const position = geometry.getAttribute('position');
  const count = position.count;
  const colours = new Float32Array(count * 3);
  const lo = stats.minOuterRadius;
  const hi = Math.max(stats.maxOuterRadius, lo + 1e-6);

  for (let i = 0; i < count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const t = Math.min(1, Math.max(0, (Math.hypot(x, z) - lo) / (hi - lo)));
    colours[i * 3] = t;
    colours[i * 3 + 1] = 0.25 + t * 0.4;
    colours[i * 3 + 2] = 1 - t;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
}

interface SceneState {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  solid: THREE.Mesh;
}

function modelRadius(state: SceneState): number {
  const sphere = state.solid.geometry.boundingSphere;
  return sphere && sphere.radius > 0 ? sphere.radius : 60;
}

function fitCamera(state: SceneState, keepDirection = false): void {
  const radius = modelRadius(state);
  const distance = radius / Math.sin((state.camera.fov * Math.PI) / 360) / 1.35;

  state.controls.target.set(0, 0, 0);
  if (keepDirection) {
    const direction = state.camera.position.clone().normalize();
    if (direction.lengthSq() < 1e-6) direction.set(0.6, 0.45, 0.8).normalize();
    state.camera.position.copy(direction.multiplyScalar(distance));
  } else {
    state.camera.position.set(0.62, 0.48, 0.82).normalize().multiplyScalar(distance);
  }
  state.camera.near = Math.max(0.1, distance / 500);
  state.camera.far = distance * 20;
  state.camera.updateProjectionMatrix();
  state.controls.update();
}

function setCameraView(state: SceneState, view: CameraView): void {
  const radius = modelRadius(state);
  const distance = radius / Math.sin((state.camera.fov * Math.PI) / 360) / 1.35;
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
  state.controls.target.set(0, 0, 0);
  state.camera.position.set(x, y, z).normalize().multiplyScalar(distance);
  state.camera.updateProjectionMatrix();
  state.controls.update();
}
