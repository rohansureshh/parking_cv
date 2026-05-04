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
import type { FacilityStatus, Occupancy, Spot } from "../lib/types";

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

interface SectionStat {
  label: string;
  total: number;
  available: number;
  occupied: number;
  pct: number;
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

// 24h-style hourly utilization preview, used until historical event data is
// wired into the backend. Shape mirrors a future `/analytics/trend` payload.
const MOCK_TREND = [
  { label: "6a", pct: 22 },
  { label: "8a", pct: 48 },
  { label: "10a", pct: 66 },
  { label: "12p", pct: 82 },
  { label: "2p", pct: 74 },
  { label: "4p", pct: 61 },
  { label: "6p", pct: 39 },
];

interface ActivityEvent {
  id: string;
  source: "live" | "mock";
  whenLabel: string;
  title: string;
  body: string;
}

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
    totals.capacity > 0
      ? Math.round((totals.occupied / totals.capacity) * 100)
      : 0;
  const facilitiesReporting = facilityCards.filter((c) => c.occupancy).length;
  const liveSourceLabel =
    brightonSocketStatus === "connected"
      ? "1 / 1 live"
      : "0 / 1 live";
  const avgFacilityPct = useMemo(() => {
    const reporting = facilityCards.filter((c) => c.occupancy);
    if (reporting.length === 0) return 0;
    const sum = reporting.reduce(
      (acc, c) => acc + clampPct(c.occupancy?.occupancy_pct ?? 0),
      0,
    );
    return Math.round(sum / reporting.length);
  }, [facilityCards]);

  const brightonCard = facilityCards.find(
    (c) => c.slug === BRIGHTON_FACILITY_SLUG,
  );
  const zoneOneStats = useMemo(
    () => getSectionStats(brightonCard?.occupancy ?? null, "Z1"),
    [brightonCard],
  );

  const activity = useMemo(
    () => buildActivityFeed(facilityCards, brightonSocketStatus),
    [facilityCards, brightonSocketStatus],
  );

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
            Operator Alerts
          </a>
          <a href="#cameras" className="dashboard-nav__item">
            Camera &amp; YOLO
          </a>
          <a href="#analytics" className="dashboard-nav__item">
            Analytics
          </a>
          <a href="#activity" className="dashboard-nav__item">
            Recent Activity
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
              Live occupancy, camera health, and operational signals across
              every SwiftPark facility you manage.
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
          <KpiCard
            label="Total capacity"
            value={formatNumber(totals.capacity)}
            sub="Across all facilities"
          />
          <KpiCard
            label="Available now"
            value={formatNumber(totals.available)}
            sub="Open stalls right now"
            tone="blue"
          />
          <KpiCard
            label="Occupied"
            value={formatNumber(totals.occupied)}
            sub="Occupied stalls right now"
            tone="red"
          />
          <KpiCard
            label="Avg occupancy"
            value={`${avgFacilityPct}%`}
            sub={`${totalPct}% portfolio`}
            tone="navy"
          />
          <KpiCard
            label="Facilities monitored"
            value={`${facilitiesReporting} / ${FACILITY_ORDER.length}`}
            sub="Reporting in this session"
          />
          <KpiCard
            label="Live data sources"
            value={liveSourceLabel}
            sub={`Brighton ${SOCKET_COPY[brightonSocketStatus]}`}
            tone={brightonSocketStatus === "connected" ? "live" : "warning"}
          />
        </section>

        <section id="status" className="dashboard-section">
          <div className="dashboard-section__head">
            <div>
              <p className="dashboard-eyebrow">Live Facility Status</p>
              <h2>Facilities</h2>
            </div>
            <span className="dashboard-section__meta">
              Real-time when connected • bundled mock data for offline demo
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
              <h2>Level &amp; Zone Breakdown</h2>
            </div>
            <BreakdownList cards={facilityCards} />
          </section>

          <section id="alerts" className="dashboard-panel">
            <div className="dashboard-panel__head">
              <p className="dashboard-eyebrow">Operator Signals</p>
              <h2>Alerts &amp; Insights</h2>
            </div>
            <InsightsList
              cards={facilityCards}
              socketStatus={brightonSocketStatus}
            />
          </section>
        </div>

        <section id="cameras" className="dashboard-section">
          <div className="dashboard-section__head">
            <div>
              <p className="dashboard-eyebrow">Camera &amp; YOLO Health</p>
              <h2>Live Detection Sources</h2>
            </div>
            <span className="dashboard-section__meta">
              Brighton Zone 1 streams via WebSocket • OSU and Brighton 2-3 use
              the SwiftPark mock backend
            </span>
          </div>

          <div className="dashboard-camera-grid">
            <BrightonCameraFeature
              status={brightonSocketStatus}
              zoneOneStats={zoneOneStats}
              brightonCard={brightonCard ?? null}
            />
            <CameraSourceList
              socketStatus={brightonSocketStatus}
              brightonLastUpdated={brightonCard?.lastUpdated ?? null}
              osuLastUpdated={
                facilityCards.find((c) => c.slug === OSU_FACILITY_SLUG)
                  ?.lastUpdated ?? null
              }
            />
          </div>
        </section>

        <div className="dashboard-two-col">
          <section id="analytics" className="dashboard-panel">
            <div className="dashboard-panel__head">
              <p className="dashboard-eyebrow">Analytics Highlights</p>
              <h2>Operational Snapshot</h2>
            </div>
            <AnalyticsHighlights
              totalPct={totalPct}
              avgFacilityPct={avgFacilityPct}
              socketStatus={brightonSocketStatus}
              brightonCard={brightonCard ?? null}
            />
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel__head">
              <p className="dashboard-eyebrow">Mock Occupancy Trend</p>
              <h2>Hourly Preview</h2>
            </div>
            <TrendPreview />
          </section>
        </div>

        <section id="activity" className="dashboard-panel dashboard-panel--full">
          <div className="dashboard-panel__head">
            <p className="dashboard-eyebrow">Recent Activity</p>
            <h2>Operations Feed</h2>
          </div>
          <ActivityFeed events={activity} />
        </section>
      </section>
    </main>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "blue" | "red" | "navy" | "live" | "warning";
}

function KpiCard({ label, value, sub, tone = "navy" }: KpiCardProps) {
  return (
    <article className="dashboard-kpi" data-tone={tone}>
      <span className="dashboard-kpi__label">{label}</span>
      <strong className="dashboard-kpi__value">{value}</strong>
      {sub && <span className="dashboard-kpi__sub">{sub}</span>}
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
      ? "YOLO live + zone mock"
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
        <span className="dashboard-chip" data-tone="neutral">
          {formatFacilityType(facility.type)}
        </span>
        <span className="dashboard-chip" data-tone="neutral">
          {sourceLabel}
        </span>
        <span className="dashboard-chip" data-tone="neutral">
          {facility.sectionLabel === "Zone" ? "Zoned lot" : "Multi-level"}
        </span>
      </div>

      <div className="dashboard-card-metrics">
        <Metric label="Available" value={occupancy?.available} tone="blue" />
        <Metric label="Occupied" value={occupancy?.occupied} tone="red" />
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
        <span>
          {data.lastUpdated
            ? `Updated ${formatTime(data.lastUpdated)}`
            : "Awaiting data"}
        </span>
        {data.error && <span data-error="true">Local API unavailable</span>}
      </footer>
    </article>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value?: number;
  tone?: "blue" | "red";
}) {
  return (
    <div data-tone={tone}>
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
              <p className="dashboard-muted">Waiting for facility data…</p>
            ) : (
              rows.map((row) => (
                <div key={row.label} className="dashboard-breakdown__row">
                  <span>
                    {formatSectionLabel(row.label, facility.sectionLabel)}
                  </span>
                  <div className="dashboard-breakdown__bar" aria-hidden="true">
                    <span
                      data-saturation={saturationFromPct(100 - row.pct)}
                      style={{ width: `${100 - row.pct}%` }}
                    />
                  </div>
                  <strong>
                    {row.available}/{row.total} open
                  </strong>
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
        <article
          key={insight.title}
          className="dashboard-insight"
          data-tone={insight.tone}
        >
          <span>{insight.label}</span>
          <strong>{insight.title}</strong>
          <p>{insight.body}</p>
        </article>
      ))}
    </div>
  );
}

interface BrightonCameraFeatureProps {
  status: BrightonWebSocketStatus;
  zoneOneStats: SectionStat | null;
  brightonCard: FacilityCardData | null;
}

function BrightonCameraFeature({
  status,
  zoneOneStats,
  brightonCard,
}: BrightonCameraFeatureProps) {
  const lastUpdated = brightonCard?.lastUpdated ?? null;
  const isLive = status === "connected";
  return (
    <article
      className="dashboard-camera-feature"
      data-status={status}
      aria-labelledby="brighton-camera-title"
    >
      <header>
        <div>
          <p className="dashboard-eyebrow">Brighton Zone 1 · YOLO camera</p>
          <h3 id="brighton-camera-title">Live detection feed</h3>
        </div>
        <span className="dashboard-live-pill" data-status={status}>
          {SOCKET_COPY[status]}
        </span>
      </header>

      <div className="dashboard-camera-feature__preview" aria-hidden="true">
        <div className="dashboard-camera-feature__preview-grid" />
        <div className="dashboard-camera-feature__overlay">
          <span className="dashboard-camera-feature__pin">P</span>
          <strong>Camera feed preview</strong>
          <small>
            Live snapshots arrive over the YOLO WebSocket. Frame rendering is
            stubbed for the demo.
          </small>
        </div>
        {isLive && (
          <span className="dashboard-camera-feature__badge">
            <span aria-hidden="true" />
            YOLO detections active
          </span>
        )}
      </div>

      <div className="dashboard-camera-feature__metrics">
        <Metric label="Available" value={zoneOneStats?.available} tone="blue" />
        <Metric label="Occupied" value={zoneOneStats?.occupied} tone="red" />
        <Metric label="Capacity" value={zoneOneStats?.total} />
      </div>

      <footer className="dashboard-camera-feature__foot">
        <span>
          Latest snapshot:&nbsp;
          <strong>
            {lastUpdated ? formatTime(lastUpdated) : "—"}
          </strong>
        </span>
        <span>
          Source:&nbsp;
          <strong>YOLOv8 · WebSocket /ws</strong>
        </span>
      </footer>
    </article>
  );
}

interface CameraSourceListProps {
  socketStatus: BrightonWebSocketStatus;
  brightonLastUpdated: Date | null;
  osuLastUpdated: Date | null;
}

function CameraSourceList({
  socketStatus,
  brightonLastUpdated,
  osuLastUpdated,
}: CameraSourceListProps) {
  return (
    <div className="dashboard-camera-list">
      <CameraRow
        name="OSU Parking Structure 1"
        source="Demo REST occupancy"
        status="Operational"
        detail="Supabase-backed demo feed"
        lastUpdated={osuLastUpdated}
      />
      <CameraRow
        name="Brighton Zone 1"
        source="YOLO camera stream"
        status={SOCKET_COPY[socketStatus]}
        detail="WebSocket /ws snapshot stream"
        live={socketStatus === "connected"}
        lastUpdated={brightonLastUpdated}
      />
      <CameraRow
        name="Brighton Zones 2-3"
        source="Backend mock zones"
        status="Demo mode"
        detail="Stable mock payload for analytics"
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
  lastUpdated,
}: {
  name: string;
  source: string;
  status: string;
  detail: string;
  live?: boolean;
  lastUpdated?: Date | null;
}) {
  return (
    <article className="dashboard-camera-row">
      <div>
        <h3>{name}</h3>
        <p>{source}</p>
        <small>{detail}</small>
      </div>
      <div className="dashboard-camera-row__status">
        <span data-live={live ? "true" : undefined}>{status}</span>
        <small>
          {lastUpdated ? `Updated ${formatTime(lastUpdated)}` : "Awaiting data"}
        </small>
      </div>
    </article>
  );
}

interface AnalyticsHighlightsProps {
  totalPct: number;
  avgFacilityPct: number;
  socketStatus: BrightonWebSocketStatus;
  brightonCard: FacilityCardData | null;
}

function AnalyticsHighlights({
  totalPct,
  avgFacilityPct,
  socketStatus,
  brightonCard,
}: AnalyticsHighlightsProps) {
  const cells: Array<{ label: string; value: string; sub: string }> = [
    {
      label: "Peak hour today",
      value: "12:00 PM",
      sub: "Mock — replace with live history",
    },
    {
      label: "Predicted full",
      value: predictFullTimeFromPct(brightonCard?.occupancy?.occupancy_pct),
      sub: "Brighton extrapolation (mock)",
    },
    {
      label: "Utilization rate (24h)",
      value: `${Math.max(totalPct, avgFacilityPct)}%`,
      sub: "Computed from live + mock totals",
    },
    {
      label: "Camera uptime (7d)",
      value: socketStatus === "connected" ? "99.2%" : "98.4%",
      sub: "Mock SLA target: 99%",
    },
  ];

  return (
    <div className="dashboard-analytics">
      {cells.map((cell) => (
        <article key={cell.label} className="dashboard-analytics__cell">
          <span>{cell.label}</span>
          <strong>{cell.value}</strong>
          <small>{cell.sub}</small>
        </article>
      ))}
    </div>
  );
}

function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="dashboard-muted">
        No operations events yet — once facilities report data, signals appear
        here.
      </p>
    );
  }
  return (
    <ol className="dashboard-activity">
      {events.map((event) => (
        <li
          key={event.id}
          className="dashboard-activity__item"
          data-source={event.source}
        >
          <div className="dashboard-activity__when">
            <span className="dashboard-activity__dot" aria-hidden="true" />
            <time>{event.whenLabel}</time>
            {event.source === "live" && (
              <span className="dashboard-activity__chip">live</span>
            )}
          </div>
          <div className="dashboard-activity__body">
            <strong>{event.title}</strong>
            <p>{event.body}</p>
          </div>
        </li>
      ))}
    </ol>
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
        Hourly utilization preview is mocked for the Phase 6 demo until
        historical event analytics ship in the backend.
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function summarizeSections(occupancy: Occupancy | null): SectionStat[] {
  if (!occupancy) return [];
  const map = new Map<string, SectionStat>();
  for (const spot of occupancy.spots) {
    const row = map.get(spot.level) ?? {
      label: spot.level,
      total: 0,
      available: 0,
      occupied: 0,
      pct: 0,
    };
    row.total += 1;
    if (spot.status === "available") row.available += 1;
    if (spot.status === "occupied") row.occupied += 1;
    map.set(spot.level, row);
  }
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      pct: row.total > 0 ? (row.occupied / row.total) * 100 : 0,
    }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
}

function getSectionStats(
  occupancy: Occupancy | null,
  level: string,
): SectionStat | null {
  if (!occupancy) return null;
  const matching = occupancy.spots.filter((s: Spot) => s.level === level);
  if (matching.length === 0) return null;
  const available = matching.filter((s) => s.status === "available").length;
  const occupied = matching.filter((s) => s.status === "occupied").length;
  return {
    label: level,
    total: matching.length,
    available,
    occupied,
    pct: matching.length > 0 ? (occupied / matching.length) * 100 : 0,
  };
}

interface InsightCard {
  label: string;
  title: string;
  body: string;
  tone: "good" | "warning" | "neutral" | "info";
}

function buildInsights(
  cards: FacilityCardData[],
  socketStatus: BrightonWebSocketStatus,
): InsightCard[] {
  const out: InsightCard[] = [];

  // 1. Per-facility capacity risk
  const nearlyFull = cards.find(
    (card) => card.occupancy && card.occupancy.occupancy_pct >= 85,
  );
  out.push({
    label: nearlyFull ? "Capacity risk" : "Portfolio status",
    title: nearlyFull
      ? `${getFacility(nearlyFull.slug).name} nearing capacity`
      : "All facilities within operating range",
    body: nearlyFull
      ? "Open overflow signage or nudge drivers toward neighboring zones."
      : "No saturation alert across reporting facilities right now.",
    tone: nearlyFull ? "warning" : "good",
  });

  // 2. Camera health
  out.push({
    label: "Camera health",
    title:
      socketStatus === "connected"
        ? "Brighton live feed connected"
        : "Brighton live feed degraded",
    body:
      socketStatus === "connected"
        ? "Zone 1 detection snapshots are streaming over the YOLO WebSocket."
        : "Holding the last valid snapshot. Auto-reconnect is running in the background.",
    tone: socketStatus === "connected" ? "good" : "warning",
  });

  // 3. Per-facility utilization watch (highest-utilized section)
  const hotSection = findHottestSection(cards);
  if (hotSection) {
    out.push({
      label: "High utilization",
      title: `${hotSection.facilityName} ${hotSection.sectionDisplay} at ${Math.round(
        hotSection.pct,
      )}%`,
      body:
        hotSection.pct >= 90
          ? "Recommend routing arriving drivers away from this section."
          : "Monitor for the next 15 minutes — close to a recommended re-routing threshold.",
      tone: hotSection.pct >= 90 ? "warning" : "info",
    });
  } else {
    out.push({
      label: "Utilization",
      title: "No section above 80%",
      body: "Demand looks evenly distributed across reporting sections.",
      tone: "good",
    });
  }

  // 4. Section imbalance
  const imbalance = findImbalance(cards);
  if (imbalance) {
    out.push({
      label: "Imbalance",
      title: `${imbalance.facilityName} demand skewed to ${imbalance.heavyLabel}`,
      body: `Drivers piling into ${imbalance.heavyLabel} while ${imbalance.lightLabel} is sitting at ${Math.round(
        100 - imbalance.lightPct,
      )}% open.`,
      tone: "info",
    });
  } else {
    out.push({
      label: "Distribution",
      title: "Sections evenly used",
      body: "No notable section-to-section imbalance across facilities.",
      tone: "neutral",
    });
  }

  // 5. Predicted demand window (mock)
  out.push({
    label: "Forecast",
    title: "Expected peak window 11:30 AM – 1:30 PM",
    body: "Mock prediction based on Phase 6 demo trend curve. Hooks in cleanly to a future /analytics/forecast endpoint.",
    tone: "neutral",
  });

  return out;
}

interface HotSection {
  facilityName: string;
  sectionDisplay: string;
  pct: number;
}

function findHottestSection(cards: FacilityCardData[]): HotSection | null {
  let best: HotSection | null = null;
  for (const card of cards) {
    if (!card.occupancy) continue;
    const facility = getFacility(card.slug);
    const sections = summarizeSections(card.occupancy);
    for (const section of sections) {
      if (section.total < 4) continue;
      if (!best || section.pct > best.pct) {
        best = {
          facilityName: facility.name,
          sectionDisplay: formatSectionLabel(section.label, facility.sectionLabel),
          pct: section.pct,
        };
      }
    }
  }
  if (!best || best.pct < 70) return null;
  return best;
}

interface Imbalance {
  facilityName: string;
  heavyLabel: string;
  lightLabel: string;
  lightPct: number;
}

function findImbalance(cards: FacilityCardData[]): Imbalance | null {
  for (const card of cards) {
    if (!card.occupancy) continue;
    const facility = getFacility(card.slug);
    const sections = summarizeSections(card.occupancy);
    if (sections.length < 2) continue;
    const sorted = [...sections].sort((a, b) => b.pct - a.pct);
    const heavy = sorted[0];
    const light = sorted[sorted.length - 1];
    if (heavy.pct - light.pct >= 25 && heavy.total >= 4 && light.total >= 4) {
      return {
        facilityName: facility.name,
        heavyLabel: formatSectionLabel(heavy.label, facility.sectionLabel),
        lightLabel: formatSectionLabel(light.label, facility.sectionLabel),
        lightPct: light.pct,
      };
    }
  }
  return null;
}

function buildActivityFeed(
  cards: FacilityCardData[],
  socketStatus: BrightonWebSocketStatus,
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const brighton = cards.find((c) => c.slug === BRIGHTON_FACILITY_SLUG);
  const osu = cards.find((c) => c.slug === OSU_FACILITY_SLUG);

  if (brighton?.lastUpdated) {
    events.push({
      id: "brighton-snapshot",
      source: "live",
      whenLabel: formatTime(brighton.lastUpdated),
      title: `Brighton Zone 1 snapshot received (${SOCKET_COPY[socketStatus]})`,
      body: brighton.occupancy
        ? `${brighton.occupancy.available} available · ${brighton.occupancy.occupied} occupied across all zones.`
        : "Snapshot processed.",
    });
  }

  if (osu?.lastUpdated && osu.occupancy) {
    events.push({
      id: "osu-occupancy",
      source: "live",
      whenLabel: formatTime(osu.lastUpdated),
      title: `OSU Parking Structure 1 reporting at ${Math.round(
        osu.occupancy.occupancy_pct,
      )}% occupancy`,
      body: `${osu.occupancy.available} stalls open · ${osu.occupancy.occupied} taken.`,
    });
  }

  // Three stable mock events to round out the feed even when the rest of the
  // platform is offline.
  events.push(
    {
      id: "mock-yolo",
      source: "mock",
      whenLabel: "Earlier today",
      title: "Brighton Zone 1 calibration verified",
      body: "All 41 mapped stalls returned high-confidence detections during the morning warm-up loop.",
    },
    {
      id: "mock-imbalance",
      source: "mock",
      whenLabel: "Earlier today",
      title: "OSU Level 2 demand window opened",
      body: "Routine peak window started — expect ~85% utilization for the next 45 minutes.",
    },
    {
      id: "mock-uptime",
      source: "mock",
      whenLabel: "Yesterday",
      title: "Camera /ws connection re-established",
      body: "Brief blip in the YOLO WebSocket recovered automatically without operator intervention.",
    },
  );

  return events;
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

function saturationFromPct(openPct: number): "ok" | "watch" | "tight" {
  if (openPct >= 50) return "ok";
  if (openPct >= 25) return "watch";
  return "tight";
}

function predictFullTimeFromPct(pct?: number): string {
  if (typeof pct !== "number" || pct <= 0) return "—";
  if (pct >= 92) return "Currently full";
  if (pct >= 80) return "Within 20 min";
  if (pct >= 65) return "Within 1 hour";
  return "Not in next 2 hours";
}
