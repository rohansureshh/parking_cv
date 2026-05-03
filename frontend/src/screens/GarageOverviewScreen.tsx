import { useMemo, useState } from "react";

import { DEMO_FALLBACK, useOccupancy } from "../lib/occupancyCache";
import { OSU_FACILITY_SLUG } from "../lib/facilities";
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
  const { occupancy, ready } = useOccupancy(OSU_FACILITY_SLUG);
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
            <BrandPin />
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

/* SwiftPark teardrop pin — matches the splash brand mark exactly so
   the mini brand pill in the header stays visually cohesive across
   Splash, Overview, and Parked. */
function BrandPin() {
  return (
    <svg
      className="overview__brand-pin-svg"
      viewBox="0 0 48 56"
      aria-hidden="true"
    >
      <path
        d="M 24 0 C 14 0 6 8 6 18 c 0 13.5 18 38 18 38 s 18 -24.5 18 -38 C 42 8 34 0 24 0 z"
        fill="#2563eb"
      />
      <circle cx="24" cy="18" r="11" fill="white" />
      <text
        x="24"
        y="22.6"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        fontWeight="900"
        fontSize="13.5"
        fill="#2563eb"
      >
        P
      </text>
    </svg>
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
        {/* Calmer sky — light cool gradient, mostly white with a subtle
            tint. Heavy navy is gone; brand blue is now a small accent. */}
        <linearGradient id="ov-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dde4ee" />
          <stop offset="55%" stopColor="#eef2f8" />
          <stop offset="100%" stopColor="#f6f8fc" />
        </linearGradient>
        <linearGradient id="ov-building" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbfcfe" />
          <stop offset="100%" stopColor="#c9d1de" />
        </linearGradient>
        <linearGradient id="ov-building-front" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(15,23,42,0.10)" />
        </linearGradient>
        <linearGradient id="ov-overlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="black" stopOpacity="0" />
          <stop offset="55%" stopColor="black" stopOpacity="0.20" />
          <stop offset="100%" stopColor="black" stopOpacity="0.62" />
        </linearGradient>
        {/* Roof band — slate, not navy. Single small brand-blue stripe is
            handled separately below the roof. */}
        <linearGradient id="ov-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="ov-entrance" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="100%" stopColor="rgba(96,165,250,0.28)" />
        </linearGradient>
        <radialGradient id="ov-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="240" fill="url(#ov-sky)" />

      {/* Sun — quiet warm halo, not a chunky white disk. */}
      <circle cx="332" cy="46" r="56" fill="url(#ov-sun)" />

      {/* Wispy clouds — softer, lower contrast against the lighter sky. */}
      <g fill="white" opacity="0.95">
        <ellipse cx="78" cy="44" rx="26" ry="5.5" />
        <ellipse cx="100" cy="40" rx="14" ry="4" />
      </g>
      <g fill="white" opacity="0.7">
        <ellipse cx="244" cy="70" rx="22" ry="4.5" />
        <ellipse cx="262" cy="66" rx="12" ry="3.5" />
        <ellipse cx="32" cy="86" rx="14" ry="3" />
      </g>

      {/* Far skyline — neutral cool gray instead of saturated light blue,
          so the eye lands on the building rather than the backdrop. */}
      <g fill="#cdd5e0" opacity="0.55">
        <rect x="6" y="128" width="22" height="44" />
        <rect x="32" y="118" width="14" height="54" />
        <rect x="50" y="124" width="18" height="48" />
        <rect x="72" y="112" width="22" height="60" />
        <path d="M 100 172 L 100 100 L 108 90 L 116 100 L 116 172 Z" />
        <rect x="120" y="126" width="14" height="46" />
        <rect x="266" y="124" width="18" height="48" />
        <rect x="290" y="118" width="20" height="54" />
        <path d="M 314 172 L 314 108 L 322 100 L 330 108 L 330 172 Z" />
        <rect x="340" y="124" width="20" height="48" />
        <rect x="364" y="118" width="22" height="54" />
      </g>

      {/* Subtle warm horizon wash — softens where sky meets ground. */}
      <rect
        x="0"
        y="160"
        width="400"
        height="22"
        fill="url(#ov-sun)"
        opacity="0.5"
      />

      {/* Trees — slightly desaturated so they recede behind the building. */}
      <g>
        <ellipse cx="64" cy="186" rx="13" ry="11" fill="#a8d5b3" opacity="0.92" />
        <ellipse cx="60" cy="194" rx="10" ry="8" fill="#a8d5b3" opacity="0.88" />
        <rect x="62.5" y="186" width="3" height="16" fill="#7ba262" />
        <ellipse cx="346" cy="184" rx="12" ry="10" fill="#a8d5b3" opacity="0.92" />
        <ellipse cx="350" cy="192" rx="9" ry="7" fill="#a8d5b3" opacity="0.88" />
        <rect x="344.5" y="184" width="3" height="16" fill="#7ba262" />
      </g>

      {/* Parking structure */}
      <g transform="translate(108, 78)">
        {/* Roof band — slate gray, not heavy navy */}
        <rect x="-4" y="-6" width="192" height="10" rx="1.5" fill="url(#ov-roof)" />
        <rect x="-4" y="-6" width="192" height="2" fill="white" opacity="0.30" />
        {/* Brand-blue accent stripe just below the roof — small, on-brand */}
        <rect x="-4" y="4" width="192" height="1.6" fill="#2563eb" opacity="0.85" />

        {/* Building shell */}
        <rect width="184" height="124" fill="url(#ov-building)" rx="2" />
        {/* Front-facade lighting wash — left highlight, right shadow */}
        <rect width="184" height="124" fill="url(#ov-building-front)" rx="2" />

        {/* Each floor: a softer interior strip + cool car silhouettes.
            Strips lighter than before so the building doesn't read as a
            slab of black. */}
        {/* Floor 4 */}
        <rect x="6" y="6" width="172" height="14" fill="#1e293b" opacity="0.42" />
        <g fill="#cbd5e1">
          <rect x="14" y="9" width="14" height="8" rx="1.5" />
          <rect x="34" y="9" width="14" height="8" rx="1.5" />
          <rect x="74" y="9" width="14" height="8" rx="1.5" />
        </g>
        <g fill="#93c5fd">
          <rect x="54" y="9" width="14" height="8" rx="1.5" />
          <rect x="114" y="9" width="14" height="8" rx="1.5" />
        </g>
        <g fill="#475569">
          <rect x="94" y="9" width="14" height="8" rx="1.5" />
          <rect x="148" y="9" width="14" height="8" rx="1.5" />
        </g>
        <rect x="0" y="22" width="184" height="2.5" fill="#94a3b8" />
        <rect x="0" y="22" width="184" height="0.6" fill="white" opacity="0.4" />

        {/* Floor 3 */}
        <rect x="6" y="29" width="172" height="14" fill="#1e293b" opacity="0.42" />
        <g fill="#cbd5e1">
          <rect x="18" y="32" width="14" height="8" rx="1.5" />
          <rect x="84" y="32" width="14" height="8" rx="1.5" />
        </g>
        <g fill="#93c5fd">
          <rect x="50" y="32" width="14" height="8" rx="1.5" />
          <rect x="118" y="32" width="14" height="8" rx="1.5" />
        </g>
        <g fill="#475569">
          <rect x="148" y="32" width="14" height="8" rx="1.5" />
        </g>
        <rect x="0" y="45" width="184" height="2.5" fill="#94a3b8" />
        <rect x="0" y="45" width="184" height="0.6" fill="white" opacity="0.4" />

        {/* Floor 2 */}
        <rect x="6" y="52" width="172" height="14" fill="#1e293b" opacity="0.42" />
        <g fill="#93c5fd">
          <rect x="14" y="55" width="14" height="8" rx="1.5" />
          <rect x="78" y="55" width="14" height="8" rx="1.5" />
        </g>
        <g fill="#cbd5e1">
          <rect x="44" y="55" width="14" height="8" rx="1.5" />
          <rect x="116" y="55" width="14" height="8" rx="1.5" />
          <rect x="148" y="55" width="14" height="8" rx="1.5" />
        </g>
        <rect x="0" y="68" width="184" height="2.5" fill="#94a3b8" />
        <rect x="0" y="68" width="184" height="0.6" fill="white" opacity="0.4" />

        {/* Ground floor — soft cool entrance glow */}
        <rect x="6" y="75" width="172" height="44" fill="#1e293b" opacity="0.40" />
        <rect
          x="68"
          y="90"
          width="48"
          height="29"
          rx="3"
          fill="url(#ov-entrance)"
        />
        <rect x="68" y="90" width="48" height="2.4" fill="white" opacity="0.6" />

        {/* Smaller, subtler "SWIFTPARK" sign band over entrance — uses
            brand blue but at a contained size so it accents rather than
            dominates. */}
        <rect x="62" y="78" width="60" height="8" rx="1.5" fill="#2563eb" />
        <text
          x="92"
          y="83.6"
          textAnchor="middle"
          fontSize="5.5"
          fontWeight="900"
          letterSpacing="0.18em"
          fill="white"
          fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        >
          SWIFTPARK
        </text>

        {/* Side columns with subtle inner highlight */}
        <rect x="0" y="0" width="2" height="124" fill="white" opacity="0.6" />
        <rect x="182" y="0" width="2" height="124" fill="white" opacity="0.6" />
        <rect x="2" y="0" width="0.8" height="124" fill="white" opacity="0.20" />
        <rect x="181.2" y="0" width="0.8" height="124" fill="white" opacity="0.20" />
      </g>

      {/* SwiftPark teardrop pin perched on the roof — primary brand-blue
          accent of the whole hero. */}
      <g transform="translate(200, 50)">
        <path
          d="M 0 0 C -11 0 -20 9 -20 20 c 0 14.5 20 34 20 34 s 20 -19.5 20 -34 C 20 9 11 0 0 0 Z"
          fill="#2563eb"
        />
        <circle cx="0" cy="20" r="10" fill="white" />
        <text
          x="0"
          y="24.4"
          textAnchor="middle"
          fontSize="13"
          fontWeight="900"
          fill="#2563eb"
          fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        >
          P
        </text>
      </g>

      {/* Ground line + soft cast shadow under the structure */}
      <ellipse cx="200" cy="206" rx="120" ry="4" fill="#0f172a" opacity="0.16" />
      <rect x="0" y="200" width="400" height="40" fill="#475569" opacity="0.14" />
      <rect x="0" y="202" width="400" height="2" fill="#334155" opacity="0.20" />

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
