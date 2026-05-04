import type { Spot, SpotStatus } from "./types";

interface BrightonMockZone {
  level: "Z2" | "Z3";
  labelPrefix: string;
  capacity: number;
  occupied: number;
  unknown: number;
  confidence: number;
}

// Brighton Zone 2 / Zone 3 mock occupancy. The authoritative source is
// the backend `/demo/brighton-mock-zones` endpoint (see api/main.py).
// This constant is the offline fallback used by `api.ts` when that
// endpoint is unreachable, so the visible demo never breaks. Capacities
// mirror the backend numbers exactly.
export const BRIGHTON_MOCK_ZONES: readonly BrightonMockZone[] = [
  {
    level: "Z2",
    labelPrefix: "Z2",
    capacity: 30,
    occupied: 12,
    unknown: 2,
    confidence: 0.88,
  },
  {
    level: "Z3",
    labelPrefix: "Z3",
    capacity: 20,
    occupied: 7,
    unknown: 1,
    confidence: 0.85,
  },
] as const;

export function buildBrightonMockZoneSpots(): Spot[] {
  return BRIGHTON_MOCK_ZONES.flatMap((zone) => {
    const available = Math.max(zone.capacity - zone.occupied - zone.unknown, 0);
    const statuses: SpotStatus[] = [
      ...Array<SpotStatus>(available).fill("available"),
      ...Array<SpotStatus>(zone.occupied).fill("occupied"),
      ...Array<SpotStatus>(zone.unknown).fill("unknown"),
    ];

    return statuses.slice(0, zone.capacity).map((status, index) => {
      const spotNumber = String(index + 1).padStart(3, "0");
      return {
        id: `brighton-${zone.level.toLowerCase()}-${spotNumber}`,
        label: `${zone.labelPrefix}-${spotNumber}`,
        level: zone.level,
        status,
        confidence: zone.confidence,
      };
    });
  });
}
