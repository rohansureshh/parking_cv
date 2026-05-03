import type { Spot, SpotStatus } from "./types";

interface BrightonMockZone {
  level: "Z2" | "Z3";
  labelPrefix: string;
  capacity: number;
  occupied: number;
  unknown: number;
  confidence: number;
}

// TODO: Replace these placeholder capacities/counts after the senior dev
// confirms Brighton's Zone 2 and Zone 3 camera plan and lot capacities.
export const BRIGHTON_MOCK_ZONES: readonly BrightonMockZone[] = [
  {
    level: "Z2",
    labelPrefix: "Z2",
    capacity: 72,
    occupied: 31,
    unknown: 4,
    confidence: 0.88,
  },
  {
    level: "Z3",
    labelPrefix: "Z3",
    capacity: 58,
    occupied: 19,
    unknown: 3,
    confidence: 0.86,
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
