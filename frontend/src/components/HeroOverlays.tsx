interface HeroOverlaysProps {
  /** The currently visible floor (e.g. "L2"). */
  activeLevel: string | null;
  /** Called when the user taps the recenter button. */
  onRecenter: () => void;
  /** Whether the gesture hint should be shown over the canvas. */
  showHint: boolean;
}

/**
 * Small absolutely-positioned chrome over the 3D viewport:
 *   - top-left "3D" mode chip (decorative)
 *   - top-right recenter button
 *   - top-center auto-dismissing gesture hint
 *
 * The wrapper is `pointer-events: none` and individual interactive
 * elements opt back in, so canvas drag/tap still works.
 */
export function HeroOverlays({
  activeLevel,
  onRecenter,
  showHint,
}: HeroOverlaysProps) {
  return (
    <div className="hero__overlays" aria-hidden={false}>
      <div className="hero__chip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3l8.7 5v8L12 21l-8.7-5V8L12 3z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M3.3 8L12 13l8.7-5M12 13v8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        <span>3D</span>
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <button
        type="button"
        className="hero__icon-btn"
        onClick={onRecenter}
        aria-label="Recenter view"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 11l18-8-8 18-2-8-8-2z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            fill="none"
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
            <path d="M2 12a10 10 0 1019.7-2.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M22 4v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          Drag to rotate · Tap a blue spot
        </div>
      )}
    </div>
  );
}
