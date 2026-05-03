import { useMemo } from "react";

import {
  DEMO_FALLBACK,
  type SelectedSpot,
  useOccupancy,
} from "../lib/occupancyCache";

interface NavigationScreenProps {
  onBack: () => void;
  onCancel: () => void;
  onParked: () => void;
  /** When provided, the navigation flow targets this specific spot instead
   *  of falling back to the first available spot in the cache. Set when the
   *  user explicitly selected and confirmed a spot in Spot Visualization. */
  preselectedSpot?: SelectedSpot;
}

type TargetSpot = SelectedSpot;

const FALLBACK = {
  garageName: DEMO_FALLBACK.garageName,
  spot: { label: "A-12", level: "2" } satisfies TargetSpot,
};

/**
 * Navigation screen.
 *
 * Composition (top → bottom):
 *   1. Blue instruction header — back · "Navigating ⋅ Garage" title · close.
 *      Big turn icon + "150 ft" + "Turn right onto Oak Ave" + "Then…" preview.
 *   2. Map area — light Apple-Maps-style background with road grid, a polished
 *      blue route line (white halo + flowing dashes for live motion), a "you
 *      are here" pulsing blue dot, and the destination SwiftPark P pin.
 *      Floating ETA chip overlays the top-right corner.
 *   3. Bottom panel — dark destination card (garage + assigned spot) and the
 *      primary "I've Parked ✓" CTA.
 *
 * Live data: fetches /demo/occupancy on mount to source the garage name and
 * pick the first available spot as the navigation target. Falls back silently
 * to FALLBACK so the screen always looks complete.
 */
export function NavigationScreen({
  onBack,
  onCancel,
  onParked,
  preselectedSpot,
}: NavigationScreenProps) {
  const { occupancy, ready } = useOccupancy();

  const garageName = occupancy?.lot_name ?? FALLBACK.garageName;

  const targetSpot: TargetSpot = useMemo(() => {
    if (preselectedSpot) return preselectedSpot;
    if (!occupancy) return FALLBACK.spot;
    const open = occupancy.spots.find((s) => s.status === "available");
    if (!open) return FALLBACK.spot;
    return { label: open.label, level: open.level };
  }, [preselectedSpot, occupancy]);

  const arrivalTime = useMemo(() => {
    const future = new Date(Date.now() + 3 * 60 * 1000);
    return future.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  return (
    <div className="navigation">
      <header className="navigation__header">
        <div className="navigation__header-bar">
          <button
            type="button"
            className="navigation__header-btn"
            onClick={onBack}
            aria-label="Back to garage overview"
          >
            <ArrowLeftIcon />
          </button>
          <div className="navigation__header-title">
            <span className="navigation__header-eyebrow">Navigating</span>
            <span className="navigation__header-name">
              {ready ? (
                garageName
              ) : (
                <span
                  className="demo-skel"
                  style={{ width: 130 }}
                  aria-hidden="true"
                />
              )}
            </span>
          </div>
          <button
            type="button"
            className="navigation__header-btn"
            onClick={onCancel}
            aria-label="End navigation"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="navigation__turn">
          <div className="navigation__turn-icon">
            <TurnRightIcon />
          </div>
          <div className="navigation__turn-text">
            <div className="navigation__turn-distance">150 ft</div>
            <div className="navigation__turn-instruction">
              Turn right onto Oak Ave
            </div>
          </div>
        </div>

        <div className="navigation__then">
          <ArrowUpIcon />
          {ready ? (
            <span>Then continue to Level {targetSpot.level}</span>
          ) : (
            <span>
              Then continue to Level{" "}
              <span
                className="demo-skel"
                style={{ width: 14 }}
                aria-hidden="true"
              />
            </span>
          )}
        </div>
      </header>

      <div className="navigation__map-wrap">
        <NavMap />

        <div
          className="navigation__eta-chip"
          aria-label="Estimated time of arrival"
        >
          <div className="navigation__eta-num">3</div>
          <div className="navigation__eta-unit">min</div>
          <span className="navigation__eta-divider" aria-hidden="true" />
          <div className="navigation__eta-side">
            <span className="navigation__eta-distance">0.4 mi</span>
            <span className="navigation__eta-arrival">arrive {arrivalTime}</span>
          </div>
        </div>
      </div>

      <div className="navigation__panel">
        <div className="navigation__destination">
          <div className="navigation__destination-icon">
            <PinIcon />
          </div>
          <div className="navigation__destination-info">
            <div className="navigation__destination-eyebrow">Destination</div>
            <div className="navigation__destination-name">
              {ready ? (
                garageName
              ) : (
                <span
                  className="demo-skel"
                  style={{ width: 150 }}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
          <div className="navigation__destination-spot">
            <div className="navigation__destination-spot-label">Spot</div>
            <div className="navigation__destination-spot-value">
              {ready ? (
                targetSpot.label
              ) : (
                <span
                  className="demo-skel"
                  style={{ width: 36 }}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="navigation__destination-spot-level">
              {ready ? (
                <>Level {targetSpot.level}</>
              ) : (
                <span>
                  Level{" "}
                  <span
                    className="demo-skel"
                    style={{ width: 12 }}
                    aria-hidden="true"
                  />
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="navigation__cta"
          onClick={onParked}
        >
          <CheckIcon />
          I've Parked
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Fake nav map — light map base, blue route with flowing dashes,
   "you are here" pulse, and a destination SwiftPark pin.
   ───────────────────────────────────────────────────────────────── */

function NavMap() {
  return (
    <svg
      className="navigation__map"
      viewBox="0 0 400 480"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="nav-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eef1f6" />
          <stop offset="100%" stopColor="#e3e7ee" />
        </linearGradient>
        <linearGradient id="nav-route" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>

      {/* Base land */}
      <rect width="400" height="480" fill="url(#nav-bg)" />

      {/* Park / green block */}
      <rect
        x="240"
        y="290"
        width="100"
        height="60"
        rx="4"
        fill="#d9efe1"
        opacity="0.85"
      />

      {/* Major roads — horizontal */}
      <g stroke="white" strokeWidth="13" strokeLinecap="butt">
        <line x1="0" y1="120" x2="400" y2="120" />
        <line x1="0" y1="240" x2="400" y2="240" />
        <line x1="0" y1="360" x2="400" y2="360" />
      </g>

      {/* Major roads — vertical */}
      <g stroke="white" strokeWidth="13" strokeLinecap="butt">
        <line x1="80" y1="0" x2="80" y2="480" />
        <line x1="200" y1="0" x2="200" y2="480" />
        <line x1="320" y1="0" x2="320" y2="480" />
      </g>

      {/* Minor streets */}
      <g stroke="white" strokeWidth="6" strokeLinecap="butt">
        <line x1="0" y1="180" x2="400" y2="180" />
        <line x1="0" y1="300" x2="400" y2="300" />
        <line x1="0" y1="420" x2="400" y2="420" />
        <line x1="140" y1="0" x2="140" y2="480" />
        <line x1="260" y1="0" x2="260" y2="480" />
      </g>

      {/* Subtle road outlines for depth */}
      <g stroke="#dee3ec" strokeWidth="0.6" fill="none" opacity="0.7">
        <line x1="0" y1="113.5" x2="400" y2="113.5" />
        <line x1="0" y1="126.5" x2="400" y2="126.5" />
        <line x1="0" y1="233.5" x2="400" y2="233.5" />
        <line x1="0" y1="246.5" x2="400" y2="246.5" />
        <line x1="0" y1="353.5" x2="400" y2="353.5" />
        <line x1="0" y1="366.5" x2="400" y2="366.5" />
        <line x1="73.5" y1="0" x2="73.5" y2="480" />
        <line x1="86.5" y1="0" x2="86.5" y2="480" />
        <line x1="193.5" y1="0" x2="193.5" y2="480" />
        <line x1="206.5" y1="0" x2="206.5" y2="480" />
        <line x1="313.5" y1="0" x2="313.5" y2="480" />
        <line x1="326.5" y1="0" x2="326.5" y2="480" />
      </g>

      {/* Faint district label */}
      <text
        x="156"
        y="200"
        fontSize="9"
        fontWeight="600"
        fill="#94a3b8"
        letterSpacing="0.04em"
        fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
      >
        DOWNTOWN
      </text>
      <text
        x="270"
        y="338"
        fontSize="8.5"
        fontWeight="600"
        fill="#94a3b8"
        letterSpacing="0.04em"
        fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
      >
        OAK PARK
      </text>

      {/* Route — Apple-Maps-style: soft white halo, confident brand-blue
          body, and a long-segment moving white highlight that sweeps along
          the path. Wider corner radii (Q control points extended) keep the
          turns smooth rather than mechanical. */}
      <path
        d="M 80 430 L 80 256 Q 80 240 96 240 L 304 240 Q 320 240 320 224 L 320 130"
        stroke="white"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M 80 430 L 80 256 Q 80 240 96 240 L 304 240 Q 320 240 320 224 L 320 130"
        stroke="url(#nav-route)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        className="navigation__route-flow"
        d="M 80 430 L 80 256 Q 80 240 96 240 L 304 240 Q 320 240 320 224 L 320 130"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray="32 90"
      />

      {/* "You are here" — small contained halo + blue dot with directional
          arrow. The halo's transform-origin must be set via fill-box on the
          circle itself; without it, CSS transform: scale() resolves against
          the SVG viewBox origin and the halo "flies" toward (0, 0). */}
      <g transform="translate(80, 430)">
        <circle
          className="navigation__here-pulse"
          cx="0"
          cy="0"
          r="13"
          fill="#2563eb"
          opacity="0.32"
        />
        <circle cx="0" cy="0" r="11" fill="white" />
        <circle cx="0" cy="0" r="8" fill="#2563eb" />
        {/* Direction triangle indicating heading north */}
        <path d="M -4 -4 L 0 -10 L 4 -4 Z" fill="white" opacity="0.9" />
      </g>

      {/* Destination — SwiftPark P teardrop pin */}
      <g transform="translate(320, 130)" filter="url(#nav-pin-shadow)">
        <path
          d="M 0 -36 C -10 -36 -18 -28 -18 -18 c 0 13.5 18 18 18 18 s 18 -4.5 18 -18 C 18 -28 10 -36 0 -36 Z"
          fill="#2563eb"
        />
        <circle cx="0" cy="-18" r="9" fill="white" />
        <text
          x="0"
          y="-14.5"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fill="#2563eb"
          fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        >
          P
        </text>
      </g>

      {/* Tiny shadow ellipse under the pin */}
      <ellipse cx="320" cy="132" rx="8" ry="2.4" fill="#0f172a" opacity="0.25" />
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

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TurnRightIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <path
        d="M 7 26 L 7 13 a 4 4 0 0 1 4 -4 L 22 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 18 5 L 23 9 L 18 13"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M6 11l6-6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l5 5L20 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
