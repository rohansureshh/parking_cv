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
 * Module-level cache of the most recent successful occupancy fetch. Every
 * screen using `useOccupancy` shares this cache, so flowing
 * Splash → Home → Overview → Navigation only triggers a single fetch and
 * subsequent screens never flash a loading state.
 */
let cached: Occupancy | null = null;

export interface OccupancySnapshot {
  occupancy: Occupancy | null;
  /**
   * `true` once the API has resolved at least once (success OR failure) for
   * this session. `false` only during the initial loading window when there
   * is no cache and no resolved fetch yet — the only window in which a
   * screen should render skeletons instead of fallback text.
   */
  ready: boolean;
}

/**
 * React hook exposing the shared occupancy snapshot. The state is seeded
 * from the module cache so re-mounts within the same session are instant.
 */
export function useOccupancy(): OccupancySnapshot {
  const [occupancy, setOccupancy] = useState<Occupancy | null>(cached);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchOccupancy();
        if (!cancelled) {
          cached = data;
          setOccupancy(data);
          setLoadFailed(false);
        }
      } catch {
        // Only flip into the fallback path if we have no cached value to
        // fall back on. With a cached value we keep showing what we knew.
        if (!cancelled && cached === null) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    occupancy,
    ready: occupancy !== null || loadFailed,
  };
}
