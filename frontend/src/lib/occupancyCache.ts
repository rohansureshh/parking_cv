import { useEffect, useState } from "react";

import { fetchOccupancy } from "./api";
import type { Occupancy } from "./types";

/**
 * Shared demo fallback used when /demo/occupancy is unreachable. Every
 * customer-facing screen should source garage copy from here so the demo
 * never shows conflicting placeholder names.
 */
export const DEMO_FALLBACK = {
  garageName: "OSU Parking Structure 1",
  garageAddress: "200 W High St, Downtown",
} as const;

/**
 * Minimal shape of a spot threaded through the navigation flow when the
 * user explicitly chose one in Spot Visualization. NavigationScreen and
 * ParkedConfirmationScreen both accept this as their `preselectedSpot`
 * prop, and App.tsx holds it in state across the SpotViz → Nav → Parked
 * handoff.
 */
export interface SelectedSpot {
  label: string;
  level: string;
}

/**
 * Module-level cache of the most recent successful occupancy fetch. Every
 * screen using `useOccupancy` shares this cache, so flowing
 * Splash → Home → Overview → Navigation only triggers a single fetch and
 * subsequent screens never flash a loading state.
 */
let cached: Occupancy | null = null;

/**
 * Single in-flight fetch promise — concurrent callers (e.g. App's prefetch
 * during splash + Home's `useOccupancy` mount) share the same network call
 * instead of racing two requests.
 */
let inFlight: Promise<Occupancy> | null = null;

function ensureFetched(): Promise<Occupancy> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  inFlight = fetchOccupancy()
    .then((data) => {
      cached = data;
      inFlight = null;
      return data;
    })
    .catch((err) => {
      inFlight = null;
      throw err;
    });
  return inFlight;
}

/**
 * Kick off a background fetch as early as possible (App mount). Resolves
 * silently — callers that need the data should still go through
 * `useOccupancy`. The point is to warm the cache during splash so the
 * first real screen renders with data on its first paint.
 */
export function prefetchOccupancy(): void {
  ensureFetched().catch(() => {
    /* silent — useOccupancy callers handle the failure surface */
  });
}

/**
 * Manually update the shared cache. Used by SpotVisualization (which
 * keeps its own state for the simulation/refresh UI) so a successful
 * `simulate-detection` propagates to subsequent screens.
 */
export function setCachedOccupancy(data: Occupancy): void {
  cached = data;
}

export interface OccupancySnapshot {
  occupancy: Occupancy | null;
  /**
   * `true` once the API has resolved at least once (success OR failure)
   * for this session. `false` only during the initial loading window
   * when there is no cache and no resolved fetch yet — the only window
   * in which a screen should render skeletons instead of fallback text.
   */
  ready: boolean;
}

/**
 * React hook exposing the shared occupancy snapshot. The state is seeded
 * from the module cache so re-mounts within the same session are instant.
 * Multiple concurrent mounts share a single network call via `ensureFetched`.
 */
export function useOccupancy(): OccupancySnapshot {
  const [occupancy, setOccupancy] = useState<Occupancy | null>(cached);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureFetched()
      .then((data) => {
        if (!cancelled) {
          setOccupancy(data);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        // Only flip into the fallback path if we have no cache. With
        // a cached value we keep showing the previously known garage.
        if (!cancelled && cached === null) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    occupancy,
    ready: occupancy !== null || loadFailed,
  };
}
