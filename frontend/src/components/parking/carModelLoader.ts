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

// Premium showroom palette — modern automotive monochromes plus several
// refined deep-blue accents. Strictly white / silver / graphite /
// charcoal / black / navy; deliberately avoids any yellow or warm
// colors that would clash with the SwiftPark brand under the cool scene
// lighting.
//
// Distribution is tuned so navy is the most-frequent accent and white is
// the least common — modern parking lots feel premium when most cars are
// dark/cool tones rather than a sea of white sedans.
const SHOWROOM_COLORS: ReadonlyArray<number> = [
  // Whites (2 — reduced)
  0xfafbfd, 0xe2e8f0,
  // Silvers (2)
  0xcbd5e1, 0xa5b1c1,
  // Titanium (1)
  0x8a96a8,
  // Cool graphites (3)
  0x64748b, 0x536273, 0x475569,
  // Charcoals (2 — new tier between graphite and black)
  0x3a4250, 0x2e3340,
  // Blacks (2)
  0x1e293b, 0x0f172a,
  // Navy accents (3 — the richer royal `#223e7d` variant was removed
  // because it read too saturated next to the silvers; the remaining
  // three navies stay in the deep / midnight / near-black-blue lane).
  0x1e3a8a, 0x1d3361, 0x182a5e,
];

/** Set of hex values treated as the "deep navy" accent. Used to dial in a
 *  slightly less metallic paint physics for navies so they read as
 *  premium navy rather than glossy plastic. */
const NAVY_COLOR_SET: ReadonlySet<number> = new Set([
  0x1e3a8a, 0x1d3361, 0x182a5e,
]);

// Material classification — keep tight to avoid catching body materials by
// accident (e.g., a body called "MainBody" must NOT match the glass regex).
const GLASS_RE = /(?:^|[^a-z])(glass|window|windshield)(?:[^a-z]|$)/;
const BODY_RE = /(?:^|[^a-z])(body|paint|carpaint|mainbody|chassis|exterior)(?:[^a-z]|$)/;
const TAIL_LIGHT_RE = /tail.*(light|lamp)|rear.*light|brake.*light/;
const HEAD_LIGHT_RE = /(head|drl|day|front).*(light|lamp)|headlamp/;
const WHEEL_RE = /(?:^|[^a-z])(wheel|tire|tyre|rim|hub|brake|caliper)(?:[^a-z]|$)/;
const INTERIOR_RE = /(?:^|[^a-z])(interior|seat|dashboard|steering|cabin|cockpit)(?:[^a-z]|$)/;
const PLASTIC_TRIM_RE = /(?:^|[^a-z])(trim|bumper|grill|grille|mirror|plastic|black_plastic)(?:[^a-z]|$)/;
const PLATE_RE = /(?:^|[^a-z])(plate|license)(?:[^a-z]|$)/;

/**
 * Heuristic test: does a color sit in the warm/saturated range we want to
 * forcibly override? Yellow / orange / red / lime are the Quaternius taxi
 * and "civilian" defaults that fight the SwiftPark brand. White, gray,
 * silver, black, and blue all have low warm-saturation and pass through.
 */
function isWarmSaturated(color: THREE.Color): boolean {
  const r = color.r;
  const g = color.g;
  const b = color.b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  // Achromatic (gray/white/black) — keep
  if (chroma < 0.12) return false;
  // Cool-dominant (blue >> red, blue >> green) — keep our brand-blue tints
  if (b > r + 0.06 && b > g + 0.06) return false;
  // Anything else with real chroma (yellows, oranges, reds, greens) —
  // override.
  return true;
}

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

      // Universal safety: GLB exporters frequently flip `transparent: true`
      // on materials whose alpha is effectively 1. That makes solid bodies
      // render with depth-sort blending artifacts that look "translucent".
      // Force them opaque before any further classification.
      if (m.transparent && m.opacity >= 0.99) {
        m.transparent = false;
        m.depthWrite = true;
      }

      if (GLASS_RE.test(name)) {
        m.color.setHex(0x111c2e);
        m.transparent = true;
        m.opacity = 0.6;
        m.roughness = 0.05;
        m.metalness = 0.6;
        m.depthWrite = false;
      } else if (TAIL_LIGHT_RE.test(name)) {
        if (m.emissive.getHex() === 0) {
          m.emissive.setHex(0xef4444);
          m.emissiveIntensity = 0.65;
        }
      } else if (HEAD_LIGHT_RE.test(name)) {
        if (m.emissive.getHex() === 0) {
          m.emissive.setHex(0xbfdbfe);
          m.emissiveIntensity = 0.7;
        }
      } else if (BODY_RE.test(name)) {
        // Premium satin paint — less neon than the previous 0.55/0.3 setup.
        m.metalness = 0.42;
        m.roughness = 0.42;
        m.transparent = false;
        m.opacity = 1.0;
        m.depthWrite = true;
        m.alphaTest = 0;
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

  // Identify whether the chosen tint is one of the SwiftPark navy accents
  // so we can dial in slightly different paint physics for them (deeper,
  // less metallic → reads as "premium navy" rather than "neon blue
  // plastic").
  const isAccentBlue = NAVY_COLOR_SET.has(tintColor);

  clone.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    if (!mesh.material) return;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const newMats: THREE.Material[] = [];
    let mutated = false;

    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) {
        newMats.push(mat);
        continue;
      }

      const name = `${mat.name || ""} ${mesh.name || ""}`.toLowerCase();

      // Hands off — these have their own treatment from applyPremiumLook
      // and shouldn't take the body tint.
      if (
        GLASS_RE.test(name) ||
        TAIL_LIGHT_RE.test(name) ||
        HEAD_LIGHT_RE.test(name) ||
        WHEEL_RE.test(name) ||
        INTERIOR_RE.test(name) ||
        PLATE_RE.test(name)
      ) {
        newMats.push(mat);
        continue;
      }

      // Decide whether this material should take the body tint:
      //   - Explicit body-name match (BODY_RE), OR
      //   - Plastic/bumper/grill — paint these the same body color so the
      //     car reads as one cohesive paint job rather than yellow-vs-blue
      //     parts, OR
      //   - Anything else with a warm/saturated default color (yellow,
      //     orange, red, lime) that would clash with SwiftPark's brand.
      const looksLikeBody = BODY_RE.test(name);
      const looksLikePlastic = PLASTIC_TRIM_RE.test(name);
      const warmDefault = isWarmSaturated(mat.color);

      if (!looksLikeBody && !looksLikePlastic && !warmDefault) {
        // Neutral material with no warm chroma — leave it alone (likely
        // black trim, gray bumper, chrome grill, etc.).
        newMats.push(mat);
        continue;
      }

      // Clone so per-spot tints don't leak back into the cached source.
      const cloned = mat.clone();
      cloned.color.setHex(tintColor);
      cloned.metalness = isAccentBlue ? 0.32 : 0.42;
      cloned.roughness = isAccentBlue ? 0.5 : 0.42;
      cloned.transparent = false;
      cloned.opacity = 1.0;
      cloned.depthWrite = true;
      cloned.alphaTest = 0;
      // Strip any baked emissive that might tint the car warm even after
      // the base color override (Quaternius taxis ship with yellow
      // emissive on the body).
      cloned.emissive.setHex(0x000000);
      cloned.emissiveIntensity = 0;
      newMats.push(cloned);
      tinted.push(cloned);
      mutated = true;
    }

    if (mutated) {
      mesh.material = Array.isArray(mesh.material) ? newMats : newMats[0];
    }
  });

  wrapper.add(clone);
  return wrapper;
}
