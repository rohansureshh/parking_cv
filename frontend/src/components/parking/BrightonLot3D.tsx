import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  pickModelForSpot,
  preloadCarModels,
  spawnCarFromModel,
} from "./carModelLoader";
import type { BrightonLotSpace } from "../../lib/brightonLotLayout";
import type { Spot, SpotStatus } from "../../lib/types";

const STATUS_COLOR: Record<SpotStatus | "selected", number> = {
  available: 0x2563eb,
  occupied: 0xf87171,
  unknown: 0x94a3b8,
  selected: 0x1d4ed8,
};

const STATUS_FILL: Record<SpotStatus | "selected", number> = {
  available: 0xdbeafe,
  occupied: 0xffe4e6,
  unknown: 0xe2e8f0,
  selected: 0xbfdbfe,
};

interface BrightonLot3DProps {
  spaces: BrightonLotSpace[];
  spots: Spot[];
  selectedSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
  viewVersion?: number;
}

interface SpotUserData {
  spot: Spot;
  isSpot: true;
}

interface InternalState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  lotGroup: THREE.Group | null;
  spotTargets: THREE.Mesh[];
  sph: { theta: number; phi: number; radius: number };
  bounds: LotBounds;
  isDragging: boolean;
  hasDragged: boolean;
  prevMouse: { x: number; y: number };
  animId: number | null;
}

interface LotBounds {
  width: number;
  depth: number;
  radius: number;
}

const DEFAULT_THETA = 0.48;
const DEFAULT_PHI = 0.84;

export default function BrightonLot3D({
  spaces,
  spots,
  selectedSpot,
  onSelectSpot,
  viewVersion = 0,
}: BrightonLot3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<InternalState | null>(null);
  const onSelectRef = useRef(onSelectSpot);
  // Flips to true once the GLB cache from carModelLoader has finished
  // loading. The rebuild effect depends on this so the first paint
  // shows the procedural fallback car for occupied spots and the second
  // paint upgrades to the OSU showroom GLBs without a stutter.
  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectSpot;
  }, [onSelectSpot]);

  // Kick off the shared GLB preload. carModelLoader is module-cached, so
  // when the OSU screen has already preloaded these this is essentially
  // a no-op — Brighton just gets the same cached scenes.
  useEffect(() => {
    let cancelled = false;
    preloadCarModels().then((entries) => {
      if (!cancelled && entries.length > 0) setModelsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const spotByLabel = useMemo(() => {
    const map = new Map<string, Spot>();
    for (const spot of spots) map.set(spot.label.toUpperCase(), spot);
    return map;
  }, [spots]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const bounds = computeBounds(spaces);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2f7fb);
    scene.fog = new THREE.FogExp2(0xf2f7fb, 0.013);

    const camera = new THREE.PerspectiveCamera(
      45,
      el.clientWidth / Math.max(1, el.clientHeight),
      0.1,
      220,
    );
    const sph = {
      theta: DEFAULT_THETA,
      phi: DEFAULT_PHI,
      radius: bounds.radius,
    };
    updateCamera(camera, sph);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xeef6ff, 1.08));

    const sun = new THREE.DirectionalLight(0xffffff, 1.04);
    sun.position.set(20, 32, 14);
    sun.castShadow = true;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0xbdd7ff, 0.54);
    fill.position.set(-22, 16, -22);
    scene.add(fill);

    const state: InternalState = {
      scene,
      camera,
      renderer,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),
      lotGroup: null,
      spotTargets: [],
      sph,
      bounds,
      isDragging: false,
      hasDragged: false,
      prevMouse: { x: 0, y: 0 },
      animId: null,
    };
    stateRef.current = state;

    rebuildLot(state, spaces, spotByLabel, selectedSpot);

    const animate = () => {
      state.animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    });
    resizeObserver.observe(el);

    return () => {
      if (state.animId !== null) cancelAnimationFrame(state.animId);
      resizeObserver.disconnect();
      disposeLot(state);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      stateRef.current = null;
    };
    // Initial scene setup only. Data updates are handled by the rebuild effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const nextBounds = computeBounds(spaces);
    state.bounds = nextBounds;
    state.sph.radius = Math.min(
      Math.max(state.sph.radius, nextBounds.radius * 0.72),
      nextBounds.radius * 1.9,
    );
    updateCamera(state.camera, state.sph);
    rebuildLot(state, spaces, spotByLabel, selectedSpot);
  }, [spaces, spotByLabel, selectedSpot, modelsReady]);

  useEffect(() => {
    if (viewVersion === 0) return;
    const state = stateRef.current;
    if (!state) return;
    state.sph.theta = DEFAULT_THETA;
    state.sph.phi = DEFAULT_PHI;
    state.sph.radius = state.bounds.radius;
    updateCamera(state.camera, state.sph);
  }, [viewVersion]);

  const onPointerDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const state = stateRef.current;
    if (!state) return;
    state.isDragging = true;
    state.hasDragged = false;
    state.prevMouse = getEventPos(event);
  }, []);

  const onPointerMove = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const state = stateRef.current;
    if (!state || !state.isDragging) return;
    const pos = getEventPos(event);
    const dx = pos.x - state.prevMouse.x;
    const dy = pos.y - state.prevMouse.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.hasDragged = true;
    state.sph.theta -= dx * 0.0075;
    state.sph.phi = Math.max(0.34, Math.min(1.3, state.sph.phi + dy * 0.0075));
    state.prevMouse = pos;
    updateCamera(state.camera, state.sph);
  }, []);

  const onPointerUp = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const state = stateRef.current;
    if (!state) return;

    if (!state.hasDragged) {
      const rect = state.renderer.domElement.getBoundingClientRect();
      const pos = getEndEventPos(event);
      state.mouse.x = ((pos.x - rect.left) / rect.width) * 2 - 1;
      state.mouse.y = -((pos.y - rect.top) / rect.height) * 2 + 1;
      state.raycaster.setFromCamera(state.mouse, state.camera);
      const hits = state.raycaster.intersectObjects(state.spotTargets);
      for (const hit of hits) {
        const data = hit.object.userData as Partial<SpotUserData>;
        if (data.spot?.status === "available") {
          onSelectRef.current(data.spot);
          break;
        }
      }
    }

    state.isDragging = false;
  }, []);

  const onWheel = useCallback((event: React.WheelEvent) => {
    const state = stateRef.current;
    if (!state) return;
    const minRadius = Math.max(12, state.bounds.radius * 0.55);
    const maxRadius = Math.max(48, state.bounds.radius * 2);
    state.sph.radius = Math.max(
      minRadius,
      Math.min(maxRadius, state.sph.radius + event.deltaY * 0.05),
    );
    updateCamera(state.camera, state.sph);
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        touchAction: "none",
        cursor: "grab",
        userSelect: "none",
      }}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
      onWheel={onWheel}
    />
  );
}

// ──────────────────────────────────────────────────────────────────────
// Scene construction
// ──────────────────────────────────────────────────────────────────────

function rebuildLot(
  state: InternalState,
  spaces: readonly BrightonLotSpace[],
  spotByLabel: Map<string, Spot>,
  selectedSpot: Spot | null,
) {
  disposeLot(state);
  const group = new THREE.Group();
  group.name = "brighton-surface-lot";
  state.scene.add(group);
  state.lotGroup = group;

  const rowZs = collectRowZs(spaces);
  buildSurface(group, state.bounds, rowZs);

  const targets: THREE.Mesh[] = [];
  for (const space of spaces) {
    const spot =
      spotByLabel.get(space.label.toUpperCase()) ?? makeMissingSpot(space);
    const isSelected = selectedSpot?.id === spot.id;
    const built = buildSpace(space, spot, isSelected);
    group.add(built.group);
    targets.push(built.target);
  }
  state.spotTargets = targets;
}

function disposeLot(state: InternalState) {
  if (!state.lotGroup) return;
  state.scene.remove(state.lotGroup);
  disposeObject3D(state.lotGroup);
  state.lotGroup = null;
  state.spotTargets = [];
}

function buildSurface(
  group: THREE.Group,
  bounds: LotBounds,
  rowZs: number[],
) {
  // Asphalt slab — slightly bigger than the row footprint so the painted
  // markings have a shoulder of empty asphalt around the parking grid.
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf5,
    roughness: 0.82,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(bounds.width + 8, 0.14, bounds.depth + 8),
    groundMat,
  );
  ground.position.y = -0.07;
  ground.receiveShadow = true;
  group.add(ground);

  // Lane surfaces + center dashes + directional arrows between every
  // pair of adjacent rows. Adapted from the OSU ParkingGarage3D pattern
  // so the two screens read as the same SwiftPark visual language.
  if (rowZs.length >= 2) {
    const laneSurfaceMat = new THREE.MeshStandardMaterial({
      color: 0xd3dce7,
      roughness: 0.86,
      metalness: 0,
    });
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
    });
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
    const laneWidth = 2.6;
    const numDashes = Math.max(6, Math.floor(bounds.width / 2.5));
    const dashSpacing = bounds.width / numDashes;
    const arrowSpacing = 5.0;
    const numArrows = Math.max(2, Math.floor((bounds.width - 4) / arrowSpacing));

    for (let i = 0; i < rowZs.length - 1; i++) {
      const laneZ = (rowZs[i] + rowZs[i + 1]) / 2;

      const lane = new THREE.Mesh(
        new THREE.PlaneGeometry(bounds.width, laneWidth),
        laneSurfaceMat,
      );
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(0, 0.005, laneZ);
      lane.receiveShadow = true;
      group.add(lane);

      for (let j = 0; j < numDashes; j++) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(dashSpacing * 0.45, 0.08),
          dashMat,
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(
          -bounds.width / 2 + dashSpacing * (j + 0.5),
          0.011,
          laneZ,
        );
        group.add(dash);
      }

      // Direction arrows alternate per aisle for a believable one-way
      // circulation pattern, same convention OSU uses.
      const flowSign = i % 2 === 0 ? 1 : -1;
      for (let k = 0; k < numArrows; k++) {
        const ax =
          -bounds.width / 2 + 2 + k * arrowSpacing + arrowSpacing / 2;
        const arrow = new THREE.Group();
        const stem = new THREE.Mesh(
          new THREE.PlaneGeometry(0.6, 0.07),
          arrowMat,
        );
        stem.rotation.x = -Math.PI / 2;
        arrow.add(stem);
        [-1, 1].forEach((s) => {
          const fl = new THREE.Mesh(
            new THREE.PlaneGeometry(0.32, 0.07),
            arrowMat,
          );
          fl.rotation.x = -Math.PI / 2;
          fl.rotation.z = (s * Math.PI) / 4;
          fl.position.set(0.27, 0, s * 0.13);
          arrow.add(fl);
        });
        arrow.scale.x = flowSign;
        arrow.position.set(ax, 0.012, laneZ);
        group.add(arrow);
      }
    }
  }

  // Snow banks at the long edges — keeps Brighton's mountain-resort feel
  // and gives the lot a clear visual "edge" beyond the asphalt.
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf8fbff,
    roughness: 0.9,
    metalness: 0,
  });
  [-1, 1].forEach((side) => {
    const bank = new THREE.Mesh(
      new THREE.BoxGeometry(bounds.width + 8, 0.18, 0.55),
      snowMat,
    );
    bank.position.set(0, 0.04, side * (bounds.depth / 2 + 3.4));
    bank.receiveShadow = true;
    group.add(bank);
  });
}

function buildSpace(
  space: BrightonLotSpace,
  spot: Spot,
  isSelected: boolean,
): { group: THREE.Group; target: THREE.Mesh } {
  const group = new THREE.Group();
  group.position.set(space.x, 0, space.z);
  group.rotation.y = space.rotation;

  const status = isSelected ? "selected" : spot.status;
  const target = new THREE.Mesh(
    new THREE.BoxGeometry(space.width, 0.08, space.depth),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
    }),
  );
  target.position.y = 0.05;
  target.userData = { spot, isSpot: true } satisfies SpotUserData;
  group.add(target);

  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(space.width - 0.1, 0.025, space.depth - 0.1),
    new THREE.MeshBasicMaterial({
      color: STATUS_FILL[status],
      transparent: true,
      opacity: isSelected ? 0.7 : spot.status === "available" ? 0.34 : 0.42,
    }),
  );
  fill.position.y = 0.03;
  group.add(fill);

  group.add(makePaintedOutline(space.width, space.depth, status));

  if (isSelected) {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(space.width + 0.22, 0.025, space.depth + 0.22),
      new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.3,
      }),
    );
    glow.position.y = 0.018;
    group.add(glow);
  }

  if (spot.status === "occupied") {
    let car: THREE.Object3D | null = null;
    const entry = pickModelForSpot(spot.id);
    if (entry) {
      try {
        car = spawnCarFromModel(entry, space.width, space.depth, 0, spot.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[Brighton] spawnCarFromModel failed for", spot.id, err);
        car = null;
      }
    }
    if (!car) {
      car = makeFallbackCar(space.width, space.depth, hashCode(spot.id));
    }
    group.add(car);
  }

  if (spot.status !== "occupied" || isSelected) {
    group.add(makeSpotLabel(spot.label, isSelected));
  }

  return { group, target };
}

function makePaintedOutline(
  width: number,
  depth: number,
  status: SpotStatus | "selected",
): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: STATUS_COLOR[status],
    transparent: true,
    opacity: status === "unknown" ? 0.62 : 0.95,
  });
  const line = status === "selected" ? 0.1 : 0.06;
  const y = 0.07;

  [
    { x: -width / 2 + line / 2, z: 0, w: line, d: depth },
    { x: width / 2 - line / 2, z: 0, w: line, d: depth },
    { x: 0, z: -depth / 2 + line / 2, w: width, d: line },
    { x: 0, z: depth / 2 - line / 2, w: width, d: line },
  ].forEach((edge) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(edge.w, 0.03, edge.d),
      mat,
    );
    mesh.position.set(edge.x, y, edge.z);
    group.add(mesh);
  });

  return group;
}

/**
 * Lightweight procedural car. Used only as a fallback while the GLB
 * models are still loading, or if a model fails to spawn for a given
 * spot. Production rendering goes through `spawnCarFromModel`.
 */
function makeFallbackCar(width: number, depth: number, seed: number): THREE.Group {
  const colors = [0x1e293b, 0x334155, 0x64748b, 0xf8fafc, 0x2563eb];
  const bodyColor = colors[seed % colors.length];
  const group = new THREE.Group();
  group.position.y = 0.14;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.72, 0.28, depth * 0.54),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.42,
      metalness: 0.18,
    }),
  );
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.48, 0.18, depth * 0.28),
    new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.18,
      metalness: 0.08,
    }),
  );
  cabin.position.set(0, 0.22, -depth * 0.02);
  cabin.castShadow = true;
  group.add(cabin);

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  [-1, 1].forEach((sx) => {
    [-1, 1].forEach((sz) => {
      const tire = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.12, 0.12, depth * 0.12),
        tireMat,
      );
      tire.position.set(sx * width * 0.38, -0.03, sz * depth * 0.22);
      group.add(tire);
    });
  });

  return group;
}

function makeSpotLabel(label: string, isSelected: boolean): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = `bold ${isSelected ? 28 : 22}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isSelected ? "#1d4ed8" : "rgba(71,85,105,0.82)";
    ctx.fillText(label, 64, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.8),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
  labelMesh.rotation.x = -Math.PI / 2;
  labelMesh.position.set(0, 0.09, 0);
  return labelMesh;
}

function makeMissingSpot(space: BrightonLotSpace): Spot {
  return {
    id: `brighton-${space.zone.toLowerCase()}-missing-${space.label.toLowerCase()}`,
    label: space.label,
    level: space.zone,
    status: "unknown",
    confidence: 0,
  };
}

function collectRowZs(spaces: readonly BrightonLotSpace[]): number[] {
  // Round to a small precision so floating-point drift between rows in
  // the same band still groups together. Returns sorted unique row Zs.
  const seen = new Set<string>();
  const result: number[] = [];
  for (const space of spaces) {
    const key = space.z.toFixed(3);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(space.z);
    }
  }
  result.sort((a, b) => a - b);
  return result;
}

function computeBounds(spaces: readonly BrightonLotSpace[]): LotBounds {
  if (spaces.length === 0) return { width: 24, depth: 16, radius: 32 };
  const minX = Math.min(...spaces.map((space) => space.x - space.width / 2));
  const maxX = Math.max(...spaces.map((space) => space.x + space.width / 2));
  const minZ = Math.min(...spaces.map((space) => space.z - space.depth / 2));
  const maxZ = Math.max(...spaces.map((space) => space.z + space.depth / 2));
  const width = Math.max(20, maxX - minX + 4);
  const depth = Math.max(14, maxZ - minZ + 5);
  const radius = Math.max(28, Math.max(width, depth) * 0.78);
  return { width, depth, radius };
}

function updateCamera(
  camera: THREE.PerspectiveCamera,
  sph: { theta: number; phi: number; radius: number },
) {
  camera.position.set(
    sph.radius * Math.sin(sph.phi) * Math.sin(sph.theta),
    sph.radius * Math.cos(sph.phi),
    sph.radius * Math.sin(sph.phi) * Math.cos(sph.theta),
  );
  camera.lookAt(0, 0, 0);
}

function getEventPos(event: React.MouseEvent | React.TouchEvent) {
  if ("touches" in event && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  const mouseEvent = event as React.MouseEvent;
  return { x: mouseEvent.clientX, y: mouseEvent.clientY };
}

function getEndEventPos(event: React.MouseEvent | React.TouchEvent) {
  if ("changedTouches" in event && event.changedTouches.length > 0) {
    return {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY,
    };
  }
  const mouseEvent = event as React.MouseEvent;
  return { x: mouseEvent.clientX, y: mouseEvent.clientY };
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Disposes a Three.js subtree without freeing geometry/materials that
 * are shared with other screens.
 *
 * `spawnCarFromModel` from `carModelLoader` returns a wrapper Group
 * tagged with `userData.shared = true` and a `userData.tintedMaterials`
 * array of the per-spot material clones it minted. We free those
 * tinted materials here, but leave the underlying GLB geometry and
 * its source materials alone — the OSU ParkingGarage3D screen depends
 * on the same cached scenes.
 */
function disposeObject3D(object: THREE.Object3D, sharedAncestor = false) {
  const isShared = sharedAncestor || object.userData?.shared === true;

  if (object.userData?.tintedMaterials) {
    const tinted = object.userData.tintedMaterials as THREE.Material[];
    for (const mat of tinted) {
      try {
        mat.dispose();
      } catch {
        /* ignore */
      }
    }
  }

  object.children.slice().forEach((child) => disposeObject3D(child, isShared));

  if (isShared) return;

  const mesh = object as THREE.Mesh;
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) {
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.forEach((material) => {
      const maybeMapped = material as THREE.Material & { map?: THREE.Texture };
      if (maybeMapped.map) maybeMapped.map.dispose();
      material.dispose();
    });
  }
}
