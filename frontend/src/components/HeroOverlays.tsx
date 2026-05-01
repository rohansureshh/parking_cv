interface HeroOverlaysProps {
  /** The currently visible floor (e.g. "L2"). */
  activeLevel: string | null;
  /** Called when the user taps the recenter button. */
  onRecenter: () => void;
  /** Whether the gesture hint should be shown over the canvas. */
  showHint: boolean;
}

/**
 * Floating chrome above the 3D viewport.
 *
 *   - top-left  "3D" mode chip (decorative)
 *   - top-right "recenter" target button
 *   - bottom-right floor badge
 *   - top-center auto-dismissing gesture hint
 *
 * The wrapper is `pointer-events: none` and individual interactive
 * children opt back in, so canvas drag/tap still works.
 */
export function HeroOverlays({
  activeLevel,
  onRecenter,
  showHint,
}: HeroOverlaysProps) {
  return (
    <div className="hero__overlays" aria-hidden={false}>
      <div className="hero__chip">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3l8.7 5v8L12 21l-8.7-5V8L12 3z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M3.3 8L12 13l8.7-5M12 13v8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span>3D</span>
        <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <button
        type="button"
        className="hero__icon-btn"
        onClick={onRecenter}
        aria-label="Recenter view"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" />
          <path
            d="M8 1v2M8 13v2M1 8h2M13 8h2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {activeLevel && (
        <div className="hero__floor-badge" aria-hidden="true">
          <span className="hero__floor-eyebrow">FLOOR</span>
          <span className="hero__floor-num">{activeLevel.replace(/^L/i, "")}</span>
        </div>
      )}

      {showHint && (
        <div className="hero__hint" role="status">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2 8 6h3v6H5v3l-4-4 4-4v3h6V8h-3z"
              fill="currentColor"
            />
          </svg>
          Drag to rotate · Tap a blue spot
        </div>
      )}
    </div>
  );
}
