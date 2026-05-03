import type { Spot } from "../lib/types";

interface SpotPanelProps {
  spot: Spot;
  onConfirm: () => void;
  onClose: () => void;
}

export function SpotPanel({ spot, onConfirm, onClose }: SpotPanelProps) {
  return (
    <aside className="sheet" aria-label="Selected spot details">
      <div className="sheet__grip" aria-hidden="true" />

      <div className="sheet__row">
        <div className="sheet__badge">{spot.label}</div>
        <div className="sheet__copy">
          <div className="sheet__title">Spot {spot.label}</div>
          <div className="sheet__meta">Level {spot.level} · Available</div>
        </div>
        <button
          type="button"
          className="sheet__close"
          aria-label="Clear selection"
          onClick={onClose}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        className="sheet__cta"
        onClick={onConfirm}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M2.5 7.2L5.5 10L11.5 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Select Spot
      </button>
    </aside>
  );
}
