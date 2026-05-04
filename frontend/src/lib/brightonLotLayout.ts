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

// The YOLO camera calibration for Brighton Zone 1 currently defines 41
// mapped spaces. Keep these labels stable so backend spot ids like S01/S02
// land in deterministic positions in the visual lot.
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

export const BRIGHTON_ZONE1_MAPPED_SPOT_COUNT =
  BRIGHTON_ZONE1_POLYGONS.length;

const ZONE1_WORLD_WIDTH = 30;
const ZONE1_WORLD_DEPTH = 18;
const ZONE1_SPOT_WIDTH = 1.2;
const ZONE1_SPOT_DEPTH = 2.35;

const zoneOneCenters = BRIGHTON_ZONE1_POLYGONS.map((spot) =>
  centerOfPolygon(spot.polygon),
);
const minCenterX = Math.min(...zoneOneCenters.map((p) => p[0]));
const maxCenterX = Math.max(...zoneOneCenters.map((p) => p[0]));
const minCenterY = Math.min(...zoneOneCenters.map((p) => p[1]));
const maxCenterY = Math.max(...zoneOneCenters.map((p) => p[1]));

export const BRIGHTON_ZONE1_LABELS = BRIGHTON_ZONE1_POLYGONS.map(
  (spot) => spot.label,
);

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

function buildZoneOneLayout(spots: readonly Spot[]): BrightonLotSpace[] {
  const calibrated = BRIGHTON_ZONE1_POLYGONS.map((entry) => {
    const [cx, cy] = centerOfPolygon(entry.polygon);
    const x = normalizeRange(cx, minCenterX, maxCenterX, ZONE1_WORLD_WIDTH);
    const z = normalizeRange(cy, minCenterY, maxCenterY, ZONE1_WORLD_DEPTH);
    return {
      label: entry.label,
      zone: "Z1" as const,
      x,
      z,
      rotation: safeSpotRotation(entry.polygon),
      width: ZONE1_SPOT_WIDTH,
      depth: ZONE1_SPOT_DEPTH,
      source: "calibrated" as const,
    };
  });

  const known = new Set(calibrated.map((space) => space.label.toUpperCase()));
  const extras = spots
    .filter((spot) => !known.has(spot.label.toUpperCase()))
    .map((spot, index) => ({
      label: spot.label,
      zone: "Z1" as const,
      x: -ZONE1_WORLD_WIDTH / 2 + 1.2 + index * (ZONE1_SPOT_WIDTH + 0.25),
      z: ZONE1_WORLD_DEPTH / 2 + 2.6,
      rotation: 0,
      width: ZONE1_SPOT_WIDTH,
      depth: ZONE1_SPOT_DEPTH,
      source: "generated" as const,
    }));

  if (extras.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[SwiftPark] Brighton backend returned spots outside the calibrated layout:",
      extras.map((spot) => spot.label),
    );
  }

  return [...calibrated, ...extras];
}

function buildGeneratedZoneLayout(
  zone: "Z2" | "Z3",
  count: number,
): BrightonLotSpace[] {
  const safeCount = Math.max(count, 0);
  const cols = zone === "Z2" ? 12 : 10;
  const spotW = 1.12;
  const spotD = 2.25;
  const colGap = 0.25;
  const rowGap = 1.65;
  const rows = Math.max(1, Math.ceil(safeCount / cols));
  const totalW = cols * spotW + Math.max(0, cols - 1) * colGap;
  const rowStride = spotD + rowGap;
  const totalD = rows * rowStride;

  return Array.from({ length: safeCount }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const rowDirection = row % 2 === 0 ? 1 : -1;
    return {
      label: `${zone}-${String(index + 1).padStart(3, "0")}`,
      zone,
      x: -totalW / 2 + spotW / 2 + col * (spotW + colGap),
      z: -totalD / 2 + spotD / 2 + row * rowStride,
      rotation: rowDirection > 0 ? 0 : Math.PI,
      width: spotW,
      depth: spotD,
      source: "generated",
    };
  });
}

function centerOfPolygon(polygon: readonly Point[]): Point {
  const sum = polygon.reduce<[number, number]>(
    (acc, point) => {
      acc[0] += point[0];
      acc[1] += point[1];
      return acc;
    },
    [0, 0],
  );
  return [sum[0] / polygon.length, sum[1] / polygon.length];
}

function normalizeRange(
  value: number,
  min: number,
  max: number,
  worldSpan: number,
): number {
  if (max <= min) return 0;
  const pct = (value - min) / (max - min);
  return (pct - 0.5) * worldSpan;
}

function safeSpotRotation(polygon: readonly Point[]): number {
  const [a, b] = polygon;
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const maxAngle = Math.PI / 7;
  if (!Number.isFinite(angle) || Math.abs(angle) > Math.PI / 3) return 0;
  return Math.max(-maxAngle, Math.min(maxAngle, -angle));
}
