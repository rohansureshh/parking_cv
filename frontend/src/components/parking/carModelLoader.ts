import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * External car-model loader for ParkingGarage3D.
 *
 * Loads a small set of Quaternius .glb cars from /public/models/cars-bundle/,
 * caches them, and exposes helpers that clone the cached scene for each
 * occupied parking spot. The procedural Tesla-style car in
 * `ParkingGarage3D.tsx` is kept as a fallback for the case where:
 *   - no GLBs are configured,
 *   - all GLBs fail to load,
 *   - or the loader hasn't finished yet on first paint.
 *
 * Performance notes:
 *   - We keep one cached `THREE.Group` per GLB and `clone(true)` it for each
 *     spot. Cloning shares geometries and materials by default — only the
 *     "body" material is cloned per spot so we can tint it. Wrappers carry
 *     `userData.shared = true` so the parent component's dispose pass can
 *     safely skip recursive `geometry.dispose()` / `material.dispose()`
 *     and only release the per-spot tinted material clones.
 */

// Civilian-only set — Police Car and Taxi don't fit the SwiftPark theme.
const MODEL_PATHS: ReadonlyArray<string> = [
  "/models/cars-bundle/Car.glb",
  "/models/cars-bundle/Car-unqqkULtRU.glb",
  "/models/cars-bundle/SUV.glb",
  "/models/cars-bundle/Sports Car.glb",
  "/models/cars-bundle/Sports Car-1mkmFkAz5v.glb",
];

// Premium showroom palette: whites, silvers, graphites, blacks, plus one
// SwiftPark-blue accent (~10% of cars given the array length).
const SHOWROOM_COLORS: ReadonlyArray<number> = [
  0xf8fafc, 0xf1f5f9, 0xe2e8f0, // whites
  0xcbd5e1, 0x94a3b8,            // silvers
  0x64748b, 0x475569,            // graphites
  0x1e293b, 0x0f172a,            // blacks
  0x2563eb,                      // SwiftPark blue accent
];

export interface CarModelEntry {
  path: string;
  scene: THREE.Group;
  size: THREE.Vector3;
  center: THREE.Vector3;
  minY: number;
}

const cache = new Map<string, CarModelEntry>();
let preloadPromise: Promise<CarModelEntry[]> | null = null;

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * One-time pass over a freshly loaded GLB scene. Bumps body materials to
 * a more premium PBR feel, darkens window-like materials to a tinted
 * glass, and gives head/tail lights subtle emissive defaults if they
 * arrived without one.
 *
 * Heuristic only — keyed off material/mesh names. Models that don't
 * follow these naming conventions are simply rendered as-imported.
 */
function applyPremiumLook(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (!(m instanceof THREE.MeshStandardMaterial)) return;
      const name = `${m.name || ""} ${mesh.name || ""}`.toLowerCase();

      if (/glass|window|windshield|screen/.test(name)) {
        m.color.setHex(0x111c2e);
        m.transparent = true;
        m.opacity = 0.78;
        m.roughness = 0.05;
        m.metalness = 0.2;
      } else if (/tail/.test(name) && /light|lamp/.test(name)) {
        if (m.emissive.getHex() === 0) {
          m.emissive.setHex(0xef4444);
          m.emissiveIntensity = 0.7;
        }
      } else if (/(head|drl|day)/.test(name) && /light|lamp/.test(name)) {
        if (m.emissive.getHex() === 0) {
          m.emissive.setHex(0xbfdbfe);
          m.emissiveIntensity = 0.8;
        }
      } else if (/body|paint|main|car/.test(name)) {
        m.metalness = 0.55;
        m.roughness = 0.3;
      }
    });
  });
}

function loadOne(path: string): Promise<CarModelEntry | null> {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      path,
      (gltf: GLTF) => {
        try {
          const root = new THREE.Group();
          const inner = gltf.scene;
          root.add(inner);

          // If the model is wider (X) than long (Z), rotate so its forward
          // axis aligns with our spot's long (Z) axis. We bake this rotation
          // into the cached scene so every clone inherits it.
          const initBbox = new THREE.Box3().setFromObject(inner);
          const initSize = new THREE.Vector3();
          initBbox.getSize(initSize);
          if (initSize.x > initSize.z * 1.05) {
            inner.rotation.y = Math.PI / 2;
            inner.updateMatrixWorld(true);
          }

          applyPremiumLook(inner);

          const bbox = new THREE.Box3().setFromObject(root);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          bbox.getSize(size);
          bbox.getCenter(center);

          const entry: CarModelEntry = {
            path,
            scene: root,
            size,
            center,
            minY: bbox.min.y,
          };
          cache.set(path, entry);
          resolve(entry);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[SwiftPark] error processing", path, err);
          resolve(null);
        }
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.warn("[SwiftPark] failed to load", path, err);
        resolve(null);
      },
    );
  });
}

/**
 * Kick off (or return the cached) load of every configured GLB. Resolves
 * to the subset that actually loaded — never rejects, so the caller only
 * needs to check `.length === 0` to fall back to the procedural car.
 */
export function preloadCarModels(): Promise<CarModelEntry[]> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = Promise.all(MODEL_PATHS.map(loadOne)).then(
    (results) => results.filter((r): r is CarModelEntry => r !== null),
  );
  return preloadPromise;
}

/** All models that have finished loading so far (may be empty). */
export function getLoadedModels(): CarModelEntry[] {
  return Array.from(cache.values());
}

/** Deterministic per-spot model pick, using `spotId` as the seed. */
export function pickModelForSpot(spotId: string): CarModelEntry | null {
  const entries = Array.from(cache.values());
  if (entries.length === 0) return null;
  return entries[hashCode(spotId) % entries.length];
}

/**
 * Build a scene-ready wrapper containing a fresh clone of the model,
 * normalized to fit a `targetW × targetD` parking stall with its wheels
 * sitting at `groundY`. The wrapper is tagged so the caller's dispose
 * pass knows not to recurse into shared geometry/materials.
 */
export function spawnCarFromModel(
  entry: CarModelEntry,
  targetW: number,
  targetD: number,
  groundY: number,
  spotId: string,
): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.userData.shared = true;
  const tinted: THREE.Material[] = [];
  wrapper.userData.tintedMaterials = tinted;

  const clone = entry.scene.clone(true);

  // Uniform fit — pick the more constraining axis with a 0.92 margin so
  // mirrors / spoilers / etc. don't poke past the painted lines.
  const scale = Math.min(
    targetW / Math.max(entry.size.x, 0.0001),
    targetD / Math.max(entry.size.z, 0.0001),
  ) * 0.92;
  clone.scale.setScalar(scale);

  // Center the footprint on (0, 0) and lift wheels to groundY.
  clone.position.x = -entry.center.x * scale;
  clone.position.y = -entry.minY * scale + groundY;
  clone.position.z = -entry.center.z * scale;

  const seed = hashCode(spotId);
  const tintColor = SHOWROOM_COLORS[seed % SHOWROOM_COLORS.length];

  clone.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    if (mesh.material && !Array.isArray(mesh.material)) {
      const mat = mesh.material;
      const name = `${mat.name || ""} ${mesh.name || ""}`.toLowerCase();
      if (/body|paint|main|car/.test(name) && mat instanceof THREE.MeshStandardMaterial) {
        // Clone so per-spot tints don't leak back into the cached source.
        const cloned = mat.clone();
        cloned.color.setHex(tintColor);
        cloned.metalness = 0.55;
        cloned.roughness = 0.3;
        mesh.material = cloned;
        tinted.push(cloned);
      }
    }
  });

  wrapper.add(clone);
  return wrapper;
}
