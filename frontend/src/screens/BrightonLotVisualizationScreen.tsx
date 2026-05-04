import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmationModal } from "../components/ConfirmationModal";
import { FloorSelector } from "../components/FloorSelector";
import { HeroOverlays } from "../components/HeroOverlays";
import { LegendRow } from "../components/LegendRow";
import BrightonLot3D from "../components/parking/BrightonLot3D";
import { SpotPanel } from "../components/SpotPanel";
import { StatsRow } from "../components/StatsRow";
import { TopBar } from "../components/TopBar";
import {
  ApiError,
  buildBrightonOccupancyFromSnapshot,
  fetchBrightonMockZonesPayload,
  fetchBrightonYoloStatus,
  localBrightonMockZonesPayload,
  subscribeBrightonYoloSnapshots,
  type BrightonMockZonesPayload,
  type BrightonYoloSnapshot,
} from "../lib/api";
import {
  BRIGHTON_ZONE1_LABELS,
  buildBrightonLotLayout,
  formatBrightonZoneName,
  type BrightonZone,
} from "../lib/brightonLotLayout";
import { setCachedOccupancy } from "../lib/occupancyCache";
import { BRIGHTON_FACILITY_SLUG } from "../lib/facilities";
import type { Occupancy, Spot } from "../lib/types";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; occupancy: Occupancy }
  | { kind: "error"; error: ApiError };

interface BrightonLotVisualizationScreenProps {
  onBack?: () => void;
  onStartNavigation?: (spot: Spot) => void;
}

const ZONES: BrightonZone[] = ["Z1", "Z2", "Z3"];

export function BrightonLotVisualizationScreen({
  onBack,
  onStartNavigation,
}: BrightonLotVisualizationScreenProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [activeZone, setActiveZone] = useState<BrightonZone>("Z1");
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [confirmedSpot, setConfirmedSpot] = useState<Spot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewVersion, setViewVersion] = useState(0);
  const mockPayloadRef = useRef<BrightonMockZonesPayload>(
    localBrightonMockZonesPayload(),
  );
  const latestYoloRef = useRef<BrightonYoloSnapshot | null>(null);
  const hasOccupancyRef = useRef(false);

  const applyOccupancy = useCallback((occupancy: Occupancy) => {
    hasOccupancyRef.current = true;
    setState({ kind: "ready", occupancy });
    setCachedOccupancy(BRIGHTON_FACILITY_SLUG, occupancy);
    setSelectedSpotId((current) => {
      if (!current) return current;
      const spot = occupancy.spots.find((item) => item.id === current);
      return spot && spot.status === "available" ? current : null;
    });
  }, []);

  const applyYoloSnapshot = useCallback(
    (snapshot: BrightonYoloSnapshot) => {
      latestYoloRef.current = snapshot;
      applyOccupancy(
        buildBrightonOccupancyFromSnapshot(snapshot, mockPayloadRef.current),
      );
    },
    [applyOccupancy],
  );

  const refreshRestSnapshot = useCallback(async () => {
    setRefreshing(true);
    try {
      const snapshot = await fetchBrightonYoloStatus();
      applyYoloSnapshot(snapshot);
    } catch (err) {
      if (!hasOccupancyRef.current) {
        const apiErr =
          err instanceof ApiError ? err : new ApiError(String(err), "network");
        setState({ kind: "error", error: apiErr });
      }
    } finally {
      setRefreshing(false);
    }
  }, [applyYoloSnapshot]);

  useEffect(() => {
    let cancelled = false;

    mockPayloadRef.current = localBrightonMockZonesPayload();

    const applyIfMounted = (snapshot: BrightonYoloSnapshot) => {
      if (!cancelled) applyYoloSnapshot(snapshot);
    };

    const unsubscribe = subscribeBrightonYoloSnapshots(applyIfMounted);

    fetchBrightonMockZonesPayload()
      .then((mockPayload) => {
        if (cancelled) return;
        mockPayloadRef.current = mockPayload;
        if (latestYoloRef.current) applyYoloSnapshot(latestYoloRef.current);
      })
      .catch(() => {
        // fetchBrightonMockZonesPayload already falls back internally.
      });

    setRefreshing(true);
    fetchBrightonYoloStatus()
      .then((snapshot) => {
        if (!cancelled) applyYoloSnapshot(snapshot);
      })
      .catch((err) => {
        if (cancelled || hasOccupancyRef.current) return;
        const apiErr =
          err instanceof ApiError ? err : new ApiError(String(err), "network");
        setState({ kind: "error", error: apiErr });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applyYoloSnapshot]);

  const handleRefreshSnapshot = useCallback(async () => {
    await refreshRestSnapshot();
  }, [refreshRestSnapshot]);

  const occupancy = state.kind === "ready" ? state.occupancy : null;

  const rawSpotsOnActiveZone = useMemo(() => {
    if (!occupancy) return [] as Spot[];
    return occupancy.spots.filter((spot) => spot.level === activeZone);
  }, [occupancy, activeZone]);

  const visualSpots = useMemo(() => {
    if (activeZone !== "Z1") return rawSpotsOnActiveZone;
    const byLabel = new Map(
      rawSpotsOnActiveZone.map((spot) => [spot.label.toUpperCase(), spot]),
    );
    const calibrated: Spot[] = BRIGHTON_ZONE1_LABELS.map((label) => {
      const missingSpot: Spot = {
        id: `brighton-z1-missing-${label.toLowerCase()}`,
        label,
        level: "Z1",
        status: "unknown",
        confidence: 0,
      };
      return (
        byLabel.get(label.toUpperCase()) ?? missingSpot
      );
    });
    const known = new Set(BRIGHTON_ZONE1_LABELS.map((label) => label.toUpperCase()));
    const extras = rawSpotsOnActiveZone.filter(
      (spot) => !known.has(spot.label.toUpperCase()),
    );
    return [...calibrated, ...extras];
  }, [activeZone, rawSpotsOnActiveZone]);

  const spaces = useMemo(
    () => buildBrightonLotLayout(activeZone, visualSpots),
    [activeZone, visualSpots],
  );

  const selectedSpot =
    visualSpots.find((spot) => spot.id === selectedSpotId) ?? null;

  useEffect(() => {
    if (!selectedSpotId) return;
    const stillVisible = visualSpots.some(
      (spot) => spot.id === selectedSpotId && spot.status === "available",
    );
    if (!stillVisible) setSelectedSpotId(null);
  }, [selectedSpotId, visualSpots]);

  const availableOnActiveZone = useMemo(
    () =>
      visualSpots.reduce(
        (total, spot) => total + (spot.status === "available" ? 1 : 0),
        0,
      ),
    [visualSpots],
  );

  const handleConfirmSpot = useCallback(() => {
    if (!selectedSpot) return;
    setConfirmedSpot(selectedSpot);
  }, [selectedSpot]);

  const handleRecenter = useCallback(() => {
    setViewVersion((version) => version + 1);
  }, []);

  return (
    <>
      <TopBar
        title="Brighton Spot Map"
        facilityStatus={occupancy?.facility_status}
        onRefresh={() => void refreshRestSnapshot()}
        refreshing={refreshing}
        onBack={onBack}
      />

      {state.kind === "loading" && <LoadingSkeleton />}

      {state.kind === "error" && (
        <ErrorBanner error={state.error} onRetry={() => void refreshRestSnapshot()} />
      )}

      {state.kind === "ready" && (
        <div className="stack">
          <FloorSelector
            levels={ZONES}
            activeLevel={activeZone}
            onSelect={(zone) => setActiveZone(zone as BrightonZone)}
            sectionLabel="Zone"
          />

          <div className="hero hero--surface-lot">
            <div className="hero__canvas">
              <BrightonLot3D
                spaces={spaces}
                spots={visualSpots}
                selectedSpot={selectedSpot}
                onSelectSpot={setSelectedSpotIdFromSpot}
                viewVersion={viewVersion}
              />
            </div>
            <HeroOverlays
              activeLevel={activeZone}
              onRecenter={handleRecenter}
              showHint={!selectedSpotId}
              modeLabel="3D"
              sectionLabel="Zone"
            />
          </div>

          <LegendRow />
          <StatsRow occupancy={state.occupancy} />

          {selectedSpot ? (
            <SpotPanel
              spot={selectedSpot}
              onConfirm={handleConfirmSpot}
              onClose={() => setSelectedSpotId(null)}
              sectionLabel="Zone"
            />
          ) : (
            <>
              <HintBar
                activeZone={activeZone}
                availableCount={availableOnActiveZone}
              />
              <SnapshotRefreshButton
                refreshing={refreshing}
                onClick={() => void handleRefreshSnapshot()}
              />
            </>
          )}
        </div>
      )}

      {confirmedSpot && occupancy && (
        <ConfirmationModal
          spot={confirmedSpot}
          garageName={occupancy.lot_name}
          onClose={() => {
            setConfirmedSpot(null);
            setSelectedSpotId(null);
          }}
          onStartNavigation={onStartNavigation}
          sectionLabel="Zone"
        />
      )}
    </>
  );

  function setSelectedSpotIdFromSpot(spot: Spot) {
    setSelectedSpotId(spot.id);
  }
}

interface HintBarProps {
  activeZone: BrightonZone;
  availableCount: number;
}

function HintBar({ activeZone, availableCount }: HintBarProps) {
  return (
    <div className="hint-bar">
      <span className="hint-bar__text">
        Tap a <strong>blue</strong> space in{" "}
        {formatBrightonZoneName(activeZone)} to select it
      </span>
      <span className="hint-bar__count">{availableCount} open</span>
    </div>
  );
}

interface SnapshotRefreshButtonProps {
  refreshing: boolean;
  onClick: () => void;
}

function SnapshotRefreshButton({
  refreshing,
  onClick,
}: SnapshotRefreshButtonProps) {
  return (
    <button
      type="button"
      className="simulate-btn"
      onClick={onClick}
      disabled={refreshing}
      aria-busy={refreshing}
    >
      <span className="simulate-btn__icon" aria-hidden="true">
        {refreshing ? (
          <span className="spinner" />
        ) : (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <path
              d="M13.5 2.8V6h-3.2"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span>{refreshing ? "Refreshing camera..." : "Refresh Camera Snapshot"}</span>
    </button>
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
  if (error.kind === "network") {
    return (
      <div className="notice notice--error">
        <div className="notice__title">Can't reach the Brighton camera backend</div>
        <p className="notice__body">
          Start the YOLO FastAPI server on <code>http://127.0.0.1:8001</code>{" "}
          and try again.
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
