import { useEffect, useState } from "react";

import { DEMO_FALLBACK, useOccupancy } from "../lib/occupancyCache";

interface ParkedConfirmationScreenProps {
  onBackToMap: () => void;
}

interface FrozenSpot {
  label: string;
  level: string;
}

interface FrozenState {
  spot: FrozenSpot;
  garage: { name: string; address: string };
}

const FALLBACK_SPOT: FrozenSpot = { label: "A-12", level: "2" };

type ShareStatus = "idle" | "shared" | "copied";

/**
 * Parked Confirmation screen.
 *
 * Composition (top → bottom):
 *   1. Header — back arrow, SwiftPark mini-pill, balanced spacer.
 *   2. Hero — animated blue check badge, "You're Parked!" headline, and
 *      "Your spot is selected." subtext.
 *   3. Details card — Spot label + Level on top row, garage name + address
 *      below, optional running timer block once the user starts the timer.
 *   4. Actions — primary "Start Parking Timer", secondary "Save Parking
 *      Location", tertiary "Share Location".
 *   5. Footer — quiet "Back to Map" link.
 *
 * Data: reads from the shared `useOccupancy` cache and **freezes** the
 * derived spot/garage on first resolution. Subsequent re-fetches don't
 * change the user's confirmed spot from under them.
 */
export function ParkedConfirmationScreen({
  onBackToMap,
}: ParkedConfirmationScreenProps) {
  const { occupancy } = useOccupancy();
  const [frozen, setFrozen] = useState<FrozenState | null>(null);

  useEffect(() => {
    if (frozen) return;
    if (!occupancy) return;
    const open = occupancy.spots.find((s) => s.status === "available");
    setFrozen({
      spot: open
        ? { label: open.label, level: open.level }
        : FALLBACK_SPOT,
      garage: {
        name: occupancy.lot_name,
        address: occupancy.location,
      },
    });
  }, [occupancy, frozen]);

  const spot = frozen?.spot ?? FALLBACK_SPOT;
  const garageName = frozen?.garage.name ?? DEMO_FALLBACK.garageName;
  const garageAddress =
    frozen?.garage.address ?? DEMO_FALLBACK.garageAddress;

  /* Timer */
  const [timerStarted, setTimerStarted] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  useEffect(() => {
    if (!timerStarted) return;
    const id = window.setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerStarted]);

  /* Save state */
  const [saved, setSaved] = useState(false);

  /* Share */
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");

  const handleShare = async () => {
    const text = `I'm parked at Spot ${spot.label}, Level ${spot.level} — ${garageName}.`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "My SwiftPark Spot", text });
        setShareStatus("shared");
        window.setTimeout(() => setShareStatus("idle"), 2200);
        return;
      } catch (err) {
        // User cancelled the native share sheet — leave UI alone.
        if (err instanceof Error && err.name === "AbortError") return;
        // Otherwise fall through to clipboard fallback.
      }
    }

    try {
      await navigator.clipboard?.writeText(text);
      setShareStatus("copied");
      window.setTimeout(() => setShareStatus("idle"), 2200);
    } catch {
      // No share API and no clipboard — silent.
    }
  };

  return (
    <div className="parked">
      <header className="parked__header">
        <button
          type="button"
          className="parked__icon-btn"
          onClick={onBackToMap}
          aria-label="Back to map"
        >
          <ArrowLeftIcon />
        </button>
        <div className="parked__brand" aria-hidden="true">
          <span className="parked__brand-pin">P</span>
          <span className="parked__brand-name">
            <span className="swift">Swift</span>
            <span className="park">Park</span>
          </span>
        </div>
        <span className="parked__header-spacer" aria-hidden="true" />
      </header>

      <main className="parked__main">
        <div className="parked__check" aria-hidden="true">
          <CheckBadge />
        </div>

        <h1 className="parked__title">You're Parked!</h1>
        <p className="parked__subtitle">Your spot is selected.</p>

        <section className="parked__card">
          <div className="parked__card-row">
            <div className="parked__card-col">
              <div className="parked__card-label">Spot</div>
              <div className="parked__card-value parked__card-value--accent">
                {spot.label}
              </div>
            </div>
            <span className="parked__card-divider" aria-hidden="true" />
            <div className="parked__card-col">
              <div className="parked__card-label">Level</div>
              <div className="parked__card-value">{spot.level}</div>
            </div>
          </div>

          <div className="parked__card-sep" aria-hidden="true" />

          <div className="parked__garage">
            <div className="parked__garage-icon">
              <PinIcon />
            </div>
            <div className="parked__garage-info">
              <div className="parked__garage-name">{garageName}</div>
              <div className="parked__garage-address">{garageAddress}</div>
            </div>
          </div>

          {timerStarted && (
            <div className="parked__timer">
              <div className="parked__timer-label">
                <TimerIcon />
                <span>Parking Timer</span>
              </div>
              <span className="parked__timer-value">
                {formatTimer(elapsedSecs)}
              </span>
            </div>
          )}
        </section>

        <div className="parked__actions">
          <button
            type="button"
            className="parked__cta"
            data-running={timerStarted ? "true" : "false"}
            onClick={() => setTimerStarted(true)}
            disabled={timerStarted}
          >
            <ClockIcon />
            {timerStarted ? "Timer Running" : "Start Parking Timer"}
          </button>

          <button
            type="button"
            className="parked__action"
            data-saved={saved ? "true" : "false"}
            onClick={() => setSaved(true)}
            disabled={saved}
          >
            {saved ? <SmallCheckIcon /> : <BookmarkIcon />}
            {saved ? "Location Saved" : "Save Parking Location"}
          </button>

          <button
            type="button"
            className="parked__share"
            onClick={() => void handleShare()}
            aria-label="Share location"
          >
            {shareStatus === "idle" ? <ShareIcon /> : <SmallCheckIcon />}
            {shareStatus === "shared"
              ? "Shared!"
              : shareStatus === "copied"
                ? "Copied to clipboard"
                : "Share Location"}
          </button>
        </div>

        <button
          type="button"
          className="parked__back-link"
          onClick={onBackToMap}
        >
          Back to Map
        </button>
      </main>
    </div>
  );
}

function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────────────────────────
   Check badge — animated blue rounded square with stroke-drawn check
   ───────────────────────────────────────────────────────────────── */

function CheckBadge() {
  return (
    <svg
      className="parked__check-svg"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="parked-check-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="28"
        fill="url(#parked-check-bg)"
      />
      <path
        className="parked__check-stroke"
        d="M 26 50 L 44 68 L 76 36"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
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

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function TimerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="14" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9 2h6M12 14V10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 4h14v18l-7-5-7 5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="6" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
      <line
        x1="8.6"
        y1="10.6"
        x2="15.4"
        y2="7.4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="8.6"
        y1="13.4"
        x2="15.4"
        y2="16.6"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function SmallCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l5 5L20 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
