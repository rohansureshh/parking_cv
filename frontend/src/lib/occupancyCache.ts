import { useEffect, useState } from "react";

import { fetchOccupancy } from "./api";
import { OSU_FACILITY_SLUG, type FacilitySlug } from "./facilities";
import type { Occupancy } from "./types";

/**
 * Shared demo fallback used when the OSU demo API is unreachable. Every
 * customer-facing OSU screen should source garage copy from here so the demo
 * never shows conflicting placeholder names.
 */
export const DEMO_FALLBACK = {
  garageName: "OSU Parking Structure 1",
  garageAddress: "200 W High St, Downtown",
} as const;

/**
 * Minimal shape of a spot threaded through the navigation flow when the user
 * explicitly chose one in Spot Visualization.
 */
export interface SelectedSpot {
  label: string;
  level: string;
}

const cachedByFacility = new Map<FacilitySlug, Occupancy>();
const inFlightByFacility = new Map<FacilitySlug, Promise<Occupancy>>();

function ensureFetched(facilitySlug: FacilitySlug): Promise<Occupancy> {
  const cached = cachedByFacility.get(facilitySlug);
  if (cached) return Promise.resolve(cached);

  const inFlight = inFlightByFacility.get(facilitySlug);
  if (inFlight) return inFlight;

  const request = fetchOccupancy(facilitySlug)
    .then((data) => {
      cachedByFacility.set(facilitySlug, data);
      inFlightByFacility.delete(facilitySlug);
      return data;
    })
    .catch((err) => {
      inFlightByFacility.delete(facilitySlug);
      throw err;
    });

  inFlightByFacility.set(facilitySlug, request);
  return request;
}

/**
 * Warm the cache for a facility as early as possible. Existing OSU screens
 * keep the previous behavior by using the OSU slug as the default.
 */
export function prefetchOccupancy(
  facilitySlug: FacilitySlug = OSU_FACILITY_SLUG,
): void {
  ensureFetched(facilitySlug).catch(() => {
    /* silent - useOccupancy callers handle the failure surface */
  });
}

/**
 * Manually update one facility's cached occupancy without touching any other
 * facility. Used after OSU simulate-detection and future Brighton refreshes.
 */
export function setCachedOccupancy(
  facilitySlug: FacilitySlug,
  data: Occupancy,
): void {
  cachedByFacility.set(facilitySlug, data);
}

export interface OccupancySnapshot {
  occupancy: Occupancy | null;
  /**
   * true once the API has resolved at least once for this facility. false only
   * during the initial loading window when there is no cache yet.
   */
  ready: boolean;
}

/**
 * React hook exposing the shared occupancy snapshot for a single facility.
 * OSU remains the default so current screens keep working while Phase 5 adds
 * Brighton-specific screens later.
 */
export function useOccupancy(
  facilitySlug: FacilitySlug = OSU_FACILITY_SLUG,
): OccupancySnapshot {
  const [occupancy, setOccupancy] = useState<Occupancy | null>(
    cachedByFacility.get(facilitySlug) ?? null,
  );
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setOccupancy(cachedByFacility.get(facilitySlug) ?? null);
    setLoadFailed(false);

    ensureFetched(facilitySlug)
      .then((data) => {
        if (!cancelled) {
          setOccupancy(data);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled && !cachedByFacility.has(facilitySlug)) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [facilitySlug]);

  return {
    occupancy,
    ready: occupancy !== null || loadFailed,
  };
}
