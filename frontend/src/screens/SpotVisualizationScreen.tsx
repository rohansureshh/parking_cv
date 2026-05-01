import { useCallback, useEffect, useMemo, useState } from "react";

import { TopBar } from "../components/TopBar";
import { FloorSelector } from "../components/FloorSelector";
import { LegendRow } from "../components/LegendRow";
import { StatsRow } from "../components/StatsRow";
import { SimulateButton } from "../components/SimulateButton";
import { HeroOverlays } from "../components/HeroOverlays";
import { SpotPanel } from "../components/SpotPanel";
import { ConfirmationModal } from "../components/ConfirmationModal";
import ParkingGarage3D from "../components/parking/ParkingGarage3D";

import { ApiError, fetchOccupancy, simulateDetection } from "../lib/api";
import type { Occupancy, Spot } from "../lib/types";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; occupancy: Occupancy }
  | { kind: "error"; error: ApiError };

export function SpotVisualizationScreen() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [confirmedSpot, setConfirmedSpot] = useState<Spot | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeLevel, setActiveLevel] = useState<string | null>(null);
  const [viewVersion, setViewVersion] = useState(0);

  const applyOccupancy = useCallback((occupancy: Occupancy) => {
    setState({ kind: "ready", occupancy });
    setSelectedSpotId((current) => {
      if (!current) return current;
      const spot = occupancy.spots.find((s) => s.id === current);
      return spot && spot.status === "available" ? current : null;
    });
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchOccupancy();
      applyOccupancy(data);
    } catch (err) {
      const apiErr =
        err instanceof ApiError ? err : new ApiError(String(err), "network");
      setState({ kind: "error", error: apiErr });
    } finally {
      setRefreshing(false);
    }
  }, [applyOccupancy]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSimulate = useCallback(async () => {
    setSimulating(true);
    try {
      const data = await simulateDetection();
      applyOccupancy(data);
    } catch (err) {
      const apiErr =
        err instanceof ApiError ? err : new ApiError(String(err), "network");
      setState({ kind: "error", error: apiErr });
    } finally {
      setSimulating(false);
    }
  }, [applyOccupancy]);

  const handleSelectSpot = useCallback((spot: Spot) => {
    setSelectedSpotId(spot.id);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedSpotId(null);
  }, []);

  const handleConfirmSpot = useCallback(() => {
    if (state.kind !== "ready" || !selectedSpotId) return;
    const spot = state.occupancy.spots.find((s) => s.id === selectedSpotId);
    if (spot) setConfirmedSpot(spot);
  }, [state, selectedSpotId]);

  const handleDismissConfirmation = useCallback(() => {
    setConfirmedSpot(null);
    setSelectedSpotId(null);
  }, []);

  const handleRecenter = useCallback(() => {
    setViewVersion((v) => v + 1);
  }, []);

  const occupancy = state.kind === "ready" ? state.occupancy : null;
  const selectedSpot =
    occupancy && selectedSpotId
      ? occupancy.spots.find((s) => s.id === selectedSpotId) ?? null
      : null;

  const levels = useMemo(() => {
    if (!occupancy) return [] as string[];
    const seen = new Set<string>();
    for (const spot of occupancy.spots) seen.add(spot.level);
    return Array.from(seen).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }, [occupancy]);

  // Default activeLevel to the first level once data arrives, and reset if
  // the current level disappears (e.g. backend re-seeded with different data).
  useEffect(() => {
    if (levels.length === 0) {
      if (activeLevel !== null) setActiveLevel(null);
      return;
    }
    if (activeLevel === null || !levels.includes(activeLevel)) {
      setActiveLevel(levels[0]);
    }
  }, [levels, activeLevel]);

  // When the user switches floors, clear the selection unless the selected
  // spot lives on the new floor (per Phase 3B requirement).
  useEffect(() => {
    if (!selectedSpotId || !occupancy || activeLevel === null) return;
    const spot = occupancy.spots.find((s) => s.id === selectedSpotId);
    if (!spot || spot.level !== activeLevel) {
      setSelectedSpotId(null);
    }
  }, [activeLevel, selectedSpotId, occupancy]);

  const spotsOnActiveLevel = useMemo(() => {
    if (!occupancy || activeLevel === null) return [] as Spot[];
    return occupancy.spots.filter((s) => s.level === activeLevel);
  }, [occupancy, activeLevel]);

  const availableOnActiveLevel = useMemo(() => {
    return spotsOnActiveLevel.reduce(
      (acc, s) => (s.status === "available" ? acc + 1 : acc),
      0,
    );
  }, [spotsOnActiveLevel]);

  const selectedSpotForGarage =
    selectedSpot && selectedSpot.level === activeLevel ? selectedSpot : null;

  return (
    <>
      <TopBar
        title="Spot Visualization"
        facilityStatus={occupancy?.facility_status}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
      />

      {state.kind === "loading" && <LoadingSkeleton />}

      {state.kind === "error" && (
        <ErrorBanner error={state.error} onRetry={() => void refresh()} />
      )}

      {state.kind === "ready" && (
        <div className="stack">
          {state.occupancy.spots.length === 0 ? (
            <EmptyNotice />
          ) : (
            <>
              <FloorSelector
                levels={levels}
                activeLevel={activeLevel}
                onSelect={setActiveLevel}
              />

              <div className="hero">
                <div className="hero__canvas">
                  <ParkingGarage3D
                    spots={spotsOnActiveLevel}
                    selectedSpot={selectedSpotForGarage}
                    onSelectSpot={handleSelectSpot}
                    viewVersion={viewVersion}
                  />
                </div>
                <HeroOverlays
                  activeLevel={activeLevel}
                  onRecenter={handleRecenter}
                  showHint={!selectedSpotId}
                />
              </div>

              <LegendRow />
              <StatsRow occupancy={state.occupancy} />
            </>
          )}

          {selectedSpot ? (
            <SpotPanel
              spot={selectedSpot}
              onConfirm={handleConfirmSpot}
              onClose={handleClosePanel}
            />
          ) : (
            <>
              {state.occupancy.spots.length > 0 && (
                <HintBar availableCount={availableOnActiveLevel} />
              )}
              <SimulateButton
                simulating={simulating}
                onClick={handleSimulate}
              />
            </>
          )}
        </div>
      )}

      {confirmedSpot && occupancy && (
        <ConfirmationModal
          spot={confirmedSpot}
          garageName={occupancy.lot_name}
          onClose={handleDismissConfirmation}
        />
      )}
    </>
  );
}

interface HintBarProps {
  availableCount: number;
}

function HintBar({ availableCount }: HintBarProps) {
  return (
    <div className="hint-bar">
      <span className="hint-bar__text">
        Tap a <strong>blue</strong> spot to select it
      </span>
      <span className="hint-bar__count">{availableCount} open</span>
    </div>
  );
}

function EmptyNotice() {
  return (
    <div className="notice">
      <div className="notice__title">No demo data yet</div>
      <p className="notice__body">
        Run <code>POST /demo/seed</code> on the backend to generate sample data,
        then refresh.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="skeleton" style={{ height: 56 }} />
      <div className="skeleton skeleton-hero" />
      <div className="skeleton" style={{ height: 56 }} />
      <div className="skeleton" style={{ height: 76 }} />
    </div>
  );
}

interface ErrorBannerProps {
  error: ApiError;
  onRetry: () => void;
}

function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  if (error.kind === "missing_seed") {
    return (
      <div className="notice">
        <div className="notice__title">No demo data yet</div>
        <p className="notice__body">
          Run <code>POST /demo/seed</code> against the backend, then retry.
        </p>
        <button type="button" className="notice__btn" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (error.kind === "network") {
    return (
      <div className="notice notice--error">
        <div className="notice__title">Can't reach the backend</div>
        <p className="notice__body">
          Start the FastAPI server on <code>http://127.0.0.1:8000</code> and try
          again.
        </p>
        <button type="button" className="notice__btn" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="notice notice--error">
      <div className="notice__title">Something went wrong</div>
      <p className="notice__body">{error.message}</p>
      <button type="button" className="notice__btn" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
