import { useMemo, useState } from "react";

import { DEMO_FALLBACK, useOccupancy } from "../lib/occupancyCache";
import type { FacilityStatus } from "../lib/types";

interface GarageOverviewScreenProps {
  onBack: () => void;
  onViewSpotMap: () => void;
  onNavigate: () => void;
}

interface LevelInfo {
  level: string;
  available: number;
  total: number;
}

const STATUS_COPY: Record<FacilityStatus, string> = {
  open: "Available",
  busy: "Busy",
  nearly_full: "Nearly full",
};

/* Demo defaults shown when /demo/occupancy is unreachable so the screen
   always renders something complete during a pitch. Anything backend-
   provided wins on render. The garage name and address come from the
   shared DEMO_FALLBACK so no two screens disagree on placeholder copy. */
const FALLBACK = {
  name: DEMO_FALLBACK.garageName,
  address: DEMO_FALLBACK.garageAddress,
  available: 42,
  capacity: 120,
  pricePerHour: 8,
  rating: 4.6,
  facilityStatus: "open" as FacilityStatus,
  levels: [
    { level: "1", available: 0, total: 40 },
    { level: "2", available: 18, total: 40 },
    { level: "3", available: 24, total: 40 },
  ] satisfies LevelInfo[],
};

/**
 * Garage Overview screen.
 *
 * Composition (top → bottom):
 *   1. Hero — stylized parking-garage illustration that fills the top ~240px
 *      of the screen. Floating header pills (back · SwiftPark mark · heart).
 *      Title + address + status badge overlaid on a darkened bottom gradient.
 *   2. Stats card — three-cell summary (Available · Per hour · Rating),
 *      pulled up so it overlaps the hero edge for that lifted-card feel.
 *   3. Live indicator — pulsing green dot + "Live · AI cameras updated…".
 *   4. Feature chips — AI Detection · 24/7 Open · EV Ready.
 *   5. By Level card — one row per floor: badge, name + count, progress bar.
 *      Status colors come from the per-floor availability ratio.
 *   6. Actions — primary "View Spot Map" + secondary "Navigate".
 */
export function GarageOverviewScreen({
  onBack,
  onViewSpotMap,
  onNavigate,
}: GarageOverviewScreenProps) {
  const { occupancy, ready } = useOccupancy();
  const [favorited, setFavorited] = useState(false);

  const garageName = occupancy?.lot_name ?? FALLBACK.name;
  const garageAddress = occupancy?.location ?? FALLBACK.address;
  const available = occupancy?.available ?? FALLBACK.available;
  const capacity = occupancy?.capacity ?? FALLBACK.capacity;
  const facilityStatus = occupancy?.facility_status ?? FALLBACK.facilityStatus;

  const levels: LevelInfo[] = useMemo(() => {
    if (!occupancy || occupancy.spots.length === 0) return FALLBACK.levels;
    const acc = new Map<string, { available: number; total: number }>();
    for (const spot of occupancy.spots) {
      const cur = acc.get(spot.level) ?? { available: 0, total: 0 };
      cur.total += 1;
      if (spot.status === "available") cur.available += 1;
      acc.set(spot.level, cur);
    }
    return Array.from(acc.entries())
      .map(([level, c]) => ({ level, ...c }))
      .sort((a, b) =>
        a.level.localeCompare(b.level, undefined, { numeric: true }),
      );
  }, [occupancy]);

  return (
    <div className="overview">
      <header className="overview__hero">
        <GarageHeroIllustration />

        <div className="overview__hero-bar">
          <button
            type="button"
            className="overview__icon-btn"
            onClick={onBack}
            aria-label="Back to map"
          >
            <ArrowLeftIcon />
          </button>
          <div className="overview__brand-pill" aria-hidden="true">
            <span className="overview__brand-pin">P</span>
            <span className="overview__brand-name">
              <span className="swift">Swift</span>
              <span className="park">Park</span>
            </span>
          </div>
          <button
            type="button"
            className="overview__icon-btn"
            onClick={() => setFavorited((f) => !f)}
            aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
            aria-pressed={favorited}
            data-active={favorited ? "true" : "false"}
          >
            <HeartIcon filled={favorited} />
          </button>
        </div>

        <div className="overview__hero-info">
          <div className="overview__hero-row">
            <h1 className="overview__title">
              {ready ? (
                garageName
              ) : (
                <span
                  className="demo-skel"
                  style={{ width: 200, height: "0.85em" }}
                  aria-hidden="true"
                />
              )}
            </h1>
            {ready && (
              <span className="overview__status" data-status={facilityStatus}>
                <span className="overview__status-dot" aria-hidden="true" />
                {STATUS_COPY[facilityStatus]}
              </span>
            )}
          </div>
          <div className="overview__address">
            <PinIcon />
            <span>
              {ready ? (
                garageAddress
              ) : (
                <span
                  className="demo-skel"
                  style={{ width: 180 }}
                  aria-hidden="true"
                />
              )}
            </span>
          </div>
        </div>
      </header>

      <main className="overview__body">
        <div className="overview__stats">
          <Stat
            tone="blue"
            icon={<CarIcon />}
            value={
              ready ? (
                String(available)
              ) : (
                <span
                  className="demo-skel demo-skel--ink"
                  style={{ width: 36, height: "0.85em" }}
                  aria-hidden="true"
                />
              )
            }
            label="Available"
          />
          <Stat
            tone="slate"
            icon={<ClockIcon />}
            value={`$${FALLBACK.pricePerHour}`}
            label="Per hour"
          />
          <Stat
            tone="amber"
            icon={<StarIcon />}
            value={String(FALLBACK.rating)}
            label="Rating"
          />
        </div>

        <div className="overview__live">
          <span className="overview__live-dot" aria-hidden="true" />
          <span>Live · AI cameras updated just now</span>
        </div>

        <div className="overview__features">
          <FeatureChip icon={<CameraIcon />} label="AI Detection" />
          <FeatureChip icon={<MoonIcon />} label="24/7 Open" />
          <FeatureChip icon={<BoltIcon />} label="EV Ready" />
        </div>

        <section className="overview__levels-card">
          <div className="overview__section-head">
            <LayersIcon />
            <h2 className="overview__section-title">By Level</h2>
            <span className="overview__section-meta">
              {ready ? (
                <>
                  {available} of {capacity} open
                </>
              ) : (
                <span
                  className="demo-skel demo-skel--ink"
                  style={{ width: 70 }}
                  aria-hidden="true"
                />
              )}
            </span>
          </div>
          <div className="overview__levels">
            {levels.map((l) => (
              <LevelRow key={l.level} {...l} />
            ))}
          </div>
        </section>

        <div className="overview__actions">
          <button
            type="button"
            className="overview__cta overview__cta--primary"
            onClick={onViewSpotMap}
          >
            <CarIcon />
            View Spot Map
          </button>
          <button
            type="button"
            className="overview__cta overview__cta--secondary"
            onClick={onNavigate}
          >
            <NavigateIcon />
            Navigate
          </button>
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Subcomponents
   ───────────────────────────────────────────────────────────────── */

interface StatProps {
  tone: "blue" | "slate" | "amber";
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}

function Stat({ tone, icon, value, label }: StatProps) {
  return (
    <div className="overview__stat">
      <div className={`overview__stat-icon overview__stat-icon--${tone}`}>
        {icon}
      </div>
      <div className="overview__stat-num">{value}</div>
      <div className="overview__stat-label">{label}</div>
    </div>
  );
}

function FeatureChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="overview__chip">
      {icon}
      {label}
    </span>
  );
}

function LevelRow({ level, available, total }: LevelInfo) {
  const pct = total > 0 ? (available / total) * 100 : 0;
  const isFull = available === 0;
  const isLimited = !isFull && pct <= 30;
  const status: "ok" | "limited" | "full" = isFull
    ? "full"
    : isLimited
      ? "limited"
      : "ok";

  return (
    <div className="overview__level" data-status={status}>
      <div className="overview__level-badge">L{level}</div>
      <div className="overview__level-info">
        <div className="overview__level-name">Level {level}</div>
        <div className="overview__level-status">
          {isFull ? "Full" : `${available} of ${total} available`}
        </div>
      </div>
      <div className="overview__level-bar" aria-hidden="true">
        <div
          className="overview__level-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Hero illustration — stylized SwiftPark parking structure
   ───────────────────────────────────────────────────────────────── */

function GarageHeroIllustration() {
  return (
    <svg
      className="overview__hero-svg"
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ov-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e40af" />
          <stop offset="55%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
        <linearGradient id="ov-building" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="ov-overlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="black" stopOpacity="0" />
          <stop offset="55%" stopColor="black" stopOpacity="0.18" />
          <stop offset="100%" stopColor="black" stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id="ov-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>

      <rect width="400" height="240" fill="url(#ov-sky)" />

      {/* Sun glow */}
      <circle cx="332" cy="38" r="32" fill="white" opacity="0.16" />
      <circle cx="332" cy="38" r="20" fill="white" opacity="0.22" />

      {/* Clouds */}
      <g fill="white" opacity="0.7">
        <ellipse cx="78" cy="44" rx="22" ry="6" />
        <ellipse cx="98" cy="40" rx="14" ry="4.5" />
        <ellipse cx="244" cy="68" rx="18" ry="5" />
        <ellipse cx="258" cy="66" rx="11" ry="3.5" />
      </g>

      {/* Distant skyline */}
      <g fill="#bfdbfe" opacity="0.6">
        <rect x="14" y="124" width="22" height="40" />
        <rect x="40" y="106" width="14" height="58" />
        <rect x="58" y="118" width="20" height="46" />
        <path d="M 82 164 L 82 102 L 96 90 L 96 164 Z" />
        <rect x="320" y="118" width="20" height="46" />
        <rect x="344" y="108" width="18" height="56" />
        <path d="M 366 164 L 366 110 L 376 100 L 386 110 L 386 164 Z" />
      </g>

      {/* Trees */}
      <g>
        <ellipse cx="64" cy="186" rx="14" ry="12" fill="#86efac" opacity="0.85" />
        <rect x="62.5" y="186" width="3" height="14" fill="#65a30d" />
        <ellipse cx="346" cy="184" rx="13" ry="11" fill="#86efac" opacity="0.85" />
        <rect x="344.5" y="184" width="3" height="14" fill="#65a30d" />
      </g>

      {/* Parking structure */}
      <g transform="translate(108, 78)">
        {/* Roof band */}
        <rect x="-4" y="-6" width="192" height="10" rx="1.5" fill="url(#ov-roof)" />
        {/* Building shell */}
        <rect width="184" height="124" fill="url(#ov-building)" rx="2" />

        {/* Floor 4 */}
        <rect x="6" y="6" width="172" height="14" fill="#0f172a" opacity="0.55" />
        <g fill="#bfdbfe">
          <rect x="14" y="9" width="14" height="8" rx="1" />
          <rect x="32" y="9" width="14" height="8" rx="1" />
        </g>
        <g fill="#fca5a5">
          <rect x="62" y="9" width="14" height="8" rx="1" />
        </g>
        <g fill="#cbd5e1">
          <rect x="94" y="9" width="14" height="8" rx="1" />
          <rect x="112" y="9" width="14" height="8" rx="1" />
          <rect x="148" y="9" width="14" height="8" rx="1" />
        </g>
        <rect x="0" y="22" width="184" height="2.5" fill="#94a3b8" />

        {/* Floor 3 */}
        <rect x="6" y="29" width="172" height="14" fill="#0f172a" opacity="0.55" />
        <g fill="#cbd5e1">
          <rect x="18" y="32" width="14" height="8" rx="1" />
        </g>
        <g fill="#bfdbfe">
          <rect x="50" y="32" width="14" height="8" rx="1" />
          <rect x="84" y="32" width="14" height="8" rx="1" />
        </g>
        <g fill="#cbd5e1">
          <rect x="118" y="32" width="14" height="8" rx="1" />
          <rect x="148" y="32" width="14" height="8" rx="1" />
        </g>
        <rect x="0" y="45" width="184" height="2.5" fill="#94a3b8" />

        {/* Floor 2 */}
        <rect x="6" y="52" width="172" height="14" fill="#0f172a" opacity="0.55" />
        <g fill="#bfdbfe">
          <rect x="14" y="55" width="14" height="8" rx="1" />
          <rect x="44" y="55" width="14" height="8" rx="1" />
        </g>
        <g fill="#cbd5e1">
          <rect x="78" y="55" width="14" height="8" rx="1" />
          <rect x="116" y="55" width="14" height="8" rx="1" />
          <rect x="148" y="55" width="14" height="8" rx="1" />
        </g>
        <rect x="0" y="68" width="184" height="2.5" fill="#94a3b8" />

        {/* Ground floor with entrance + P sign glow */}
        <rect x="6" y="75" width="172" height="44" fill="#0f172a" opacity="0.5" />
        {/* Entrance opening */}
        <rect x="68" y="92" width="48" height="27" rx="2" fill="#fbbf24" />
        <rect x="68" y="92" width="48" height="27" rx="2" fill="white" opacity="0.35" />
        {/* P sign over entrance */}
        <circle cx="92" cy="86" r="8" fill="white" />
        <circle cx="92" cy="86" r="6" fill="#2563eb" />
        <text
          x="92"
          y="89.6"
          textAnchor="middle"
          fontSize="8"
          fontWeight="900"
          fill="white"
          fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        >
          P
        </text>
        {/* Side columns (vertical white edges) */}
        <rect x="0" y="0" width="2" height="124" fill="white" opacity="0.55" />
        <rect x="182" y="0" width="2" height="124" fill="white" opacity="0.55" />
      </g>

      {/* Big SwiftPark P pin perched on the building's roof */}
      <g transform="translate(200, 56)">
        <path
          d="M 0 0 C -10 0 -18 8 -18 18 c 0 13 18 30 18 30 s 18 -17 18 -30 C 18 8 10 0 0 0 Z"
          fill="#2563eb"
        />
        <circle cx="0" cy="18" r="9" fill="white" />
        <text
          x="0"
          y="22"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fill="#2563eb"
          fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        >
          P
        </text>
      </g>

      {/* Ground line */}
      <rect x="0" y="200" width="400" height="40" fill="#475569" opacity="0.18" />
      <rect x="0" y="202" width="400" height="2" fill="#334155" opacity="0.25" />

      {/* Dark gradient overlay for text readability */}
      <rect width="400" height="240" fill="url(#ov-overlay)" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Inline icons
   ───────────────────────────────────────────────────────────────── */

function ArrowLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      aria-hidden="true"
    >
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 22s7-7.16 7-12a7 7 0 1 0-14 0c0 4.84 7 12 7 12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13M5 13h14M5 13v5h2v-2h10v2h2v-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="16" r="1.2" fill="currentColor" />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l3.09 6.26 6.91 1.01-5 4.87 1.18 6.86L12 18.27l-6.18 3.23L7 14.64l-5-4.87 6.91-1.01L12 2.5z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7h4l2-3h6l2 3h4v12H3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2l10 5-10 5L2 7l10-5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M2 12l10 5 10-5M2 17l10 5 10-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavigateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 11l18-8-8 18-2-8-8-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
