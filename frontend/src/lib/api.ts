import { buildBrightonMockZoneSpots } from "./brightonMockZones";
import {
  BRIGHTON_FACILITY_SLUG,
  getFacility,
  OSU_FACILITY_SLUG,
  type FacilitySlug,
} from "./facilities";
import type { FacilityStatus, Occupancy, Spot, SpotStatus } from "./types";

const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const RAW_YOLO_BASE =
  import.meta.env.VITE_YOLO_API_BASE_URL ?? "http://127.0.0.1:8001";
export const API_BASE_URL = RAW_BASE.replace(/\/$/, "");
export const YOLO_API_BASE_URL = RAW_YOLO_BASE.replace(/\/$/, "");

type ApiErrorKind = "network" | "http" | "missing_seed";

interface YoloSpotResponse {
  id?: string;
  label?: string;
  level?: string;
  status?: string;
  confidence?: number;
}

interface YoloStatusResponse {
  lot_id?: string;
  lot_slug?: string;
  lot_name?: string;
  location?: string;
  facility_status?: string;
  timestamp?: string;
  capacity?: number;
  available?: number;
  occupied?: number;
  unknown?: number;
  occupancy_pct?: number;
  spots?: YoloSpotResponse[];
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(message: string, kind: ApiErrorKind, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

async function request<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${baseUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(
      `Could not reach the SwiftPark backend at ${baseUrl}.`,
      "network",
    );
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body && typeof body.detail === "string") {
        detail = body.detail;
      }
    } catch {
      // Ignore non-JSON error bodies.
    }

    const isMissingSeed = response.status === 404 && /seed/i.test(detail);

    throw new ApiError(
      detail,
      isMissingSeed ? "missing_seed" : "http",
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toCount(value: unknown, fallback = 0): number {
  if (!isFiniteNumber(value)) return fallback;
  return Math.max(Math.round(value), 0);
}

function isSpotStatus(value: unknown): value is SpotStatus {
  return value === "available" || value === "occupied" || value === "unknown";
}

function normalizeSpotStatus(value: unknown): SpotStatus {
  return isSpotStatus(value) ? value : "unknown";
}

function normalizeConfidence(value: unknown): number {
  if (!isFiniteNumber(value)) return 1;
  return clamp(value, 0, 1);
}

function normalizeIncomingPct(
  value: unknown,
  occupied: number,
  capacity: number,
): number {
  if (isFiniteNumber(value)) {
    const pct = value <= 1 ? value * 100 : value;
    return Math.round(clamp(pct, 0, 100) * 10) / 10;
  }

  if (capacity <= 0) return 0;
  return Math.round(clamp((occupied / capacity) * 100, 0, 100) * 10) / 10;
}

function deriveFacilityStatus(occupancyPct: number): FacilityStatus {
  if (occupancyPct >= 85) return "nearly_full";
  if (occupancyPct >= 60) return "busy";
  return "open";
}

function countSpots(spots: Spot[]) {
  return spots.reduce(
    (counts, spot) => {
      counts[spot.status] += 1;
      return counts;
    },
    { available: 0, occupied: 0, unknown: 0 },
  );
}

function makeSpotsFromCounts({
  level,
  labelPrefix,
  available,
  occupied,
  unknown,
  confidence,
}: {
  level: string;
  labelPrefix: string;
  available: number;
  occupied: number;
  unknown: number;
  confidence: number;
}): Spot[] {
  const statuses: SpotStatus[] = [
    ...Array<SpotStatus>(available).fill("available"),
    ...Array<SpotStatus>(occupied).fill("occupied"),
    ...Array<SpotStatus>(unknown).fill("unknown"),
  ];

  return statuses.map((status, index) => {
    const spotNumber = String(index + 1).padStart(3, "0");
    return {
      id: `brighton-${level.toLowerCase()}-${spotNumber}`,
      label: `${labelPrefix}-${spotNumber}`,
      level,
      status,
      confidence,
    };
  });
}

function normalizeYoloSpotId(rawSpot: YoloSpotResponse, index: number): string {
  const rawId = rawSpot.id ?? rawSpot.label ?? String(index + 1);
  const safeId = rawId.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return `brighton-z1-${safeId}`;
}

function buildBrightonZoneOneSpots(yolo: YoloStatusResponse): Spot[] {
  const yoloSpots = Array.isArray(yolo.spots) ? yolo.spots : [];

  if (yoloSpots.length > 0) {
    return yoloSpots.map((spot, index) => ({
      id: normalizeYoloSpotId(spot, index),
      label: spot.label?.trim() || `Z1-${String(index + 1).padStart(3, "0")}`,
      level: "Z1",
      status: normalizeSpotStatus(spot.status),
      confidence: normalizeConfidence(spot.confidence),
    }));
  }

  const capacity = toCount(yolo.capacity);
  const unknown = toCount(yolo.unknown);
  let occupied = toCount(yolo.occupied);

  if (!isFiniteNumber(yolo.occupied) && capacity > 0) {
    const pct = normalizeIncomingPct(yolo.occupancy_pct, 0, capacity);
    occupied = Math.round((pct / 100) * capacity);
  }

  const available = isFiniteNumber(yolo.available)
    ? toCount(yolo.available)
    : Math.max(capacity - occupied - unknown, 0);
  const totalFromCounts = available + occupied + unknown;
  const paddedUnknown = unknown + Math.max(capacity - totalFromCounts, 0);

  return makeSpotsFromCounts({
    level: "Z1",
    labelPrefix: "Z1",
    available,
    occupied,
    unknown: paddedUnknown,
    confidence: 0.9,
  });
}

function normalizeBrightonOccupancy(yolo: YoloStatusResponse): Occupancy {
  const facility = getFacility(BRIGHTON_FACILITY_SLUG);
  const zoneOneSpots = buildBrightonZoneOneSpots(yolo);
  const mockZoneSpots = buildBrightonMockZoneSpots();
  const spots = [...zoneOneSpots, ...mockZoneSpots];
  const counts = countSpots(spots);
  const capacity = spots.length;
  const occupancyPct = normalizeIncomingPct(
    undefined,
    counts.occupied,
    capacity,
  );

  return {
    lot_id: BRIGHTON_FACILITY_SLUG,
    lot_slug: BRIGHTON_FACILITY_SLUG,
    lot_name: facility.name,
    location: "Brighton, UT",
    facility_status: deriveFacilityStatus(occupancyPct),
    capacity,
    available: counts.available,
    occupied: counts.occupied,
    unknown: counts.unknown,
    occupancy_pct: occupancyPct,
    spots,
  };
}

export function fetchOccupancy(
  facilitySlug: FacilitySlug = OSU_FACILITY_SLUG,
): Promise<Occupancy> {
  if (facilitySlug === OSU_FACILITY_SLUG) {
    return request<Occupancy>(API_BASE_URL, "/demo/occupancy");
  }

  if (facilitySlug === BRIGHTON_FACILITY_SLUG) {
    return request<YoloStatusResponse>(YOLO_API_BASE_URL, "/status").then(
      normalizeBrightonOccupancy,
    );
  }

  const exhaustive: never = facilitySlug;
  throw new ApiError(`Unsupported facility: ${exhaustive}`, "http");
}

export function simulateDetection(
  facilitySlug: FacilitySlug = OSU_FACILITY_SLUG,
): Promise<Occupancy> {
  if (facilitySlug === OSU_FACILITY_SLUG) {
    return request<Occupancy>(API_BASE_URL, "/demo/simulate-detection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  }

  if (facilitySlug === BRIGHTON_FACILITY_SLUG) {
    return fetchOccupancy(BRIGHTON_FACILITY_SLUG);
  }

  const exhaustive: never = facilitySlug;
  throw new ApiError(`Unsupported facility: ${exhaustive}`, "http");
}
