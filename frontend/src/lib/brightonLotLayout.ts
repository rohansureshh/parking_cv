import { BRIGHTON_MOCK_ZONES } from "./brightonMockZones";
import type { Spot } from "./types";

export type BrightonZone = "Z1" | "Z2" | "Z3";

type Point = readonly [number, number];

interface CalibratedSpotPolygon {
  label: string;
  polygon: readonly Point[];
}

export interface BrightonLotSpace {
  label: string;
  zone: BrightonZone;
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  source: "calibrated" | "generated";
}

/**
 * Brighton Zone 1 calibration data. The polygon coordinates here come
 * from the YOLO camera image space (top-left origin, perspective
 * distorted) and are used ONLY to infer the real-world row grouping
 * and within-row left/right ordering. They are never plugged directly
 * into the 3D scene — the camera angle is too oblique for that to read
 * cleanly. Instead, every label below is assigned to a clean stall in
 * a standardized surface-lot grid while preserving its row + neighbour
 * order from this calibration.
 */
const BRIGHTON_ZONE1_POLYGONS: readonly CalibratedSpotPolygon[] = [
  { label: "S01", polygon: [[83, 852], [176, 847], [111, 1007], [62, 974]] },
  { label: "S02", polygon: [[187, 847], [391, 842], [229, 1004], [121, 1005]] },
  { label: "S03", polygon: [[402, 835], [548, 832], [462, 1002], [285, 1003]] },
  { label: "S04", polygon: [[727, 821], [907, 810], [915, 1007], [683, 1007]] },
  { label: "S05", polygon: [[916, 809], [1085, 796], [1169, 1003], [928, 1001]] },
  { label: "S06", polygon: [[1098, 798], [1258, 788], [1385, 991], [1174, 1001]] },
  { label: "S07", polygon: [[1265, 788], [1424, 779], [1571, 964], [1399, 990]] },
  { label: "S08", polygon: [[1433, 782], [1542, 775], [1727, 937], [1578, 963]] },
  { label: "S09", polygon: [[1549, 777], [1700, 771], [1837, 908], [1746, 935]] },
  { label: "S10", polygon: [[1707, 771], [1756, 763], [1917, 884], [1852, 913]] },
  { label: "S11", polygon: [[118, 798], [179, 743], [257, 744], [181, 818]] },
  { label: "S12", polygon: [[264, 744], [377, 729], [285, 835], [193, 829]] },
  { label: "S13", polygon: [[387, 726], [496, 722], [403, 833], [303, 838]] },
  { label: "S14", polygon: [[506, 717], [622, 714], [556, 827], [412, 832]] },
  { label: "S15", polygon: [[760, 704], [896, 697], [903, 811], [740, 815]] },
  { label: "S16", polygon: [[907, 698], [1047, 684], [1086, 792], [924, 807]] },
  { label: "S17", polygon: [[1061, 686], [1189, 680], [1254, 787], [1098, 796]] },
  { label: "S18", polygon: [[1196, 683], [1298, 675], [1417, 777], [1262, 785]] },
  { label: "S19", polygon: [[1312, 678], [1421, 668], [1537, 773], [1438, 778]] },
  { label: "S20", polygon: [[1433, 668], [1526, 659], [1638, 753], [1544, 772]] },
  { label: "S21", polygon: [[1540, 661], [1627, 658], [1720, 749], [1640, 756]] },
  { label: "S22", polygon: [[273, 627], [208, 624], [155, 663], [221, 664]] },
  { label: "S23", polygon: [[280, 624], [342, 616], [314, 660], [252, 661]] },
  { label: "S24", polygon: [[352, 609], [440, 603], [413, 640], [338, 643]] },
  { label: "S25", polygon: [[460, 605], [513, 608], [494, 639], [433, 641]] },
  { label: "S26", polygon: [[550, 594], [610, 596], [590, 631], [516, 627]] },
  { label: "S27", polygon: [[625, 588], [696, 591], [686, 631], [611, 630]] },
  { label: "S28", polygon: [[708, 585], [794, 576], [786, 623], [704, 629]] },
  { label: "S29", polygon: [[800, 579], [880, 574], [888, 611], [804, 623]] },
  { label: "S30", polygon: [[899, 573], [985, 570], [1002, 601], [903, 610]] },
  { label: "S31", polygon: [[1002, 571], [1073, 566], [1092, 598], [1022, 605]] },
  { label: "S32", polygon: [[1086, 564], [1148, 558], [1189, 601], [1118, 603]] },
  { label: "S33", polygon: [[1175, 562], [1231, 558], [1288, 598], [1202, 602]] },
  { label: "S34", polygon: [[1246, 557], [1300, 553], [1356, 589], [1290, 597]] },
  { label: "S35", polygon: [[1318, 554], [1387, 550], [1434, 583], [1381, 596]] },
  { label: "S36", polygon: [[1418, 558], [1464, 557], [1499, 588], [1450, 591]] },
  { label: "S37", polygon: [[1487, 560], [1543, 556], [1585, 584], [1513, 594]] },
  { label: "S38", polygon: [[1568, 559], [1607, 560], [1643, 591], [1596, 597]] },
  { label: "S39", polygon: [[269, 588], [309, 592], [272, 621], [246, 613]] },
  { label: "S40", polygon: [[318, 586], [346, 587], [334, 615], [294, 615]] },
  { label: "S41", polygon: [[499, 570], [534, 571], [520, 607], [469, 603]] },
];

// Tuned by inspection of the camera centers — the cy gap between any two
// neighboring spots inside one camera-row is < 25 px, while the gap from
// the back row to the middle row is > 60 px and middle to front > 45 px.
// 45 lands all 41 spots into the natural three-row grouping.
const ROW_GAP_THRESHOLD_PX = 45;

// Standardized surface-lot stall — sized to match the OSU 3D garage so
// the GLB cars plug in at the same scale as `ParkingGarage3D`.
const SURFACE_SPOT_W = 2.4;
const SURFACE_SPOT_D = 4.8;
const SURFACE_SPOT_GAP_X = 0.06;
const SURFACE_ROW_PITCH_Z = 8.4; // row-center → next-row-center

/**
 * Zone 1 row inference, computed once at module load. Each entry is a
 * row of labels, ordered from FRONT row first (closest to camera in the
 * calibration) to BACK row last. Within a row, labels are ordered left
 * to right as the camera sees them.
 */
const ZONE1_ROWS = inferZoneOneRows(BRIGHTON_ZONE1_POLYGONS);

/**
 * Stable label list (row-major, front-row first). Used by the screen to
 * pad missing-spot placeholders for any calibrated label the backend
 * hasn't reported yet.
 */
export const BRIGHTON_ZONE1_LABELS: readonly string[] = ZONE1_ROWS.flat();

export const BRIGHTON_ZONE1_MAPPED_SPOT_COUNT = BRIGHTON_ZONE1_LABELS.length;

export function buildBrightonLotLayout(
  zone: BrightonZone,
  spots: readonly Spot[],
): BrightonLotSpace[] {
  if (zone === "Z1") return buildZoneOneLayout(spots);
  return buildGeneratedZoneLayout(zone, spots.length);
}

export function getBrightonZoneSourceLabel(zone: BrightonZone): string {
  return zone === "Z1" ? "Live camera" : "Estimated";
}

export function formatBrightonZoneName(zone: BrightonZone): string {
  return `Zone ${zone.replace(/^Z/i, "")}`;
}

export function getBrightonMockCapacity(zone: "Z2" | "Z3"): number {
  return BRIGHTON_MOCK_ZONES.find((item) => item.level === zone)?.capacity ?? 0;
}

export function getBrightonZoneOneCapacity(
  fullFacilityCapacity: number | undefined,
): number {
  const mockCapacity = getBrightonMockCapacity("Z2") + getBrightonMockCapacity("Z3");
  if (typeof fullFacilityCapacity === "number" && fullFacilityCapacity > mockCapacity) {
    return Math.max(
      BRIGHTON_ZONE1_MAPPED_SPOT_COUNT,
      fullFacilityCapacity - mockCapacity,
    );
  }
  return BRIGHTON_ZONE1_MAPPED_SPOT_COUNT;
}

// ──────────────────────────────────────────────────────────────────────
// Layout construction
// ──────────────────────────────────────────────────────────────────────

interface PolygonPlacement {
  label: string;
  cx: number;
  cy: number;
}

/**
 * Cluster the calibrated polygons into camera-rows, then sort each row
 * left-to-right. Returns an array of label rows with the FRONT row (the
 * one closest to the camera, largest cy) first.
 */
function inferZoneOneRows(
  polygons: readonly CalibratedSpotPolygon[],
): string[][] {
  const placements: PolygonPlacement[] = polygons.map((p) => ({
    label: p.label,
    cx: averageOf(p.polygon.map((pt) => pt[0])),
    cy: averageOf(p.polygon.map((pt) => pt[1])),
  }));

  // Top of image (smallest cy) first — that's the back of the lot.
  placements.sort((a, b) => a.cy - b.cy);

  const rows: PolygonPlacement[][] = [];
  let current: PolygonPlacement[] = [];
  let prevCy = -Infinity;

  for (const p of placements) {
    if (current.length > 0 && p.cy - prevCy > ROW_GAP_THRESHOLD_PX) {
      rows.push(current);
      current = [];
    }
    current.push(p);
    prevCy = p.cy;
  }
  if (current.length > 0) rows.push(current);

  // Reverse so the FRONT row (largest cy = closest to the camera) is
  // first. Within each row, sort left-to-right by cx so a label that
  // sits on the left of the camera frame ends up on the left of the
  // clean visualization.
  rows.reverse();
  return rows.map((row) =>
    [...row].sort((a, b) => a.cx - b.cx).map((p) => p.label),
  );
}

function buildZoneOneLayout(spots: readonly Spot[]): BrightonLotSpace[] {
  const calibrated = placeRowsInLot(ZONE1_ROWS, "Z1", "calibrated");

  // If the backend ever ships a Zone 1 label we don't have a calibrated
  // slot for, append it to a small overflow row at the very back of the
  // lot rather than drop it. This keeps the main layout untouched.
  const known = new Set(calibrated.map((space) => space.label.toUpperCase()));
  const extras: BrightonLotSpace[] = [];
  const overflowZ =
    -((ZONE1_ROWS.length + 1) / 2) * SURFACE_ROW_PITCH_Z - SURFACE_SPOT_D * 0.6;

  spots.forEach((spot, idx) => {
    if (known.has(spot.label.toUpperCase())) return;
    const overflowIndex = extras.length;
    const stride = SURFACE_SPOT_W + SURFACE_SPOT_GAP_X;
    extras.push({
      label: spot.label,
      zone: "Z1",
      x: -((idx + 1) * stride) / 2 + overflowIndex * stride,
      z: overflowZ,
      rotation: 0,
      width: SURFACE_SPOT_W,
      depth: SURFACE_SPOT_D,
      source: "generated",
    });
  });

  if (extras.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[SwiftPark] Brighton backend returned spots outside the calibrated layout:",
      extras.map((s) => s.label),
    );
  }

  return [...calibrated, ...extras];
}

function buildGeneratedZoneLayout(
  zone: "Z2" | "Z3",
  count: number,
): BrightonLotSpace[] {
  const safeCount = Math.max(count, 0);
  // Slightly different column counts so Z2 / Z3 read as visually
  // distinct mock zones while still using the standardized stall.
  const cols = zone === "Z2" ? 12 : 10;
  const rowCount = Math.max(1, Math.ceil(safeCount / cols));

  const rows: string[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const rowLabels: string[] = [];
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= safeCount) break;
      rowLabels.push(`${zone}-${String(idx + 1).padStart(3, "0")}`);
    }
    if (rowLabels.length > 0) rows.push(rowLabels);
  }

  return placeRowsInLot(rows, zone, "generated");
}

/**
 * Snap a list of label-rows into a clean standardized grid:
 *   - row 0 (input) = front of the lot, places at +Z
 *   - last row     = back of the lot,  places at -Z
 *   - within a row, labels run left → right at +SURFACE_SPOT_W stride
 *   - alternate rows mirror their rotation so cars in adjacent rows nose
 *     opposite directions, matching how a real double-loaded lot reads
 */
function placeRowsInLot(
  rows: readonly (readonly string[])[],
  zone: BrightonZone,
  source: "calibrated" | "generated",
): BrightonLotSpace[] {
  const result: BrightonLotSpace[] = [];
  const rowCount = rows.length;
  if (rowCount === 0) return result;
  const middle = (rowCount - 1) / 2;

  rows.forEach((rowLabels, rowIndex) => {
    // FRONT row (rowIndex 0) sits at largest +Z; further-back rows step
    // toward -Z. Camera default theta/phi looks down toward origin from
    // +Z, so this places the front row closest to the viewer.
    const z = (middle - rowIndex) * SURFACE_ROW_PITCH_Z;
    const rotation = rowIndex % 2 === 0 ? 0 : Math.PI;

    const stride = SURFACE_SPOT_W + SURFACE_SPOT_GAP_X;
    const rowWidth =
      rowLabels.length * SURFACE_SPOT_W +
      Math.max(0, rowLabels.length - 1) * SURFACE_SPOT_GAP_X;
    const startX = -rowWidth / 2 + SURFACE_SPOT_W / 2;

    rowLabels.forEach((label, colIndex) => {
      result.push({
        label,
        zone,
        x: startX + colIndex * stride,
        z,
        rotation,
        width: SURFACE_SPOT_W,
        depth: SURFACE_SPOT_D,
        source,
      });
    });
  });

  return result;
}

function averageOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}
