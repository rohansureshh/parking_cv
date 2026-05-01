import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { Spot } from "../../lib/types";

// ──────────────────────────────────────────────────────────────────────
// World units (≈ meters)
// ──────────────────────────────────────────────────────────────────────
const SPOT_W = 2.4;
const SPOT_D = 4.8;
const SPOT_H = 0.08;
const GAP = 0.16;
const LANE_W = 5.8;

const SLAB_HEIGHT = 0.25;
const SLAB_PAD_X = 6;
const SLAB_PAD_Z = 3.2;
const CEILING_Y = 3.8;

const CAR_COLORS = [
  0x2563eb, 0x1d4ed8, 0x3b82f6, 0x1e40af,
  0x475569, 0x64748b, 0x334155,
];

const STATUS_COLOR: Record<Spot["status"], number> = {
  available: 0x3b82f6,
  occupied: 0xef4444,
  unknown: 0x94a3b8,
};
const SELECTED_COLOR = 0x1d4ed8;

// ──────────────────────────────────────────────────────────────────────
// Floor layout — adapts to spot count instead of hard-coding 16 spots.
// Targets ~10 cols at n=40 (sqrt(2.5n) ≈ 10), capped to keep the lot
// from going too wide on huge floors. Always splits rows evenly around
// a central driving lane.
// ──────────────────────────────────────────────────────────────────────
interface FloorLayout {
  cols: number;
  rowsTop: number;
  rowsBottom: number;
  totalRows: number;
  totalW: number;
  floorW: number;
  floorD: number;
  rowZ: number[];
  cameraRadius: number;
}

function computeFloorLayout(numSpots: number): FloorLayout {
  const safeN = Math.max(0, numSpots | 0);
  const cols = safeN === 0
    ? 4
    : Math.min(14, Math.max(4, Math.round(Math.sqrt(safeN * 2.5))));
  const totalRows = safeN === 0 ? 0 : Math.max(2, Math.ceil(safeN / cols));
  const rowsTop = Math.ceil(totalRows / 2);
  const rowsBottom = Math.max(0, totalRows - rowsTop);

  const totalW = cols * SPOT_W + Math.max(0, cols - 1) * GAP;
  const topDepth = rowsTop > 0 ? rowsTop * SPOT_D + (rowsTop - 1) * GAP : 0;
  const botDepth = rowsBottom > 0 ? rowsBottom * SPOT_D + (rowsBottom - 1) * GAP : 0;

  const floorW = Math.max(totalW + SLAB_PAD_X * 2, 18);
  const floorD = Math.max(topDepth + botDepth + LANE_W + SLAB_PAD_Z * 2, 14);

  // North bay = rowIdx 0..rowsTop-1 (negative Z, idx 0 closest to lane).
  // South bay = rowIdx rowsTop..totalRows-1 (positive Z).
  const rowZ: number[] = [];
  for (let i = 0; i < rowsTop; i++) {
    rowZ.push(-(LANE_W / 2 + SPOT_D / 2 + i * (SPOT_D + GAP)));
  }
  for (let i = 0; i < rowsBottom; i++) {
    rowZ.push((LANE_W / 2 + SPOT_D / 2 + i * (SPOT_D + GAP)));
  }

  const cameraRadius = Math.max(28, Math.max(floorW, floorD) * 0.92);

  return {
    cols, rowsTop, rowsBottom, totalRows,
    totalW, floorW, floorD,
    rowZ, cameraRadius,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────
function updateCameraFromSpherical(
  camera: THREE.PerspectiveCamera,
  sph: { theta: number; phi: number; radius: number },
) {
  const { theta, phi, radius } = sph;
  camera.position.set(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.cos(theta),
  );
  camera.lookAt(0, 0, 0);
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function disposeObject3D(obj: THREE.Object3D) {
  const mesh = obj as THREE.Mesh;
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) {
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else {
      mesh.material.dispose();
    }
  }
  // Recurse — child geometries/materials need the same treatment.
  obj.children.slice().forEach((child) => disposeObject3D(child));
}

// ──────────────────────────────────────────────────────────────────────
// Garage shell
// ──────────────────────────────────────────────────────────────────────
function buildGarageStructure(scene: THREE.Scene, layout: FloorLayout): THREE.Group {
  const group = new THREE.Group();
  group.name = "garage-shell";

  // Floor slab
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(layout.floorW, SLAB_HEIGHT, layout.floorD),
    new THREE.MeshLambertMaterial({ color: 0xe8ecf0 }),
  );
  floor.position.y = -SLAB_HEIGHT / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Lane surface
  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(layout.floorW, LANE_W),
    new THREE.MeshLambertMaterial({ color: 0xdde3ea }),
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.y = 0.005;
  group.add(lane);

  // Lane center dashes
  const numDashes = Math.max(4, Math.floor(layout.floorW / 2.5));
  const dashSpacing = layout.floorW / numDashes;
  const dashMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
  });
  for (let i = 0; i < numDashes; i++) {
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(dashSpacing * 0.45, 0.1),
      dashMat,
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(-layout.floorW / 2 + dashSpacing * (i + 0.5), 0.01, 0);
    group.add(dash);
  }

  // Per-stall dividers — short white stripes between adjacent spots in each row
  const dividerMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
  });
  const startX = -layout.totalW / 2 + SPOT_W / 2;
  layout.rowZ.forEach((rz) => {
    for (let c = 0; c <= layout.cols; c++) {
      const x = startX + c * (SPOT_W + GAP) - (SPOT_W + GAP) / 2;
      const div = new THREE.Mesh(
        new THREE.PlaneGeometry(0.07, SPOT_D - 0.15),
        dividerMat,
      );
      div.rotation.x = -Math.PI / 2;
      div.position.set(x, 0.01, rz);
      group.add(div);
    }
  });

  // Structural columns
  const colMat = new THREE.MeshLambertMaterial({ color: 0xc8d0da });
  const colXs = layout.floorW > 24
    ? [-layout.floorW / 2 + 1, 0, layout.floorW / 2 - 1]
    : [-layout.floorW / 2 + 1, layout.floorW / 2 - 1];
  const colZs = [-layout.floorD / 2 + 1, layout.floorD / 2 - 1];
  colXs.forEach((x) => {
    colZs.forEach((z) => {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, CEILING_Y, 0.38),
        colMat,
      );
      col.position.set(x, CEILING_Y / 2, z);
      col.castShadow = true;
      group.add(col);
    });
  });

  // Overhead beams
  const beamMat = new THREE.MeshLambertMaterial({ color: 0xcdd5de });
  [colZs[0], 0, colZs[1]].forEach((z) => {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(layout.floorW, 0.22, 0.38),
      beamMat,
    );
    beam.position.set(0, CEILING_Y, z);
    group.add(beam);
  });

  // LED ceiling strips
  const lightMat = new THREE.MeshLambertMaterial({
    color: 0xe0f2fe,
    emissive: 0xbae6fd,
    emissiveIntensity: 0.6,
  });
  const stripCount = Math.max(4, Math.floor(layout.floorW / 5.2));
  const stripSpacing = layout.floorW / stripCount;
  [-LANE_W / 2 - 2.5, LANE_W / 2 + 2.5].forEach((z) => {
    for (let i = 0; i < stripCount; i++) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(stripSpacing * 0.6, 0.05, 0.18),
        lightMat,
      );
      strip.position.set(
        -layout.floorW / 2 + stripSpacing * (i + 0.5),
        CEILING_Y - 0.2,
        z,
      );
      group.add(strip);
    }
  });

  // Entrance / exit signs
  const makeSign = (text: string, bgColor: string, x: number, rotY: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = bgColor;
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(4, 4, 312, 72, 14);
      ctx.fill();
    } else {
      ctx.fillRect(4, 4, 312, 72);
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px -apple-system, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 160, 40);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshLambertMaterial({
      map: tex,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.7), mat);
    sign.position.set(x, 2.6, 0);
    sign.rotation.y = rotY;
    group.add(sign);
  };
  makeSign("ENTRANCE →", "#2563eb", layout.floorW / 2 + 0.5, -Math.PI / 2);
  makeSign("← EXIT", "#64748b", -layout.floorW / 2 - 0.5, Math.PI / 2);

  scene.add(group);
  return group;
}

// ──────────────────────────────────────────────────────────────────────
// One sleek fastback EV — kept simple but more refined than blocks.
// ──────────────────────────────────────────────────────────────────────
function buildCar(scene: THREE.Scene, x: number, z: number, colorIndex: number): THREE.Group {
  const carGroup = new THREE.Group();
  const color = CAR_COLORS[colorIndex % CAR_COLORS.length];

  const bodyMat = new THREE.MeshPhongMaterial({ color, shininess: 80, specular: 0x334155 });
  const darkMat = new THREE.MeshPhongMaterial({ color: 0x0f172a, shininess: 30 });
  const glassMat = new THREE.MeshPhongMaterial({
    color: 0x1e3a5f, transparent: true, opacity: 0.75,
    shininess: 120, specular: 0x7dd3fc,
  });
  const chromeMat = new THREE.MeshPhongMaterial({
    color: 0xe2e8f0, shininess: 200, specular: 0xffffff,
  });
  const drlMat = new THREE.MeshPhongMaterial({
    color: 0xdbeafe, emissive: 0x93c5fd, emissiveIntensity: 0.9, shininess: 100,
  });
  const tailMat = new THREE.MeshPhongMaterial({
    color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.8, shininess: 100,
  });
  const hubCapMat = new THREE.MeshPhongMaterial({ color: 0xf8fafc, shininess: 150 });

  const W = SPOT_W;
  const D = SPOT_D;
  const base = SPOT_H;

  // Lower skirt
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(W * 0.88, 0.1, D * 0.72), darkMat);
  skirt.position.y = base + 0.05;
  carGroup.add(skirt);

  // Body (lower, mid, fastback cabin front + rear)
  const body = new THREE.Mesh(new THREE.BoxGeometry(W * 0.84, 0.28, D * 0.7), bodyMat);
  body.position.y = base + 0.19;
  body.castShadow = true;
  carGroup.add(body);

  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(W * 0.76, 0.12, D * 0.68), bodyMat);
  shoulder.position.y = base + 0.36;
  carGroup.add(shoulder);

  const cabinFront = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.64, 0.24, D * 0.22), bodyMat,
  );
  cabinFront.position.set(0, base + 0.54, D * 0.1);
  carGroup.add(cabinFront);

  const cabinRear = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.6, 0.14, D * 0.2), bodyMat,
  );
  cabinRear.position.set(0, base + 0.48, -D * 0.1);
  carGroup.add(cabinRear);

  // Pano glass roof + raked windshield + rear screen
  const roofGlass = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.58, 0.04, D * 0.34), glassMat,
  );
  roofGlass.position.set(0, base + 0.66, 0);
  carGroup.add(roofGlass);

  const ws = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, 0.28, 0.06), glassMat);
  ws.rotation.x = 0.72;
  ws.position.set(0, base + 0.52, D * 0.195);
  carGroup.add(ws);

  const rs = new THREE.Mesh(new THREE.BoxGeometry(W * 0.56, 0.22, 0.06), glassMat);
  rs.rotation.x = -0.62;
  rs.position.set(0, base + 0.5, -D * 0.185);
  carGroup.add(rs);

  // Side glass + slim A-pillars + flush handles
  const sideGlassGeo = new THREE.BoxGeometry(0.03, 0.16, D * 0.3);
  [-1, 1].forEach((s) => {
    const sg = new THREE.Mesh(sideGlassGeo, glassMat);
    sg.position.set(s * W * 0.32, base + 0.55, 0);
    carGroup.add(sg);
  });

  const pillarGeo = new THREE.BoxGeometry(0.05, 0.22, 0.05);
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(pillarGeo, darkMat);
    p.rotation.x = 0.55;
    p.position.set(s * W * 0.3, base + 0.52, D * 0.19);
    carGroup.add(p);
  });

  const handleGeo = new THREE.BoxGeometry(0.02, 0.04, 0.22);
  [-1, 1].forEach((s) => {
    const h = new THREE.Mesh(handleGeo, chromeMat);
    h.position.set(s * W * 0.425, base + 0.32, -D * 0.02);
    carGroup.add(h);
  });

  // Hood, trunk, bumpers
  const hood = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.05, D * 0.18), bodyMat);
  hood.position.set(0, base + 0.33, D * 0.26);
  carGroup.add(hood);

  const trunk = new THREE.Mesh(new THREE.BoxGeometry(W * 0.76, 0.05, D * 0.14), bodyMat);
  trunk.position.set(0, base + 0.36, -D * 0.28);
  carGroup.add(trunk);

  const bumpF = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.18, 0.06), darkMat);
  bumpF.position.set(0, base + 0.12, D * 0.36);
  carGroup.add(bumpF);

  const bumpR = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.18, 0.06), darkMat);
  bumpR.position.set(0, base + 0.12, -D * 0.36);
  carGroup.add(bumpR);

  // Full-width DRL + tail light bars (Tesla-style)
  const drl = new THREE.Mesh(new THREE.BoxGeometry(W * 0.72, 0.035, 0.04), drlMat);
  drl.position.set(0, base + 0.26, D * 0.365);
  carGroup.add(drl);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.74, 0.035, 0.04), tailMat);
  tail.position.set(0, base + 0.28, -D * 0.362);
  carGroup.add(tail);

  // Wheels — low-profile aero discs
  const tireGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.13, 20);
  const rimGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.14, 16);
  const hubCapGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 12);
  const spokeGeo = new THREE.BoxGeometry(0.16, 0.015, 0.02);

  const wheelOffsets: ReadonlyArray<readonly [number, number]> = [
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];
  wheelOffsets.forEach(([sx, sz]) => {
    const wx = sx * W * 0.415;
    const wzp = sz * D * 0.255;
    const wy = base + 0.03;

    const tire = new THREE.Mesh(tireGeo, darkMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(wx, wy, wzp);
    carGroup.add(tire);

    const rim = new THREE.Mesh(rimGeo, chromeMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, wy, wzp);
    carGroup.add(rim);

    const hubCap = new THREE.Mesh(hubCapGeo, hubCapMat);
    hubCap.rotation.z = Math.PI / 2;
    hubCap.position.set(wx, wy, wzp);
    carGroup.add(hubCap);

    for (let a = 0; a < 5; a++) {
      const spoke = new THREE.Mesh(spokeGeo, darkMat);
      spoke.rotation.z = Math.PI / 2;
      spoke.rotation.x = (a / 5) * Math.PI * 2;
      spoke.position.set(wx + (sx > 0 ? 0.07 : -0.07), wy, wzp);
      carGroup.add(spoke);
    }
  });

  // Side rocker panels
  [-1, 1].forEach((s) => {
    const rocker = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.08, D * 0.58), darkMat,
    );
    rocker.position.set(s * W * 0.445, base + 0.08, 0);
    carGroup.add(rocker);
  });

  carGroup.position.set(x, 0, z);
  scene.add(carGroup);
  return carGroup;
}

// ──────────────────────────────────────────────────────────────────────
// Spot pads, labels, selection glow, and cars on occupied spots.
// ──────────────────────────────────────────────────────────────────────
interface SpotUserData {
  spot: Spot;
  isSpot: true;
}

interface BuiltSpots {
  meshes: THREE.Mesh[];     // raycaster targets
  extras: THREE.Object3D[]; // labels / cars / selection glow
}

function buildSpotMeshes(
  scene: THREE.Scene,
  spots: Spot[],
  selectedSpot: Spot | null,
  layout: FloorLayout,
): BuiltSpots {
  const meshes: THREE.Mesh[] = [];
  const extras: THREE.Object3D[] = [];
  const slotCount = layout.cols * layout.totalRows;
  const renderable = spots.slice(0, slotCount);
  const startX = -layout.totalW / 2 + SPOT_W / 2;

  renderable.forEach((spot, idx) => {
    const rowIdx = Math.floor(idx / layout.cols);
    const colIdx = idx % layout.cols;
    const z = layout.rowZ[rowIdx];
    if (z === undefined) return;
    const x = startX + colIdx * (SPOT_W + GAP);
    const isSelected = selectedSpot?.id === spot.id;
    const color = isSelected
      ? SELECTED_COLOR
      : (STATUS_COLOR[spot.status] ?? STATUS_COLOR.unknown);

    // Pad — thin slab, raycaster target
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(SPOT_W - 0.14, SPOT_H, SPOT_D - 0.14),
      new THREE.MeshLambertMaterial({
        color,
        transparent: spot.status === "unknown",
        opacity: spot.status === "unknown" ? 0.6 : 1.0,
      }),
    );
    pad.position.set(x, SPOT_H / 2, z);
    pad.receiveShadow = true;
    const userData: SpotUserData = { spot, isSpot: true };
    pad.userData = userData;
    scene.add(pad);
    meshes.push(pad);

    // Selection halo + glow + pulse (only when selected)
    if (isSelected) {
      const border = new THREE.Mesh(
        new THREE.BoxGeometry(SPOT_W + 0.14, 0.04, SPOT_D + 0.14),
        new THREE.MeshLambertMaterial({
          color: 0x60a5fa, transparent: true, opacity: 0.9,
        }),
      );
      border.position.set(x, SPOT_H + 0.02, z);
      scene.add(border);
      extras.push(border);

      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(SPOT_W + 0.4, SPOT_D + 0.4),
        new THREE.MeshLambertMaterial({
          color: 0x3b82f6, transparent: true, opacity: 0.18,
        }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x, SPOT_H + 0.05, z);
      scene.add(glow);
      extras.push(glow);

      if (spot.status === "available") {
        const pulse = new THREE.Mesh(
          new THREE.BoxGeometry(SPOT_W + 0.5, 0.03, SPOT_D + 0.5),
          new THREE.MeshLambertMaterial({
            color: 0x93c5fd, transparent: true, opacity: 0.25,
          }),
        );
        pulse.position.set(x, SPOT_H + 0.07, z);
        scene.add(pulse);
        extras.push(pulse);
      }
    }

    // Spot label (canvas texture, painted onto a small plane on the floor)
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 128, 64);
      ctx.fillStyle = isSelected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.82)";
      ctx.font = `bold ${isSelected ? 30 : 24}px -apple-system, Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(spot.label, 64, 32);
    }
    const labelTex = new THREE.CanvasTexture(canvas);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(SPOT_W - 0.5, (SPOT_W - 0.5) * 0.48),
      new THREE.MeshLambertMaterial({
        map: labelTex, transparent: true, side: THREE.DoubleSide,
      }),
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(x, SPOT_H + 0.015, z);
    scene.add(label);
    extras.push(label);

    // Car for occupied stalls
    if (spot.status === "occupied") {
      const car = buildCar(scene, x, z, hashCode(spot.id) % CAR_COLORS.length);
      extras.push(car);
    }
  });

  return { meshes, extras };
}

// ──────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────
interface ParkingGarage3DProps {
  /** Spots for the *currently selected* floor only — caller filters by level. */
  spots: Spot[];
  selectedSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
}

interface InternalState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  sph: { theta: number; phi: number; radius: number };
  spotMeshes: THREE.Mesh[];
  spotExtras: THREE.Object3D[];
  garageGroup: THREE.Group;
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  layout: FloorLayout;
  isDragging: boolean;
  hasDragged: boolean;
  prevMouse: { x: number; y: number };
  animId: number | null;
}

function getEventPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
  if ("touches" in e && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  const me = e as React.MouseEvent;
  return { x: me.clientX, y: me.clientY };
}

function getEndEventPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
  if ("changedTouches" in e && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  const me = e as React.MouseEvent;
  return { x: me.clientX, y: me.clientY };
}

export default function ParkingGarage3D({
  spots,
  selectedSpot,
  onSelectSpot,
}: ParkingGarage3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<InternalState | null>(null);
  const spotsRef = useRef(spots);
  const selectedRef = useRef(selectedSpot);
  const onSelectRef = useRef(onSelectSpot);

  useEffect(() => { spotsRef.current = spots; }, [spots]);
  useEffect(() => { selectedRef.current = selectedSpot; }, [selectedSpot]);
  useEffect(() => { onSelectRef.current = onSelectSpot; }, [onSelectSpot]);

  // Initial Three.js scene setup — runs once per mount.
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const initialLayout = computeFloorLayout(spotsRef.current.length);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);
    scene.fog = new THREE.FogExp2(0xf0f4f8, 0.016);

    const camera = new THREE.PerspectiveCamera(
      46,
      el.clientWidth / Math.max(1, el.clientHeight),
      0.1, 200,
    );
    const sph = { theta: 0.45, phi: 0.82, radius: initialLayout.cameraRadius };
    updateCameraFromSpherical(camera, sph);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);

    // Lighting — clean, blue-tinted
    scene.add(new THREE.AmbientLight(0xf0f8ff, 0.85));

    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(20, 32, 14);
    sun.castShadow = true;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const fillLight = new THREE.DirectionalLight(0xbfdbfe, 0.45);
    fillLight.position.set(-14, 18, -16);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 0.25);
    rimLight.position.set(0, -5, 20);
    scene.add(rimLight);

    const garageGroup = buildGarageStructure(scene, initialLayout);
    const built = buildSpotMeshes(
      scene, spotsRef.current, selectedRef.current, initialLayout,
    );

    const state: InternalState = {
      scene, camera, renderer, sph,
      spotMeshes: built.meshes,
      spotExtras: built.extras,
      garageGroup,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),
      layout: initialLayout,
      isDragging: false,
      hasDragged: false,
      prevMouse: { x: 0, y: 0 },
      animId: null,
    };
    stateRef.current = state;

    const animate = () => {
      state.animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);

    return () => {
      if (state.animId !== null) cancelAnimationFrame(state.animId);
      ro.disconnect();
      [...state.spotMeshes, ...state.spotExtras].forEach((obj) => {
        scene.remove(obj);
        disposeObject3D(obj);
      });
      scene.remove(state.garageGroup);
      disposeObject3D(state.garageGroup);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  // Re-run on data change: rebuild spots, and rebuild the garage shell if
  // the floor's spot count caused a different layout (cols/rows/floor size).
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;

    [...s.spotMeshes, ...s.spotExtras].forEach((obj) => {
      s.scene.remove(obj);
      disposeObject3D(obj);
    });

    const next = computeFloorLayout(spots.length);
    const layoutChanged =
      next.cols !== s.layout.cols ||
      next.totalRows !== s.layout.totalRows ||
      Math.abs(next.floorW - s.layout.floorW) > 0.01 ||
      Math.abs(next.floorD - s.layout.floorD) > 0.01;

    if (layoutChanged) {
      s.scene.remove(s.garageGroup);
      disposeObject3D(s.garageGroup);
      s.garageGroup = buildGarageStructure(s.scene, next);
      s.sph.radius = next.cameraRadius;
      updateCameraFromSpherical(s.camera, s.sph);
      s.layout = next;
    }

    const built = buildSpotMeshes(s.scene, spots, selectedSpot, s.layout);
    s.spotMeshes = built.meshes;
    s.spotExtras = built.extras;
  }, [spots, selectedSpot]);

  // ── Pointer / touch / wheel handlers ────────────────────────────────
  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const s = stateRef.current;
    if (!s) return;
    const pos = getEventPos(e);
    s.isDragging = true;
    s.hasDragged = false;
    s.prevMouse = pos;
  }, []);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const s = stateRef.current;
    if (!s || !s.isDragging) return;
    const pos = getEventPos(e);
    const dx = pos.x - s.prevMouse.x;
    const dy = pos.y - s.prevMouse.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) s.hasDragged = true;
    s.sph.theta -= dx * 0.008;
    s.sph.phi = Math.max(0.2, Math.min(1.35, s.sph.phi + dy * 0.008));
    s.prevMouse = pos;
    updateCameraFromSpherical(s.camera, s.sph);
  }, []);

  const onPointerUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const s = stateRef.current;
    if (!s) return;
    if (!s.hasDragged) {
      const el = s.renderer.domElement;
      const rect = el.getBoundingClientRect();
      const src = getEndEventPos(e);
      s.mouse.x = ((src.x - rect.left) / rect.width) * 2 - 1;
      s.mouse.y = -((src.y - rect.top) / rect.height) * 2 + 1;
      s.raycaster.setFromCamera(s.mouse, s.camera);
      const hits = s.raycaster.intersectObjects(s.spotMeshes);
      for (const hit of hits) {
        const data = hit.object.userData as Partial<SpotUserData>;
        if (data.spot && data.spot.status === "available") {
          onSelectRef.current(data.spot);
          break;
        }
      }
    }
    s.isDragging = false;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const s = stateRef.current;
    if (!s) return;
    const minR = 14;
    const maxR = Math.max(60, s.layout.cameraRadius * 2);
    s.sph.radius = Math.max(minR, Math.min(maxR, s.sph.radius + e.deltaY * 0.055));
    updateCameraFromSpherical(s.camera, s.sph);
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
