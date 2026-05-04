import { DEMO_FALLBACK, useOccupancy } from "../lib/occupancyCache";
import {
  BRIGHTON_FACILITY_SLUG,
  getFacility,
  OSU_FACILITY_SLUG,
  type FacilitySlug,
} from "../lib/facilities";
import type { FacilityStatus } from "../lib/types";

interface HomeScreenProps {
  onSelectGarage: (facilitySlug: FacilitySlug) => void;
}

type MarkerStatus = "available" | "busy" | "full";

interface MockMarker {
  id: string;
  status: MarkerStatus;
  count: number;
  top: string;
  left: string;
}

/**
 * Home / Map screen.
 *
 * Layout (full-bleed inside the phone shell):
 *   - Fake CSS+SVG map fills the whole screen.
 *   - Floating top bar (hamburger + search + filter) overlays at the top.
 *   - Three SwiftPark teardrop pins anchored at percentage positions on the
 *     map, with a fourth "you are here" blue dot + pulse.
 *   - Locate-me circular FAB above the card.
 *   - Single primary garage card pinned above the bottom tab bar.
 *   - Bottom tab bar (Map / Bookings / Activity / Profile) on iOS-style.
 *
 * Live data: tries to read /demo/occupancy from FastAPI on mount and use the
 * available count + lot name in the primary blue marker and the card. Falls
 * back to demo defaults if the backend is unreachable so the screen always
 * looks complete.
 */
export function HomeScreen({ onSelectGarage }: HomeScreenProps) {
  const { occupancy, ready } = useOccupancy(OSU_FACILITY_SLUG);
  const { occupancy: brightonOccupancy, ready: brightonReady } =
    useOccupancy(BRIGHTON_FACILITY_SLUG);

  const liveAvailable = occupancy?.available ?? 42;
  const liveCapacity = occupancy?.capacity ?? 120;
  const garageName = occupancy?.lot_name ?? DEMO_FALLBACK.garageName;
  const garageAddress = occupancy?.location ?? DEMO_FALLBACK.garageAddress;
  const brightonFacility = getFacility(BRIGHTON_FACILITY_SLUG);
  const brightonAvailable = brightonOccupancy?.available ?? 81;
  const brightonCapacity = brightonOccupancy?.capacity ?? 180;
  const brightonStatus = brightonOccupancy?.facility_status ?? "open";

  // Hard-coded busy / full pins always render. The primary blue pin is
  // gated on `ready` so its count never flashes from a fallback to the
  // real value during the initial fetch.
  const markers: MockMarker[] = [
    { id: "busy", status: "busy", count: 12, top: "26%", left: "22%" },
    { id: "full", status: "full", count: 2, top: "23%", left: "73%" },
    ...(ready
      ? [
          {
            id: "primary",
            status: "available" as MarkerStatus,
            count: liveAvailable,
            top: "50%",
            left: "32%",
          },
        ]
      : []),
    {
      id: "brighton",
      status: toMarkerStatus(brightonStatus),
      count: brightonAvailable,
      top: "39%",
      left: "58%",
    },
  ];

  return (
    <div className="home">
      <FakeMap />

      <div className="home__markers" aria-hidden="true">
        {markers.map((m) => (
          <PinMarker key={m.id} {...m} />
        ))}
        <UserDot top="48%" left="64%" />
      </div>

      <div className="home__topbar">
        <button type="button" className="home__icon-btn" aria-label="Open menu">
          <HamburgerIcon />
        </button>
        <label className="home__search">
          <SearchIcon />
          <input
            className="home__search-input"
            placeholder="Where are you going?"
            aria-label="Search destinations"
            readOnly
          />
        </label>
        <button type="button" className="home__icon-btn" aria-label="Open filters">
          <FilterIcon />
        </button>
      </div>

      <button
        type="button"
        className="home__locate"
        aria-label="Center on your location"
      >
        <LocateIcon />
      </button>

      <article className="home__card home__card--osu">
        {/* Header — title / meta / rating in the left column, thumbnail
            on the right. Moving the rating INTO this column (instead of
            below it) eliminates the awkward empty band that used to sit
            between the meta line and the rating row. The thumbnail is
            sized so both columns end at roughly the same vertical
            position, giving the card a balanced, fluid composition. */}
        <div className="home__card-header">
          <div className="home__card-info">
            <h3 className="home__card-title">
              {ready ? (
                garageName
              ) : (
                <span
                  className="demo-skel demo-skel--ink"
                  style={{ width: 170 }}
                  aria-hidden="true"
                />
              )}
            </h3>
            <div className="home__card-meta">
              <span>0.2 mi away</span>
              <span className="home__card-meta-dot" aria-hidden="true">·</span>
              <span>2 min walk</span>
            </div>
            <div className="home__card-rating">
              <StarIcon />
              <span className="home__card-rating-num">4.6</span>
              <span className="home__card-rating-dot" aria-hidden="true">·</span>
              <span className="home__card-rating-count">362 reviews</span>
            </div>
          </div>
          <GarageThumb />
        </div>

        <div className="home__card-divider" aria-hidden="true" />

        {/* Live availability — own row, gets to dominate. */}
        <div className="home__card-live">
          <div className="home__card-live-counts">
            {ready ? (
              <>
                <span className="home__card-spot-count">{liveAvailable}</span>
                <span className="home__card-spot-of">of {liveCapacity}</span>
              </>
            ) : (
              <span
                className="demo-skel demo-skel--ink"
                style={{ width: 76, height: "1em" }}
                aria-hidden="true"
              />
            )}
          </div>
          <span className="home__card-spot-label">spots available</span>
        </div>

        <div className="home__card-address">
          {ready ? (
            garageAddress
          ) : (
            <span
              className="demo-skel demo-skel--ink"
              style={{ width: 200 }}
              aria-hidden="true"
            />
          )}
        </div>

        <button
          type="button"
          className="home__card-cta"
          onClick={() => onSelectGarage(OSU_FACILITY_SLUG)}
        >
          View Details
          <ChevronRightIcon />
        </button>
      </article>

      <article className="home__card home__card--brighton">
        <div className="home__card-header">
          <div className="home__card-info">
            <div className="home__card-eyebrow">Mountain surface lot</div>
            <h3 className="home__card-title">
              {brightonReady ? (
                brightonFacility.name
              ) : (
                <span
                  className="demo-skel demo-skel--ink"
                  style={{ width: 170 }}
                  aria-hidden="true"
                />
              )}
            </h3>
            <div className="home__card-meta">
              <span>Surface lot</span>
              <span className="home__card-meta-dot" aria-hidden="true">-</span>
              <span>3 zones</span>
            </div>
            <div className="home__card-rating">
              <CameraMiniIcon />
              <span className="home__card-rating-num">Zone 1 live camera</span>
            </div>
          </div>
          <SurfaceLotThumb />
        </div>

        <div className="home__card-live home__card-live--compact">
          <div className="home__card-live-counts">
            {brightonReady ? (
              <>
                <span className="home__card-spot-count">{brightonAvailable}</span>
                <span className="home__card-spot-of">of {brightonCapacity}</span>
              </>
            ) : (
              <span
                className="demo-skel demo-skel--ink"
                style={{ width: 76, height: "1em" }}
                aria-hidden="true"
              />
            )}
          </div>
          <span className="home__card-spot-label">spots available</span>
        </div>

        <div className="home__card-features">
          <span className="home__card-feature">Zones 2-3 estimated</span>
          <span className="home__card-feature">Surface lot</span>
        </div>

        <button
          type="button"
          className="home__card-cta"
          onClick={() => onSelectGarage(BRIGHTON_FACILITY_SLUG)}
        >
          View Details
          <ChevronRightIcon />
        </button>
      </article>

      <nav className="home__tabbar" aria-label="Primary">
        <TabButton label="Map" active>
          <MapTabIcon />
        </TabButton>
        <TabButton label="Saved">
          <SavedIcon />
        </TabButton>
        <TabButton label="Activity">
          <ActivityIcon />
        </TabButton>
        <TabButton label="Profile">
          <span className="home__tab-avatar">JD</span>
        </TabButton>
      </nav>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Fake map — light Apple/Google Maps look, CSS+SVG only.
   ───────────────────────────────────────────────────────────────── */

function toMarkerStatus(status: FacilityStatus): MarkerStatus {
  if (status === "nearly_full") return "full";
  if (status === "busy") return "busy";
  return "available";
}

function FakeMap() {
  return (
    <div className="home__map" aria-hidden="true">
      <svg
        className="home__map-svg"
        viewBox="0 0 400 720"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="home-map-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eef1f6" />
            <stop offset="100%" stopColor="#e6e9f0" />
          </linearGradient>
          <linearGradient id="home-map-water" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#bfdbfe" />
            <stop offset="100%" stopColor="#a5cdfa" />
          </linearGradient>
        </defs>

        {/* Land base */}
        <rect width="400" height="720" fill="url(#home-map-bg)" />

        {/* Block tints — subtle alternating shades so the grid doesn't read
            as a flat field. Slight color variation suggests denser city
            districts vs lighter residential blocks. */}
        <g opacity="0.55">
          <rect x="0" y="0" width="78" height="98" fill="#e3e7ee" />
          <rect x="78" y="0" width="122" height="98" fill="#dde2ec" />
          <rect x="200" y="0" width="112" height="98" fill="#e6eaf2" />

          <rect x="0" y="252" width="78" height="156" fill="#dfe4ed" />
          <rect x="200" y="252" width="112" height="156" fill="#e3e7ee" />

          <rect x="78" y="408" width="122" height="158" fill="#e1e6ee" />
          <rect x="200" y="408" width="112" height="158" fill="#dee3ec" />

          <rect x="0" y="566" width="78" height="154" fill="#e3e7ee" />
          <rect x="78" y="566" width="122" height="154" fill="#dde2ec" />
        </g>

        {/* Park / green areas — varied sizes and shapes */}
        <rect x="34" y="120" width="86" height="92" rx="4" fill="#d4ebde" opacity="0.92" />
        <rect x="252" y="498" width="100" height="80" rx="4" fill="#d4ebde" opacity="0.9" />
        <rect x="60" y="540" width="48" height="40" rx="3" fill="#d4ebde" opacity="0.78" />
        <rect x="216" y="280" width="38" height="50" rx="3" fill="#d4ebde" opacity="0.75" />

        {/* Tree cluster dots inside the largest park */}
        <g fill="#a3d9b6" opacity="0.7">
          <circle cx="56" cy="148" r="5" />
          <circle cx="76" cy="160" r="4" />
          <circle cx="96" cy="142" r="4" />
          <circle cx="62" cy="178" r="4" />
          <circle cx="92" cy="184" r="5" />
          <circle cx="110" cy="170" r="4" />
        </g>

        {/* Plaza / civic block — light tan on a downtown corner */}
        <rect x="218" y="118" width="60" height="58" rx="3" fill="#ece7da" opacity="0.7" />
        <circle cx="248" cy="147" r="6" fill="#bfd6c7" opacity="0.85" />

        {/* Water on the right edge — wavy coastline */}
        <path
          d="M 360 0
             C 372 80 350 140 380 200
             C 396 256 354 312 372 380
             C 392 460 358 540 388 620
             C 396 660 380 700 400 720
             L 400 0 Z"
          fill="url(#home-map-water)"
          opacity="0.85"
        />
        {/* Water highlight */}
        <path
          d="M 372 60 C 384 120 366 180 388 240"
          stroke="white"
          strokeWidth="0.8"
          opacity="0.4"
          fill="none"
        />

        {/* Major roads — horizontal */}
        <g stroke="white" strokeLinecap="butt">
          <line x1="0" y1="98" x2="360" y2="98" strokeWidth="13" />
          <line x1="0" y1="252" x2="360" y2="252" strokeWidth="13" />
          <line x1="0" y1="408" x2="360" y2="408" strokeWidth="13" />
          <line x1="0" y1="566" x2="360" y2="566" strokeWidth="13" />
        </g>

        {/* Major roads — vertical */}
        <g stroke="white" strokeLinecap="butt">
          <line x1="78" y1="0" x2="78" y2="720" strokeWidth="13" />
          <line x1="200" y1="0" x2="200" y2="720" strokeWidth="13" />
          <line x1="312" y1="0" x2="312" y2="720" strokeWidth="13" />
        </g>

        {/* Minor streets — thinner */}
        <g stroke="white" strokeLinecap="butt" strokeWidth="6">
          <line x1="0" y1="172" x2="360" y2="172" />
          <line x1="0" y1="328" x2="360" y2="328" />
          <line x1="0" y1="486" x2="360" y2="486" />
          <line x1="0" y1="640" x2="360" y2="640" />
          <line x1="140" y1="0" x2="140" y2="720" />
          <line x1="258" y1="0" x2="258" y2="720" />
        </g>

        {/* Diagonal "Broadway" — adds character to the otherwise rigid grid */}
        <path
          d="M 56 720 L 360 80"
          stroke="white"
          strokeWidth="13"
          strokeLinecap="butt"
        />
        {/* Center dash on Broadway — quiet "highway" cue */}
        <path
          d="M 56 720 L 360 80"
          stroke="#dee3ec"
          strokeWidth="0.7"
          strokeDasharray="6 8"
          fill="none"
          opacity="0.85"
        />
        {/* Center dashes on the two horizontal majors closest to the user */}
        <line
          x1="0"
          y1="252"
          x2="360"
          y2="252"
          stroke="#dee3ec"
          strokeWidth="0.7"
          strokeDasharray="6 8"
          opacity="0.85"
        />
        <line
          x1="0"
          y1="408"
          x2="360"
          y2="408"
          stroke="#dee3ec"
          strokeWidth="0.7"
          strokeDasharray="6 8"
          opacity="0.85"
        />

        {/* Subtle road outlines for depth */}
        <g stroke="#dee3ec" strokeWidth="0.6" fill="none" opacity="0.7">
          <line x1="0" y1="91.5" x2="360" y2="91.5" />
          <line x1="0" y1="104.5" x2="360" y2="104.5" />
          <line x1="0" y1="245.5" x2="360" y2="245.5" />
          <line x1="0" y1="258.5" x2="360" y2="258.5" />
          <line x1="0" y1="401.5" x2="360" y2="401.5" />
          <line x1="0" y1="414.5" x2="360" y2="414.5" />
          <line x1="0" y1="559.5" x2="360" y2="559.5" />
          <line x1="0" y1="572.5" x2="360" y2="572.5" />

          <line x1="71.5" y1="0" x2="71.5" y2="720" />
          <line x1="84.5" y1="0" x2="84.5" y2="720" />
          <line x1="193.5" y1="0" x2="193.5" y2="720" />
          <line x1="206.5" y1="0" x2="206.5" y2="720" />
          <line x1="305.5" y1="0" x2="305.5" y2="720" />
          <line x1="318.5" y1="0" x2="318.5" y2="720" />
        </g>

        {/* Faint district labels */}
        <g
          fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
          fontWeight="600"
          fill="#94a3b8"
        >
          <text x="180" y="180" fontSize="9" letterSpacing="0.04em">
            MIDTOWN
          </text>
          <text x="32" y="350" fontSize="8.5" letterSpacing="0.04em">
            MAIN ST
          </text>
          <text x="224" y="540" fontSize="8.5" letterSpacing="0.04em">
            RIVERSIDE PARK
          </text>
        </g>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Map markers + user dot
   ───────────────────────────────────────────────────────────────── */

interface PinMarkerProps {
  status: MarkerStatus;
  count: number;
  top: string;
  left: string;
}

function PinMarker({ status, count, top, left }: PinMarkerProps) {
  return (
    <div
      className="home__pin"
      data-status={status}
      style={{ top, left }}
    >
      <span className="home__pin-ring" />
      <svg className="home__pin-svg" viewBox="0 0 48 56" aria-hidden="true">
        <path
          d="M 24 0 C 14 0 6 8 6 18 c 0 13.5 18 38 18 38 s 18 -24.5 18 -38 C 42 8 34 0 24 0 Z"
          fill="currentColor"
        />
        <circle cx="24" cy="18" r="11" fill="white" />
        <text
          x="24"
          y="22.6"
          textAnchor="middle"
          fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
          fontWeight="900"
          fontSize="13"
          fill="currentColor"
        >
          {count}
        </text>
      </svg>
    </div>
  );
}

interface UserDotProps {
  top: string;
  left: string;
}

function UserDot({ top, left }: UserDotProps) {
  return (
    <div className="home__user" style={{ top, left }}>
      <span className="home__user-pulse" />
      <span className="home__user-dot" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Garage thumbnail — stylized blue parking-structure illustration
   ───────────────────────────────────────────────────────────────── */

function GarageThumb() {
  return (
    <div className="home__card-thumb" aria-hidden="true">
      <svg viewBox="0 0 96 96" className="home__card-thumb-svg">
        <defs>
          <linearGradient id="thumb-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#93c5fd" />
          </linearGradient>
          <linearGradient id="thumb-building" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>

        <rect width="96" height="96" rx="14" fill="url(#thumb-bg)" />

        {/* Distant skyline silhouette */}
        <g fill="white" opacity="0.32">
          <rect x="4" y="44" width="10" height="36" />
          <rect x="16" y="38" width="8" height="42" />
          <rect x="78" y="40" width="14" height="40" />
        </g>

        {/* Parking structure building */}
        <g transform="translate(20, 28)">
          <rect width="56" height="52" rx="2" fill="url(#thumb-building)" />
          {/* Floor lines */}
          <line x1="0" y1="14" x2="56" y2="14" stroke="#cbd5e1" strokeWidth="0.8" />
          <line x1="0" y1="28" x2="56" y2="28" stroke="#cbd5e1" strokeWidth="0.8" />
          <line x1="0" y1="42" x2="56" y2="42" stroke="#cbd5e1" strokeWidth="0.8" />

          {/* Cars on each level — small blue dots */}
          <g fill="#93c5fd">
            <rect x="4" y="6" width="6" height="3" rx="0.6" />
            <rect x="14" y="6" width="6" height="3" rx="0.6" />
            <rect x="24" y="6" width="6" height="3" rx="0.6" />
            <rect x="34" y="6" width="6" height="3" rx="0.6" />
            <rect x="44" y="6" width="6" height="3" rx="0.6" />

            <rect x="4" y="20" width="6" height="3" rx="0.6" />
            <rect x="14" y="20" width="6" height="3" rx="0.6" />
            <rect x="34" y="20" width="6" height="3" rx="0.6" />
            <rect x="44" y="20" width="6" height="3" rx="0.6" />

            <rect x="4" y="34" width="6" height="3" rx="0.6" />
            <rect x="24" y="34" width="6" height="3" rx="0.6" />
            <rect x="34" y="34" width="6" height="3" rx="0.6" />

            <rect x="14" y="48" width="6" height="3" rx="0.6" />
            <rect x="24" y="48" width="6" height="3" rx="0.6" />
            <rect x="44" y="48" width="6" height="3" rx="0.6" />
          </g>

          {/* Top brand band */}
          <rect x="0" y="-6" width="56" height="6" fill="#2563eb" />
        </g>

        {/* P pin badge perched on the roof */}
        <g transform="translate(70, 14)">
          <circle cx="0" cy="0" r="11" fill="white" />
          <circle cx="0" cy="0" r="9" fill="#2563eb" />
          <text
            x="0"
            y="3.4"
            textAnchor="middle"
            fontSize="10"
            fontWeight="900"
            fill="white"
          >
            P
          </text>
        </g>
      </svg>
    </div>
  );
}

function SurfaceLotThumb() {
  return (
    <div className="home__card-thumb home__card-thumb--surface" aria-hidden="true">
      <svg viewBox="0 0 96 96" className="home__card-thumb-svg">
        <defs>
          <linearGradient id="surface-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>
          <linearGradient id="surface-mountain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>
        <rect width="96" height="96" rx="14" fill="url(#surface-sky)" />
        <path d="M0 44 L22 22 L38 38 L56 18 L96 54 L96 96 L0 96 Z" fill="#cbd5e1" />
        <path d="M6 48 L28 25 L44 42 L61 21 L94 52 L94 96 L6 96 Z" fill="url(#surface-mountain)" opacity="0.82" />
        <path d="M0 58 H96 V96 H0 Z" fill="#e2e8f0" />
        <g stroke="#94a3b8" strokeWidth="1.2">
          <line x1="16" y1="62" x2="16" y2="91" />
          <line x1="32" y1="62" x2="32" y2="91" />
          <line x1="48" y1="62" x2="48" y2="91" />
          <line x1="64" y1="62" x2="64" y2="91" />
          <line x1="80" y1="62" x2="80" y2="91" />
        </g>
        <g fill="#2563eb">
          <rect x="20" y="68" width="11" height="7" rx="2" />
          <rect x="52" y="70" width="11" height="7" rx="2" />
        </g>
        <g fill="#ef4444">
          <rect x="68" y="80" width="11" height="7" rx="2" />
        </g>
        <circle cx="76" cy="22" r="12" fill="white" />
        <circle cx="76" cy="22" r="9" fill="#2563eb" />
        <text
          x="76"
          y="25.5"
          textAnchor="middle"
          fontSize="10"
          fontWeight="900"
          fill="white"
        >
          P
        </text>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Bottom tab bar
   ───────────────────────────────────────────────────────────────── */

interface TabButtonProps {
  label: string;
  active?: boolean;
  children: React.ReactNode;
}

function TabButton({ label, active = false, children }: TabButtonProps) {
  return (
    <button
      type="button"
      className="home__tab"
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
    >
      <span className="home__tab-icon">{children}</span>
      <span className="home__tab-label">{label}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Inline icons
   ───────────────────────────────────────────────────────────────── */

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h12M4 12h8M4 17h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="18" cy="7" r="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="14" cy="12" r="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="10" cy="17" r="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function LocateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l3.09 6.26 6.91 1.01-5 4.87 1.18 6.86L12 18.27l-6.18 3.23L7 14.64l-5-4.87 6.91-1.01L12 2.5z" />
    </svg>
  );
}

function CameraMiniIcon() {
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

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MapTabIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 4v14M15 6v14" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SavedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 4h12v17l-6-4-6 4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12h4l3-8 4 16 3-8h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
