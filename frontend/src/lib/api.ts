import {
  BRIGHTON_MOCK_ZONES,
  buildBrightonMockZoneSpots,
} from "./brightonMockZones";
import {
  BRIGHTON_FACILITY_SLUG,
  getFacility,
  OSU_FACILITY_SLUG,
  type FacilitySlug,
} from "./facilities";
import type { FacilityStatus, Occupancy, Spot, SpotStatus } from "./types";

interface BrightonMockZoneSummary {
  level: string;
  label_prefix?: string;
  capacity: number;
  occupied?: number;
  unknown?: number;
  confidence?: number;
}

export interface BrightonMockZonesPayload {
  zones?: BrightonMockZoneSummary[];
  capacity?: number;
  available?: number;
  occupied?: number;
  unknown?: number;
  spots?: YoloSpotResponse[];
}

const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const RAW_YOLO_BASE =
  import.meta.env.VITE_YOLO_API_BASE_URL ?? "http://127.0.0.1:8001";
export const API_BASE_URL = RAW_BASE.replace(/\/$/, "");
export const YOLO_API_BASE_URL = RAW_YOLO_BASE.replace(/\/$/, "");

export function getBrightonYoloWebSocketUrl(): string {
  try {
    const url = new URL(YOLO_API_BASE_URL);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const basePath = url.pathname.replace(/\/$/, "");
    url.pathname = `${basePath}/ws`;
    return url.toString();
  } catch {
    const wsBase = YOLO_API_BASE_URL.replace(/^https:/, "wss:").replace(
      /^http:/,
      "ws:",
    );
    return `${wsBase.replace(/\/$/, "")}/ws`;
  }
}

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

export type BrightonYoloSnapshot = YoloStatusResponse;

export type BrightonWebSocketStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

interface BrightonWebSocketOptions {
  onStatusChange?: (status: BrightonWebSocketStatus) => void;
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

function fitCountsToCapacity({
  available,
  occupied,
  unknown,
  capacity,
}: {
  available: number;
  occupied: number;
  unknown: number;
  capacity: number;
}) {
  const safeCapacity = Math.max(capacity, 0);
  const safeOccupied = Math.min(Math.max(occupied, 0), safeCapacity);
  const safeUnknown = Math.min(
    Math.max(unknown, 0),
    Math.max(safeCapacity - safeOccupied, 0),
  );
  const safeAvailable = Math.min(
    Math.max(available, 0),
    Math.max(safeCapacity - safeOccupied - safeUnknown, 0),
  );
  const paddedUnknown =
    safeUnknown +
    Math.max(safeCapacity - safeAvailable - safeOccupied - safeUnknown, 0);

  return {
    available: safeAvailable,
    occupied: safeOccupied,
    unknown: paddedUnknown,
  };
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

  const rawAvailable = toCount(yolo.available);
  const rawOccupied = toCount(yolo.occupied);
  const rawUnknown = toCount(yolo.unknown);
  const capacity = Math.max(
    toCount(yolo.capacity),
    rawAvailable + rawOccupied + rawUnknown,
  );
  const zoneOneOccupancyPct = normalizeIncomingPct(
    yolo.occupancy_pct,
    rawOccupied,
    capacity,
  );

  const occupied = isFiniteNumber(yolo.occupied)
    ? Math.min(rawOccupied, capacity)
    : Math.round((zoneOneOccupancyPct / 100) * capacity);
  const unknown = Math.min(rawUnknown, Math.max(capacity - occupied, 0));
  const available = isFiniteNumber(yolo.available)
    ? Math.min(rawAvailable, Math.max(capacity - occupied - unknown, 0))
    : Math.max(capacity - occupied - unknown, 0);
  const paddedUnknown =
    unknown + Math.max(capacity - available - occupied - unknown, 0);

  return makeSpotsFromCounts({
    level: "Z1",
    labelPrefix: "Z1",
    available,
    occupied,
    unknown: paddedUnknown,
    confidence: 0.9,
  });
}

function buildMockSpotsFromPayload(payload: BrightonMockZonesPayload): Spot[] {
  if (Array.isArray(payload.spots) && payload.spots.length > 0) {
    return payload.spots.map((spot, index) => ({
      id:
        spot.id ??
        `brighton-${(spot.level ?? "zX").toLowerCase()}-${String(index + 1).padStart(3, "0")}`,
      label: spot.label?.trim() || `Z${index + 1}`,
      level: spot.level ?? "Z2",
      status: normalizeSpotStatus(spot.status),
      confidence: normalizeConfidence(spot.confidence),
    }));
  }
  // Endpoint returned summaries only — synthesize spots from counts.
  if (Array.isArray(payload.zones) && payload.zones.length > 0) {
    return payload.zones.flatMap((zone) => {
      const capacity = Math.max(toCount(zone.capacity), 0);
      const occupied = Math.min(toCount(zone.occupied), capacity);
      const unknown = Math.min(
        toCount(zone.unknown),
        Math.max(capacity - occupied, 0),
      );
      const available = Math.max(capacity - occupied - unknown, 0);
      return makeSpotsFromCounts({
        level: zone.level,
        labelPrefix: zone.label_prefix ?? zone.level,
        available,
        occupied,
        unknown,
        confidence: normalizeConfidence(zone.confidence ?? 0.86),
      });
    });
  }
  // Final fallback to bundled local mock data.
  return buildBrightonMockZoneSpots();
}

function mockCapacityFromPayload(payload: BrightonMockZonesPayload): number {
  if (Array.isArray(payload.zones) && payload.zones.length > 0) {
    return payload.zones.reduce(
      (total, zone) => total + Math.max(toCount(zone.capacity), 0),
      0,
    );
  }
  if (isFiniteNumber(payload.capacity)) return Math.max(payload.capacity, 0);
  if (Array.isArray(payload.spots)) return payload.spots.length;
  return BRIGHTON_MOCK_ZONES.reduce(
    (total, zone) => total + zone.capacity,
    0,
  );
}

function normalizeBrightonOccupancy(
  yolo: YoloStatusResponse,
  mockPayload: BrightonMockZonesPayload,
): Occupancy {
  const facility = getFacility(BRIGHTON_FACILITY_SLUG);
  const zoneOneSpots = buildBrightonZoneOneSpots(yolo);
  const mockZoneSpots = buildMockSpotsFromPayload(mockPayload);
  const spots = [...zoneOneSpots, ...mockZoneSpots];
  const hasRealZoneOneSpots =
    Array.isArray(yolo.spots) && yolo.spots.length > 0;
  const zoneOneMappedCounts = countSpots(zoneOneSpots);
  const zoneOneCapacity = Math.max(toCount(yolo.capacity), zoneOneSpots.length);
  const zoneOneCounts = hasRealZoneOneSpots
    ? fitCountsToCapacity({
        available: isFiniteNumber(yolo.available)
          ? toCount(yolo.available)
          : zoneOneMappedCounts.available,
        occupied: isFiniteNumber(yolo.occupied)
          ? toCount(yolo.occupied)
          : zoneOneMappedCounts.occupied,
        unknown: isFiniteNumber(yolo.unknown)
          ? toCount(yolo.unknown)
          : zoneOneMappedCounts.unknown,
        capacity: zoneOneCapacity,
      })
    : zoneOneMappedCounts;
  const mockCounts = countSpots(mockZoneSpots);
  const mockCapacity = mockCapacityFromPayload(mockPayload);
  const capacity = zoneOneCapacity + mockCapacity;
  const counts = {
    available: zoneOneCounts.available + mockCounts.available,
    occupied: zoneOneCounts.occupied + mockCounts.occupied,
    unknown: zoneOneCounts.unknown + mockCounts.unknown,
  };
  const occupancyPct = normalizeIncomingPct(
    undefined,
    counts.occupied,
    capacity,
  );

  return {
    lot_id: BRIGHTON_FACILITY_SLUG,
    lot_slug: BRIGHTON_FACILITY_SLUG,
    lot_name: facility.name,
    location: facility.location,
    facility_status: deriveFacilityStatus(occupancyPct),
    capacity,
    available: counts.available,
    occupied: counts.occupied,
    unknown: counts.unknown,
    occupancy_pct: occupancyPct,
    spots,
  };
}

export function localBrightonMockZonesPayload(): BrightonMockZonesPayload {
  return {
    zones: BRIGHTON_MOCK_ZONES.map((zone) => ({
      level: zone.level,
      label_prefix: zone.labelPrefix,
      capacity: zone.capacity,
      occupied: zone.occupied,
      unknown: zone.unknown,
      confidence: zone.confidence,
    })),
    spots: buildBrightonMockZoneSpots() as unknown as YoloSpotResponse[],
  };
}

export async function fetchBrightonMockZonesPayload(): Promise<BrightonMockZonesPayload> {
  try {
    return await request<BrightonMockZonesPayload>(
      API_BASE_URL,
      "/demo/brighton-mock-zones",
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[SwiftPark] /demo/brighton-mock-zones unreachable, falling back to bundled mock data",
      err,
    );
    return localBrightonMockZonesPayload();
  }
}

export function buildBrightonOccupancyFromSnapshot(
  yolo: BrightonYoloSnapshot,
  mockPayload: BrightonMockZonesPayload = localBrightonMockZonesPayload(),
): Occupancy {
  return normalizeBrightonOccupancy(yolo, mockPayload);
}

export function fetchBrightonYoloStatus(): Promise<BrightonYoloSnapshot> {
  return request<BrightonYoloSnapshot>(YOLO_API_BASE_URL, "/status");
}

export function subscribeBrightonYoloSnapshots(
  onSnapshot: (snapshot: BrightonYoloSnapshot) => void,
  options: BrightonWebSocketOptions = {},
): () => void {
  if (typeof WebSocket === "undefined") {
    options.onStatusChange?.("disconnected");
    return () => {};
  }

  const url = getBrightonYoloWebSocketUrl();
  let socket: WebSocket | null = null;
  let stopped = false;
  let reconnectTimer: number | null = null;
  let reconnectAttempt = 0;

  function clearReconnectTimer() {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer !== null) return;
    reconnectAttempt += 1;
    const delayMs = Math.min(1000 * 2 ** Math.min(reconnectAttempt - 1, 3), 10000);
    options.onStatusChange?.("reconnecting");
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delayMs);
  }

  function connect() {
    if (stopped) return;
    options.onStatusChange?.(
      reconnectAttempt === 0 ? "connecting" : "reconnecting",
    );

    try {
      socket = new WebSocket(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[SwiftPark] Could not open Brighton WebSocket", err);
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      reconnectAttempt = 0;
      clearReconnectTimer();
      options.onStatusChange?.("connected");
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const parsed: unknown = JSON.parse(event.data);
        if (parsed && typeof parsed === "object") {
          onSnapshot(parsed as BrightonYoloSnapshot);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[SwiftPark] Ignoring malformed Brighton WebSocket frame", err);
      }
    };

    socket.onerror = () => {
      // Let onclose do the reconnect scheduling. Some browsers fire both.
    };

    socket.onclose = () => {
      socket = null;
      if (stopped) {
        options.onStatusChange?.("disconnected");
        return;
      }
      scheduleReconnect();
    };
  }

  connect();

  return () => {
    stopped = true;
    clearReconnectTimer();
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (
        socket.readyState === WebSocket.CONNECTING ||
        socket.readyState === WebSocket.OPEN
      ) {
        socket.close(1000, "SwiftPark screen closed");
      }
    }
    socket = null;
    options.onStatusChange?.("disconnected");
  };
}

export function fetchOccupancy(
  facilitySlug: FacilitySlug = OSU_FACILITY_SLUG,
): Promise<Occupancy> {
  if (facilitySlug === OSU_FACILITY_SLUG) {
    return request<Occupancy>(API_BASE_URL, "/demo/occupancy");
  }

  if (facilitySlug === BRIGHTON_FACILITY_SLUG) {
    return Promise.all([
      fetchBrightonYoloStatus(),
      fetchBrightonMockZonesPayload(),
    ]).then(([yolo, mock]) => buildBrightonOccupancyFromSnapshot(yolo, mock));
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
