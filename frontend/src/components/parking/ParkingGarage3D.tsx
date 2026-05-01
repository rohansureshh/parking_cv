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
const SLAB_PAD_X = 6.5;
const SLAB_PAD_Z = 3.6;
const CEILING_Y = 3.6;

// Showroom palette — mostly silvers/blacks/whites with one accent blue.
// One car per "garage" tends to be the brand-blue Model 3 hero.
const CAR_COLORS = [
  0x1e293b, 0x111827, 0x334155, 0x475569,
  0x64748b, 0xcbd5e1, 0xe2e8f0, 0xf8fafc,
  0x2563eb,
];

// Painted-line colors per status (the floor itself is light gray; spots
// are indicated by tinted outlines, not solid pads).
const PAINT_COLOR = {
  available: 0xffffff,
  occupied: 0xfca5a5,   // rose-300, gives a warm coral glow
  unknown: 0xcbd5e1,    // slate-300
  selected: 0x2563eb,   // brand blue
} as const;

const PAINT_OPACITY = {
  available: 0.55,
  occupied: 0.85,
  unknown: 0.45,
  selected: 1.0,
} as const;

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
  obj.children.slice().forEach((child) => disposeObject3D(child));
}

// ──────────────────────────────────────────────────────────────────────
// Garage shell — cleaner architecture, brighter tones
// ──────────────────────────────────────────────────────────────────────
function buildGarageStructure(scene: THREE.Scene, layout: FloorLayout): THREE.Group {
  const group = new THREE.Group();
  group.name = "garage-shell";

  // Floor slab — bright near-white concrete
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(layout.floorW, SLAB_HEIGHT, layout.floorD),
    new THREE.MeshStandardMaterial({
      color: 0xeef2f7,
      roughness: 0.78,
      metalness: 0.05,
    }),
  );
  floor.position.y = -SLAB_HEIGHT / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Lane surface — slightly cooler/darker than slab for contrast
  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(layout.floorW, LANE_W),
    new THREE.MeshStandardMaterial({
      color: 0xdde4ec,
      roughness: 0.85,
      metalness: 0.0,
    }),
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.y = 0.005;
  lane.receiveShadow = true;
  group.add(lane);

  // Lane center dashes
  const numDashes = Math.max(4, Math.floor(layout.floorW / 2.5));
  const dashSpacing = layout.floorW / numDashes;
  const dashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.65,
  });
  for (let i = 0; i < numDashes; i++) {
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(dashSpacing * 0.45, 0.1),
      dashMat,
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(-layout.floorW / 2 + dashSpacing * (i + 0.5), 0.011, 0);
    group.add(dash);
  }

  // Driving direction arrows on the lane (every ~5 units, pointing east)
  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.4,
  });
  const arrowSpacing = 5.0;
  const numArrows = Math.max(2, Math.floor((layout.floorW - 4) / arrowSpacing));
  for (let i = 0; i < numArrows; i++) {
    const ax = -layout.floorW / 2 + 2 + i * arrowSpacing + arrowSpacing / 2;
    [-LANE_W / 4, LANE_W / 4].forEach((az) => {
      const arrow = new THREE.Group();
      // Stem
      const stem = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.07), arrowMat);
      stem.rotation.x = -Math.PI / 2;
      stem.position.set(0, 0.012, 0);
      arrow.add(stem);
      // Two diagonal flicks forming the chevron head
      [-1, 1].forEach((s) => {
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.07), arrowMat);
        fl.rotation.x = -Math.PI / 2;
        fl.rotation.z = s * Math.PI / 4;
        fl.position.set(0.27, 0.012, s * 0.13);
        arrow.add(fl);
      });
      arrow.position.set(ax, 0, az);
      group.add(arrow);
    });
  }

  // Per-stall painted lines come from buildSpotMeshes (status-tinted),
  // so the shell only paints lane stripes — keeps the lot crisp.

  // Slim structural columns — lighter color, more architectural
  const colMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0, roughness: 0.4, metalness: 0.15,
  });
  const colXs = layout.floorW > 24
    ? [-layout.floorW / 2 + 1.2, 0, layout.floorW / 2 - 1.2]
    : [-layout.floorW / 2 + 1.2, layout.floorW / 2 - 1.2];
  const colZs = [-layout.floorD / 2 + 1.2, layout.floorD / 2 - 1.2];
  colXs.forEach((x) => {
    colZs.forEach((z) => {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, CEILING_Y, 0.32),
        colMat,
      );
      col.position.set(x, CEILING_Y / 2, z);
      col.castShadow = true;
      group.add(col);
    });
  });

  // Overhead beams — thin and clean
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0xd5dde6, roughness: 0.55, metalness: 0.1,
  });
  [colZs[0], 0, colZs[1]].forEach((z) => {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(layout.floorW, 0.18, 0.32),
      beamMat,
    );
    beam.position.set(0, CEILING_Y, z);
    group.add(beam);
  });

  // Back guardrails along the far edges of each row bay (architectural detail)
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xb8c2cc, roughness: 0.35, metalness: 0.5,
  });
  const farTopZ = layout.rowZ.length > 0 ? Math.min(...layout.rowZ) - SPOT_D / 2 - 0.6 : -layout.floorD / 2 + 1;
  const farBotZ = layout.rowZ.length > 0 ? Math.max(...layout.rowZ) + SPOT_D / 2 + 0.6 : layout.floorD / 2 - 1;

  const buildRail = (z: number) => {
    // Top rail
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(layout.floorW * 0.86, 0.06, 0.06),
      railMat,
    );
    top.position.set(0, 0.95, z);
    group.add(top);
    // Bottom rail
    const bot = new THREE.Mesh(
      new THREE.BoxGeometry(layout.floorW * 0.86, 0.04, 0.04),
      railMat,
    );
    bot.position.set(0, 0.30, z);
    group.add(bot);
    // Vertical posts every ~2 units
    const postCount = Math.max(4, Math.floor(layout.floorW / 2));
    const postSpacing = (layout.floorW * 0.86) / postCount;
    for (let i = 0; i <= postCount; i++) {
      const px = -(layout.floorW * 0.86) / 2 + i * postSpacing;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 1.0, 0.04),
        railMat,
      );
      post.position.set(px, 0.5, z);
      group.add(post);
    }
  };
  buildRail(farTopZ);
  buildRail(farBotZ);

  // LED ceiling strips — soft cool glow, parallel to the lane
  const lightMat = new THREE.MeshBasicMaterial({
    color: 0xf1faff,
    transparent: true,
    opacity: 0.95,
  });
  const stripCount = Math.max(4, Math.floor(layout.floorW / 5.0));
  const stripSpacing = layout.floorW / stripCount;
  [-LANE_W / 2 - 2.0, LANE_W / 2 + 2.0].forEach((z) => {
    for (let i = 0; i < stripCount; i++) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(stripSpacing * 0.6, 0.04, 0.16),
        lightMat,
      );
      strip.position.set(
        -layout.floorW / 2 + stripSpacing * (i + 0.5),
        CEILING_Y - 0.18,
        z,
      );
      group.add(strip);
    }
  });

  scene.add(group);
  return group;
}

// ──────────────────────────────────────────────────────────────────────
// Sleek EV — lower silhouette, smoother proportions, glossier paint
// ──────────────────────────────────────────────────────────────────────
function buildCar(scene: THREE.Scene, x: number, z: number, colorIndex: number): THREE.Group {
  const carGroup = new THREE.Group();
  const color = CAR_COLORS[colorIndex % CAR_COLORS.length];

  // Use Standard materials for PBR-ish glossy paint
  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.32, metalness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0b1220, roughness: 0.55, metalness: 0.3,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0e1a2e, transparent: true, opacity: 0.78,
    roughness: 0.05, metalness: 0.2,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xeef2f6, roughness: 0.18, metalness: 0.85,
  });
  const drlMat = new THREE.MeshStandardMaterial({
    color: 0xf0f9ff, emissive: 0xbfdbfe, emissiveIntensity: 0.9,
    roughness: 0.3, metalness: 0.1,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626, emissive: 0xef4444, emissiveIntensity: 0.85,
    roughness: 0.3, metalness: 0.1,
  });

  const W = SPOT_W;
  const D = SPOT_D;
  const base = SPOT_H + 0.005;

  // Lower skirt — narrower, hugs the ground
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.86, 0.08, D * 0.7),
    darkMat,
  );
  skirt.position.y = base + 0.04;
  carGroup.add(skirt);

  // Main body — wider, lower than before for a "Model 3" stance
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.82, 0.22, D * 0.66),
    bodyMat,
  );
  body.position.y = base + 0.155;
  body.castShadow = true;
  carGroup.add(body);

  // Shoulder line — slightly narrower, gives the side crease
  const shoulder = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.74, 0.10, D * 0.64),
    bodyMat,
  );
  shoulder.position.y = base + 0.30;
  carGroup.add(shoulder);

  // Single sloped cabin (smoother fastback than two stacked boxes)
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.62, 0.20, D * 0.46),
    bodyMat,
  );
  cabin.position.set(0, base + 0.46, -D * 0.01);
  carGroup.add(cabin);

  // Pano roof glass — thin strip up top
  const roofGlass = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.56, 0.03, D * 0.4),
    glassMat,
  );
  roofGlass.position.set(0, base + 0.575, 0);
  carGroup.add(roofGlass);

  // Windshield — raked
  const ws = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.58, 0.24, 0.05),
    glassMat,
  );
  ws.rotation.x = 0.78;
  ws.position.set(0, base + 0.46, D * 0.21);
  carGroup.add(ws);

  // Rear screen — raked the other way
  const rs = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.56, 0.20, 0.05),
    glassMat,
  );
  rs.rotation.x = -0.62;
  rs.position.set(0, base + 0.44, -D * 0.20);
  carGroup.add(rs);

  // Side glass — slim, frameless
  const sideGlassGeo = new THREE.BoxGeometry(0.025, 0.13, D * 0.32);
  [-1, 1].forEach((s) => {
    const sg = new THREE.Mesh(sideGlassGeo, glassMat);
    sg.position.set(s * W * 0.305, base + 0.475, 0);
    carGroup.add(sg);
  });

  // Hood — long and flat
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.78, 0.04, D * 0.20),
    bodyMat,
  );
  hood.position.set(0, base + 0.275, D * 0.27);
  carGroup.add(hood);

  // Trunk lid
  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.74, 0.04, D * 0.16),
    bodyMat,
  );
  trunk.position.set(0, base + 0.30, -D * 0.27);
  carGroup.add(trunk);

  // Front fascia
  const bumpF = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.80, 0.14, 0.05),
    darkMat,
  );
  bumpF.position.set(0, base + 0.10, D * 0.36);
  carGroup.add(bumpF);

  // Rear bumper
  const bumpR = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.78, 0.14, 0.05),
    darkMat,
  );
  bumpR.position.set(0, base + 0.10, -D * 0.36);
  carGroup.add(bumpR);

  // Full-width DRL (Tesla-style)
  const drl = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.70, 0.03, 0.04),
    drlMat,
  );
  drl.position.set(0, base + 0.21, D * 0.365);
  carGroup.add(drl);

  // Tail light bar
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.72, 0.03, 0.04),
    tailMat,
  );
  tail.position.set(0, base + 0.23, -D * 0.362);
  carGroup.add(tail);

  // Wheels — clean aero discs (no spokes; faster + cleaner look)
  const tireGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.13, 24);
  const rimGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.135, 24);
  const hubCapGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.14, 16);
  const hubCapMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1, roughness: 0.25, metalness: 0.6,
  });

  const wheelOffsets: ReadonlyArray<readonly [number, number]> = [
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];
  wheelOffsets.forEach(([sx, sz]) => {
    const wx = sx * W * 0.41;
    const wzp = sz * D * 0.25;
    const wy = base + 0.02;

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
  });

  // Side rocker panels — subtle ground effect
  [-1, 1].forEach((s) => {
    const rocker = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.06, D * 0.56),
      darkMat,
    );
    rocker.position.set(s * W * 0.43, base + 0.07, 0);
    carGroup.add(rocker);
  });

  carGroup.position.set(x, 0, z);
  scene.add(carGroup);
  return carGroup;
}

// ──────────────────────────────────────────────────────────────────────
// Spot rendering — outline-style painted lines + status glow
// ──────────────────────────────────────────────────────────────────────
interface SpotUserData {
  spot: Spot;
  isSpot: true;
}

interface BuiltSpots {
  meshes: THREE.Mesh[];     // raycaster targets (invisible pads)
  extras: THREE.Object3D[]; // outlines, glow planes, labels, cars
}

function makeSpotOutline(
  centerX: number,
  centerZ: number,
  status: keyof typeof PAINT_COLOR,
  thickness: number,
  yOffset: number,
): THREE.Group {
  const g = new THREE.Group();
  const w = SPOT_W - 0.10;
  const d = SPOT_D - 0.10;
  const mat = new THREE.MeshBasicMaterial({
    color: PAINT_COLOR[status],
    transparent: true,
    opacity: PAINT_OPACITY[status],
  });
  // Long edges (along Z)
  [-1, 1].forEach((s) => {
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(thickness, d),
      mat,
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(centerX + s * (w / 2 - thickness / 2), yOffset, centerZ);
    g.add(edge);
  });
  // Short edges (along X)
  [-1, 1].forEach((s) => {
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(w, thickness),
      mat,
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(centerX, yOffset, centerZ + s * (d / 2 - thickness / 2));
    g.add(edge);
  });
  return g;
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

    // Invisible click target — always present so any spot can be raycast.
    // Only "available" status fires the onSelect callback though.
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(SPOT_W - 0.14, SPOT_H, SPOT_D - 0.14),
      new THREE.MeshBasicMaterial({
        color: isSelected ? 0x2563eb : 0xffffff,
        transparent: true,
        opacity: isSelected ? 0.18 : 0.0,
      }),
    );
    pad.position.set(x, SPOT_H / 2, z);
    pad.receiveShadow = true;
    const userData: SpotUserData = { spot, isSpot: true };
    pad.userData = userData;
    scene.add(pad);
    meshes.push(pad);

    // Painted-line outline — always present, status-tinted
    const baseOutline = makeSpotOutline(x, z, spot.status, 0.06, 0.012);
    scene.add(baseOutline);
    extras.push(baseOutline);

    // Selected: thicker bright-blue outline + inner blue glow + corner accents
    if (isSelected) {
      const thickOutline = makeSpotOutline(x, z, "selected", 0.10, 0.018);
      scene.add(thickOutline);
      extras.push(thickOutline);

      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(SPOT_W * 1.05, SPOT_D * 1.05),
        new THREE.MeshBasicMaterial({
          color: 0x60a5fa, transparent: true, opacity: 0.22,
        }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x, 0.024, z);
      scene.add(glow);
      extras.push(glow);

      // Bright corner accents
      const cornerMat = new THREE.MeshBasicMaterial({
        color: 0x2563eb, transparent: true, opacity: 1.0,
      });
      const cornerSize = 0.22;
      const halfW = (SPOT_W - 0.10) / 2;
      const halfD = (SPOT_D - 0.10) / 2;
      [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sz) => {
          const c = new THREE.Mesh(
            new THREE.PlaneGeometry(cornerSize, cornerSize),
            cornerMat,
          );
          c.rotation.x = -Math.PI / 2;
          c.position.set(x + sx * halfW, 0.030, z + sz * halfD);
          scene.add(c);
          extras.push(c);
        });
      });
    }

    // Spot label — only for available + selected (occupied has the car)
    if (spot.status === "available" || isSelected) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 128, 64);
        ctx.fillStyle = isSelected
          ? "rgba(255,255,255,0.98)"
          : "rgba(100,116,139,0.85)";
        ctx.font = `bold ${isSelected ? 30 : 22}px -apple-system, "SF Pro Display", system-ui, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(spot.label, 64, 32);
      }
      const labelTex = new THREE.CanvasTexture(canvas);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(SPOT_W - 0.6, (SPOT_W - 0.6) * 0.5),
        new THREE.MeshBasicMaterial({
          map: labelTex, transparent: true, side: THREE.DoubleSide,
        }),
      );
      label.rotation.x = -Math.PI / 2;
      label.position.set(x, 0.020, z);
      scene.add(label);
      extras.push(label);
    }

    // Car for occupied spots
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
  /**
   * Bump this number to recenter the camera to the default spherical
   * coordinates (used by the floating recenter button).
   */
  viewVersion?: number;
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

const DEFAULT_THETA = 0.55;
const DEFAULT_PHI = 0.78;

export default function ParkingGarage3D({
  spots,
  selectedSpot,
  onSelectSpot,
  viewVersion = 0,
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
    scene.background = new THREE.Color(0xf3f6fa);
    // Mild fog so far-back spots gently fade — keeps the scene airy
    scene.fog = new THREE.FogExp2(0xf3f6fa, 0.012);

    const camera = new THREE.PerspectiveCamera(
      44,
      el.clientWidth / Math.max(1, el.clientHeight),
      0.1, 200,
    );
    const sph = {
      theta: DEFAULT_THETA,
      phi: DEFAULT_PHI,
      radius: initialLayout.cameraRadius,
    };
    updateCameraFromSpherical(camera, sph);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    el.appendChild(renderer.domElement);

    // Lighting — bright, cool, evenly lit showroom feel
    scene.add(new THREE.AmbientLight(0xeef4ff, 1.05));

    const sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(18, 28, 12);
    sun.castShadow = true;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    const fillLight = new THREE.DirectionalLight(0xc7dafd, 0.55);
    fillLight.position.set(-16, 20, -18);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.35);
    rimLight.position.set(0, 6, -22);
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

  // Recenter the camera when the parent bumps viewVersion. We skip the
  // initial value because the scene already starts at the default angle.
  useEffect(() => {
    if (viewVersion === 0) return;
    const s = stateRef.current;
    if (!s) return;
    s.sph.theta = DEFAULT_THETA;
    s.sph.phi = DEFAULT_PHI;
    s.sph.radius = s.layout.cameraRadius;
    updateCameraFromSpherical(s.camera, s.sph);
  }, [viewVersion]);

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
