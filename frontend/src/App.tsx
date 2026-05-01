import { useCallback, useEffect, useMemo, useState } from "react";

import { Header } from "./components/Header";
import { StatsCard } from "./components/StatsCard";
import { LevelList } from "./components/LevelList";
import { SpotPanel } from "./components/SpotPanel";
import { ConfirmationModal } from "./components/ConfirmationModal";
import ParkingGarage3D from "./components/parking/ParkingGarage3D";

import { ApiError, fetchOccupancy, simulateDetection } from "./lib/api";
import type { Occupancy, Spot } from "./lib/types";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; occupancy: Occupancy }
  | { kind: "error"; error: ApiError };

function App() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [confirmedSpot, setConfirmedSpot] = useState<Spot | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [activeLevel, setActiveLevel] = useState<string | null>(null);

  const applyOccupancy = useCallback(
    (occupancy: Occupancy) => {
      setState({ kind: "ready", occupancy });
      setLastUpdated(new Date());

      // Drop the selection if the spot is no longer available.
      setSelectedSpotId((current) => {
        if (!current) return current;
        const spot = occupancy.spots.find((s) => s.id === current);
        return spot && spot.status === "available" ? current : null;
      });
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const data = await fetchOccupancy();
      applyOccupancy(data);
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : new ApiError(String(err), "network");
      setState({ kind: "error", error: apiErr });
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
        err instanceof ApiError
          ? err
          : new ApiError(String(err), "network");
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

  const occupancy = state.kind === "ready" ? state.occupancy : null;
  const selectedSpot =
    occupancy && selectedSpotId
      ? occupancy.spots.find((s) => s.id === selectedSpotId) ?? null
      : null;

  // Levels present in the current occupancy, sorted naturally (L1, L2, L3).
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

  const spotsOnActiveLevel = useMemo(() => {
    if (!occupancy || activeLevel === null) return [] as Spot[];
    return occupancy.spots.filter((s) => s.level === activeLevel);
  }, [occupancy, activeLevel]);

  // Only pass `selectedSpot` into the 3D viewport when it lives on the
  // currently visible floor; otherwise the glow would be on the wrong tile.
  const selectedSpotForGarage =
    selectedSpot && selectedSpot.level === activeLevel ? selectedSpot : null;

  return (
    <div className="app-shell">
      <Header facilityStatus={occupancy?.facility_status} />

      {state.kind === "loading" && <LoadingSkeleton />}

      {state.kind === "error" && (
        <ErrorBanner error={state.error} onRetry={() => void refresh()} />
      )}

      {state.kind === "ready" && (
        <div className="stack">
          <StatsCard occupancy={state.occupancy} lastUpdated={lastUpdated} />

          {state.occupancy.spots.length === 0 ? (
            <div className="empty-card">
              No spots yet. Run <code>POST /demo/seed</code> on the backend to
              generate sample data.
            </div>
          ) : (
            <>
              <LevelList spots={state.occupancy.spots} />
              <FloorSelector
                levels={levels}
                activeLevel={activeLevel}
                onSelect={setActiveLevel}
              />
              <div className="garage3d-frame">
                <ParkingGarage3D
                  spots={spotsOnActiveLevel}
                  selectedSpot={selectedSpotForGarage}
                  onSelectSpot={handleSelectSpot}
                />
              </div>
            </>
          )}

          {selectedSpot ? (
            <SpotPanel
              spot={selectedSpot}
              onConfirm={handleConfirmSpot}
              onClose={handleClosePanel}
            />
          ) : (
            <SimulateBar simulating={simulating} onClick={handleSimulate} />
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
    </div>
  );
}

interface FloorSelectorProps {
  levels: string[];
  activeLevel: string | null;
  onSelect: (level: string) => void;
}

function FloorSelector({ levels, activeLevel, onSelect }: FloorSelectorProps) {
  if (levels.length === 0) return null;
  return (
    <div className="floor-selector" role="tablist" aria-label="Floor selector">
      {levels.map((level) => {
        const isActive = level === activeLevel;
        return (
          <button
            key={level}
            type="button"
            role="tab"
            aria-selected={isActive}
            className="floor-selector__btn"
            data-active={isActive ? "true" : undefined}
            onClick={() => onSelect(level)}
          >
            Level {level}
          </button>
        );
      })}
    </div>
  );
}

interface SimulateBarProps {
  simulating: boolean;
  onClick: () => void;
}

function SimulateBar({ simulating, onClick }: SimulateBarProps) {
  return (
    <div className="simulate">
      <button
        type="button"
        className="simulate__btn"
        onClick={onClick}
        disabled={simulating}
      >
        {simulating ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Running detection…
          </>
        ) : (
          <>Run Detection Simulation</>
        )}
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="card">
        <div className="skeleton skeleton-line" style={{ width: "60%" }} />
        <div className="skeleton skeleton-line" style={{ width: "40%" }} />
        <div
          className="skeleton skeleton-line"
          style={{ height: 56, marginTop: 16 }}
        />
        <div className="skeleton skeleton-line" />
      </div>
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
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
      <div className="empty-card">
        <strong>No demo data yet.</strong>
        <p style={{ margin: "6px 0 10px" }}>
          Run <code>POST /demo/seed</code> against the backend, then retry.
        </p>
        <button
          type="button"
          className="modal__close"
          style={{ width: "auto", padding: "8px 14px" }}
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    );
  }

  if (error.kind === "network") {
    return (
      <div className="error-card">
        <strong>Can't reach the SwiftPark backend.</strong>
        Start the FastAPI server on{" "}
        <code>http://127.0.0.1:8000</code> and try again.
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="modal__close"
            style={{ width: "auto", padding: "8px 14px" }}
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="error-card">
      <strong>Something went wrong.</strong>
      {error.message}
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          className="modal__close"
          style={{ width: "auto", padding: "8px 14px" }}
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export default App;
