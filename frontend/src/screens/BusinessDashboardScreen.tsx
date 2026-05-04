import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildBrightonOccupancyFromSnapshot,
  fetchBrightonMockZonesPayload,
  fetchOccupancy,
  localBrightonMockZonesPayload,
  subscribeBrightonYoloSnapshots,
  type BrightonMockZonesPayload,
  type BrightonWebSocketStatus,
  type BrightonYoloSnapshot,
} from "../lib/api";
import {
  BRIGHTON_FACILITY_SLUG,
  OSU_FACILITY_SLUG,
  getFacility,
  type FacilitySlug,
} from "../lib/facilities";
import { setCachedOccupancy } from "../lib/occupancyCache";
import type { FacilityStatus, Occupancy } from "../lib/types";

interface FacilityDashboardState {
  occupancy: Occupancy | null;
  lastUpdated: Date | null;
  error: string | null;
}

interface FacilityCardData {
  slug: FacilitySlug;
  occupancy: Occupancy | null;
  lastUpdated: Date | null;
  error: string | null;
}

const FACILITY_ORDER: FacilitySlug[] = [
  OSU_FACILITY_SLUG,
  BRIGHTON_FACILITY_SLUG,
];

const STATUS_COPY: Record<FacilityStatus, string> = {
  open: "Open",
  busy: "Busy",
  nearly_full: "Nearly full",
};

const SOCKET_COPY: Record<BrightonWebSocketStatus, string> = {
  connecting: "Connecting",
  connected: "Live",
  reconnecting: "Reconnecting",
  disconnected: "Offline",
};

const MOCK_TREND = [
  { label: "6a", pct: 22 },
  { label: "8a", pct: 48 },
  { label: "10a", pct: 66 },
  { label: "12p", pct: 82 },
  { label: "2p", pct: 74 },
  { label: "4p", pct: 61 },
  { label: "6p", pct: 39 },
];

function emptyFacilityState(): FacilityDashboardState {
  return { occupancy: null, lastUpdated: null, error: null };
}

export function BusinessDashboardScreen() {
  const [facilityState, setFacilityState] = useState<
    Record<FacilitySlug, FacilityDashboardState>
  >({
    [OSU_FACILITY_SLUG]: emptyFacilityState(),
    [BRIGHTON_FACILITY_SLUG]: emptyFacilityState(),
  });
  const [brightonSocketStatus, setBrightonSocketStatus] =
    useState<BrightonWebSocketStatus>("connecting");
  const brightonMockRef = useRef<BrightonMockZonesPayload>(
    localBrightonMockZonesPayload(),
  );

  useEffect(() => {
    let cancelled = false;

    const applyOccupancy = (facilitySlug: FacilitySlug, occupancy: Occupancy) => {
      if (cancelled) return;
      setCachedOccupancy(facilitySlug, occupancy);
      setFacilityState((current) => ({
        ...current,
        [facilitySlug]: {
          occupancy,
          lastUpdated: new Date(),
          error: null,
        },
      }));
    };

    fetchOccupancy(OSU_FACILITY_SLUG)
      .then((occupancy) => applyOccupancy(OSU_FACILITY_SLUG, occupancy))
      .catch((err) => {
        if (cancelled) return;
        setFacilityState((current) => ({
          ...current,
          [OSU_FACILITY_SLUG]: {
            ...current[OSU_FACILITY_SLUG],
            error: String(err),
          },
        }));
      });

    fetchBrightonMockZonesPayload().then((payload) => {
      if (cancelled) return;
      brightonMockRef.current = payload;
    });

    fetchOccupancy(BRIGHTON_FACILITY_SLUG)
      .then((occupancy) => applyOccupancy(BRIGHTON_FACILITY_SLUG, occupancy))
      .catch((err) => {
        if (cancelled) return;
        setFacilityState((current) => ({
          ...current,
          [BRIGHTON_FACILITY_SLUG]: {
            ...current[BRIGHTON_FACILITY_SLUG],
            error: String(err),
          },
        }));
      });

    const unsubscribe = subscribeBrightonYoloSnapshots(
      (snapshot: BrightonYoloSnapshot) => {
        const occupancy = buildBrightonOccupancyFromSnapshot(
          snapshot,
          brightonMockRef.current,
        );
        applyOccupancy(BRIGHTON_FACILITY_SLUG, occupancy);
      },
      {
        onStatusChange: (status) => {
          if (!cancelled) setBrightonSocketStatus(status);
        },
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const facilityCards = useMemo<FacilityCardData[]>(
    () =>
      FACILITY_ORDER.map((slug) => ({
        slug,
        ...facilityState[slug],
      })),
    [facilityState],
  );

  const totals = useMemo(() => {
    return facilityCards.reduce(
      (acc, item) => {
        if (!item.occupancy) return acc;
        acc.available += item.occupancy.available;
        acc.occupied += item.occupancy.occupied;
        acc.capacity += item.occupancy.capacity;
        acc.unknown += item.occupancy.unknown;
        return acc;
      },
      { available: 0, occupied: 0, capacity: 0, unknown: 0 },
    );
  }, [facilityCards]);
  const totalPct =
    totals.capacity > 0 ? Math.round((totals.occupied / totals.capacity) * 100) : 0;

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <a className="dashboard-brand" href="/dashboard" aria-label="SwiftPark Admin">
          <span className="dashboard-brand__pin">P</span>
          <span>
            <strong>SwiftPark</strong>
            <em>Admin</em>
          </span>
        </a>

        <nav className="dashboard-nav" aria-label="Dashboard sections">
          <a href="#status" className="dashboard-nav__item" data-active="true">
            Live Status
          </a>
          <a href="#utilization" className="dashboard-nav__item">
            Utilization
          </a>
          <a href="#alerts" className="dashboard-nav__item">
            Alerts
          </a>
          <a href="#cameras" className="dashboard-nav__item">
            Camera Health
          </a>
        </nav>

        <a className="dashboard-back" href="/">
          Back to Driver App
        </a>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">Operator workspace</p>
            <h1>Business Dashboard</h1>
            <p>
              Monitor live parking availability, camera health, and operational
              signals across SwiftPark facilities.
            </p>
          </div>
          <div className="dashboard-hero__actions">
            <span
              className="dashboard-live-pill"
              data-status={brightonSocketStatus}
            >
              Brighton {SOCKET_COPY[brightonSocketStatus]}
            </span>
            <a className="dashboard-driver-link" href="/">
              Driver App
            </a>
          </div>
        </header>

        <section className="dashboard-kpis" aria-label="Portfolio summary">
          <KpiCard label="Total capacity" value={formatNumber(totals.capacity)} />
          <KpiCard label="Available now" value={formatNumber(totals.available)} tone="blue" />
          <KpiCard label="Occupied" value={formatNumber(totals.occupied)} tone="red" />
          <KpiCard label="Portfolio occupancy" value={`${totalPct}%`} tone="navy" />
        </section>

        <section id="status" className="dashboard-section">
          <div className="dashboard-section__head">
            <div>
              <p className="dashboard-eyebrow">Live Facility Status</p>
              <h2>Facilities</h2>
            </div>
            <span className="dashboard-section__meta">
              Real-time where connected, demo-backed where local services are offline
            </span>
          </div>

          <div className="dashboard-facility-grid">
            {facilityCards.map((card) => (
              <FacilityCard key={card.slug} data={card} />
            ))}
          </div>
        </section>

        <div className="dashboard-two-col">
          <section id="utilization" className="dashboard-panel">
            <div className="dashboard-panel__head">
              <p className="dashboard-eyebrow">Utilization Overview</p>
              <h2>Level and Zone Breakdown</h2>
            </div>
            <BreakdownList cards={facilityCards} />
          </section>

          <section id="alerts" className="dashboard-panel">
            <div className="dashboard-panel__head">
              <p className="dashboard-eyebrow">Alerts / Insights</p>
              <h2>Operator Signals</h2>
            </div>
            <InsightsList cards={facilityCards} socketStatus={brightonSocketStatus} />
          </section>
        </div>

        <div className="dashboard-two-col dashboard-two-col--bottom">
          <section id="cameras" className="dashboard-panel">
            <div className="dashboard-panel__head">
              <p className="dashboard-eyebrow">Camera / YOLO Health</p>
              <h2>Data Sources</h2>
            </div>
            <CameraHealth socketStatus={brightonSocketStatus} />
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel__head">
              <p className="dashboard-eyebrow">Mock Occupancy Trend</p>
              <h2>Today Preview</h2>
            </div>
            <TrendPreview />
          </section>
        </div>
      </section>
    </main>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  tone?: "blue" | "red" | "navy";
}

function KpiCard({ label, value, tone = "navy" }: KpiCardProps) {
  return (
    <article className="dashboard-kpi" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function FacilityCard({ data }: { data: FacilityCardData }) {
  const facility = getFacility(data.slug);
  const occupancy = data.occupancy;
  const status = occupancy?.facility_status ?? "open";
  const pct = occupancy ? clampPct(occupancy.occupancy_pct) : 0;
  const sourceLabel =
    data.slug === BRIGHTON_FACILITY_SLUG
      ? "YOLO live plus zone mock"
      : "Supabase demo API";

  return (
    <article className="dashboard-facility-card">
      <div className="dashboard-facility-card__top">
        <div>
          <h3>{facility.name}</h3>
          <p>{facility.location}</p>
        </div>
        <span className="dashboard-status-pill" data-status={status}>
          {occupancy ? STATUS_COPY[status] : "Loading"}
        </span>
      </div>

      <div className="dashboard-facility-card__meta">
        <span>{formatFacilityType(facility.type)}</span>
        <span>{sourceLabel}</span>
      </div>

      <div className="dashboard-card-metrics">
        <Metric label="Available" value={occupancy?.available} />
        <Metric label="Occupied" value={occupancy?.occupied} />
        <Metric label="Capacity" value={occupancy?.capacity} />
      </div>

      <div className="dashboard-progress">
        <div>
          <span>Occupancy</span>
          <strong>{occupancy ? `${pct.toFixed(1)}%` : "--"}</strong>
        </div>
        <div className="dashboard-progress__track">
          <span
            className="dashboard-progress__bar"
            data-status={status}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <footer className="dashboard-facility-card__foot">
        {data.lastUpdated ? `Updated ${formatTime(data.lastUpdated)}` : "Awaiting data"}
        {data.error && <span>Local API unavailable</span>}
      </footer>
    </article>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <strong>{typeof value === "number" ? formatNumber(value) : "--"}</strong>
      <span>{label}</span>
    </div>
  );
}

function BreakdownList({ cards }: { cards: FacilityCardData[] }) {
  return (
    <div className="dashboard-breakdown">
      {cards.map((card) => {
        const facility = getFacility(card.slug);
        const rows = summarizeSections(card.occupancy);
        return (
          <div key={card.slug} className="dashboard-breakdown__group">
            <h3>{facility.name}</h3>
            {rows.length === 0 ? (
              <p className="dashboard-muted">Waiting for facility data.</p>
            ) : (
              rows.map((row) => (
                <div key={row.label} className="dashboard-breakdown__row">
                  <span>{formatSectionLabel(row.label, facility.sectionLabel)}</span>
                  <div className="dashboard-breakdown__bar" aria-hidden="true">
                    <span style={{ width: `${row.pct}%` }} />
                  </div>
                  <strong>{row.available}/{row.total} open</strong>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function InsightsList({
  cards,
  socketStatus,
}: {
  cards: FacilityCardData[];
  socketStatus: BrightonWebSocketStatus;
}) {
  const insights = buildInsights(cards, socketStatus);
  return (
    <div className="dashboard-insights">
      {insights.map((insight) => (
        <article key={insight.title} className="dashboard-insight" data-tone={insight.tone}>
          <span>{insight.label}</span>
          <strong>{insight.title}</strong>
          <p>{insight.body}</p>
        </article>
      ))}
    </div>
  );
}

function CameraHealth({ socketStatus }: { socketStatus: BrightonWebSocketStatus }) {
  return (
    <div className="dashboard-camera-list">
      <CameraRow
        name="OSU Parking Structure 1"
        source="Demo REST occupancy"
        status="Operational"
        detail="Supabase-backed demo feed"
      />
      <CameraRow
        name="Brighton Zone 1"
        source="YOLO camera stream"
        status={SOCKET_COPY[socketStatus]}
        detail="WebSocket /ws snapshot stream"
        live={socketStatus === "connected"}
      />
      <CameraRow
        name="Brighton Zones 2-3"
        source="Backend mock zones"
        status="Demo mode"
        detail="Stable mock payload for Phase 6 analytics"
      />
    </div>
  );
}

function CameraRow({
  name,
  source,
  status,
  detail,
  live = false,
}: {
  name: string;
  source: string;
  status: string;
  detail: string;
  live?: boolean;
}) {
  return (
    <article className="dashboard-camera-row">
      <div>
        <h3>{name}</h3>
        <p>{source}</p>
      </div>
      <div>
        <span data-live={live ? "true" : undefined}>{status}</span>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function TrendPreview() {
  return (
    <div className="dashboard-trend">
      <div className="dashboard-trend__chart" aria-label="Mock occupancy trend">
        {MOCK_TREND.map((point) => (
          <div key={point.label} className="dashboard-trend__bar-wrap">
            <span
              className="dashboard-trend__bar"
              style={{ height: `${point.pct}%` }}
            />
            <small>{point.label}</small>
          </div>
        ))}
      </div>
      <p>
        Placeholder trend using mocked hourly utilization until historical event
        analytics are wired into the backend.
      </p>
    </div>
  );
}

function summarizeSections(occupancy: Occupancy | null) {
  if (!occupancy) return [];
  const map = new Map<string, { label: string; total: number; available: number }>();
  for (const spot of occupancy.spots) {
    const row = map.get(spot.level) ?? {
      label: spot.level,
      total: 0,
      available: 0,
    };
    row.total += 1;
    if (spot.status === "available") row.available += 1;
    map.set(spot.level, row);
  }
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      pct: row.total > 0 ? (row.available / row.total) * 100 : 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

function buildInsights(
  cards: FacilityCardData[],
  socketStatus: BrightonWebSocketStatus,
) {
  const nearlyFull = cards.find(
    (card) => card.occupancy && card.occupancy.occupancy_pct >= 85,
  );
  const lowAvailability = cards.find(
    (card) =>
      card.occupancy &&
      card.occupancy.capacity > 0 &&
      card.occupancy.available / card.occupancy.capacity < 0.15,
  );

  return [
    {
      label: nearlyFull ? "Capacity risk" : "Portfolio",
      title: nearlyFull
        ? `${getFacility(nearlyFull.slug).name} is nearing capacity`
        : "Facilities are within operating range",
      body: nearlyFull
        ? "Consider opening overflow signage or nudging drivers toward alternate zones."
        : "No urgent saturation alert from current demo data.",
      tone: nearlyFull ? "warning" : "good",
    },
    {
      label: "Camera health",
      title:
        socketStatus === "connected"
          ? "Brighton live feed connected"
          : "Brighton live feed needs attention",
      body:
        socketStatus === "connected"
          ? "Zone 1 snapshots are streaming into the operator dashboard."
          : "The dashboard will keep the last valid snapshot and reconnect automatically.",
      tone: socketStatus === "connected" ? "good" : "warning",
    },
    {
      label: lowAvailability ? "Operations" : "Planning",
      title: lowAvailability
        ? "Low availability detected"
        : "Mock forecast ready for demo",
      body: lowAvailability
        ? "Route attendants or signage toward sections with the most available stalls."
        : "Hourly demand preview is mocked for Phase 6A and ready to replace with events.",
      tone: lowAvailability ? "warning" : "neutral",
    },
  ] as const;
}

function formatFacilityType(type: string): string {
  if (type === "surface_lot") return "Surface lot";
  return "Garage";
}

function formatSectionLabel(level: string, sectionLabel: "Level" | "Zone") {
  if (sectionLabel === "Zone") return `Zone ${level.replace(/^Z/i, "")}`;
  return `Level ${level}`;
}

function clampPct(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
