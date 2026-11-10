import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

let cachedCowGeometry: THREE.BufferGeometry | null = null;
let isLoadingCow = false;

/**
 * Preload high-polygon organic Cow geometry from /models/cow.obj (Alec Jacobson / Keenan Crane CC0).
 */
export function preloadCowModel(): void {
  if (cachedCowGeometry || isLoadingCow || typeof window === 'undefined') return;
  isLoadingCow = true;

  const loader = new OBJLoader();
  loader.load(
    '/models/cow.obj',
    (obj) => {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !cachedCowGeometry) {
          const mesh = child as THREE.Mesh;
          const geo = mesh.geometry.clone();
          geo.computeVertexNormals();
          geo.center();
          cachedCowGeometry = geo;
        }
      });
      isLoadingCow = false;
    },
    undefined,
    (err) => {
      console.warn('Fallback to procedural cattle mesh:', err);
      isLoadingCow = false;
    }
  );
}

export function getCachedCowGeometry(): THREE.BufferGeometry | null {
  return cachedCowGeometry;
}

