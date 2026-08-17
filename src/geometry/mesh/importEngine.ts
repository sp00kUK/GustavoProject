import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PrintableMesh } from '../../types';

export async function parseMeshFile(file: File): Promise<PrintableMesh> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  let geometry: THREE.BufferGeometry | null = null;

  try {
    if (extension === 'stl') {
      const loader = new STLLoader();
      geometry = loader.parse(arrayBuffer);
    } else if (extension === 'obj') {
      const loader = new OBJLoader();
      const text = new TextDecoder().decode(arrayBuffer);
      const group = loader.parse(text);
      group.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh && !geometry) {
          geometry = (child as THREE.Mesh).geometry.clone();
        }
      });
    } else if (extension === '3mf') {
      const loader = new ThreeMFLoader();
      const group = loader.parse(arrayBuffer);
      group.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh && !geometry) {
          geometry = (child as THREE.Mesh).geometry.clone();
        }
      });
    }
  } catch (error) {
    throw new Error(`Failed to parse ${extension} file: ${(error as Error).message}`);
  }

  if (!geometry) {
    throw new Error('Could not parse geometry from file. No mesh found.');
  }

  if (!geometry.attributes.position) {
    throw new Error('Geometry has no position data.');
  }

  // STL is typically non-indexed (triangle soup), requiring vertex welding
  if (!geometry.index) {
    geometry = BufferGeometryUtils.mergeVertices(geometry, 1e-4);
  }

  if (!geometry.index) {
    // If still no index, generate a naive one (should not happen with mergeVertices)
    const positionCount = geometry.attributes.position.count;
    const indices = new Uint32Array(positionCount);
    for (let i = 0; i < positionCount; i++) {
      indices[i] = i;
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  const positions = new Float32Array(geometry.attributes.position.array);
  const indices = new Uint32Array(geometry.index!.array);
  let normals: Float32Array | undefined;

  if (geometry.attributes.normal) {
    normals = new Float32Array(geometry.attributes.normal.array);
  }

  return {
    positions,
    indices,
    normals
  };
}
