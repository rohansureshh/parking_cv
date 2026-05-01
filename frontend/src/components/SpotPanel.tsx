import type { Spot } from "../lib/types";

interface SpotPanelProps {
  spot: Spot;
  onConfirm: () => void;
  onClose: () => void;
}

export function SpotPanel({ spot, onConfirm, onClose }: SpotPanelProps) {
  const confidencePct = Math.round(spot.confidence * 100);

  return (
    <aside className="spot-panel" aria-label="Selected spot details">
      <div className="spot-panel__head">
        <span className="spot-panel__title">Selected spot</span>
        <button
          type="button"
          className="spot-panel__close"
          aria-label="Clear selection"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="spot-panel__body">
        <div className="spot-panel__icon">{spot.label}</div>
        <div>
          <div className="spot-panel__label-line">Spot {spot.label}</div>
          <div className="spot-panel__meta-line">
            Level {spot.level} · {spot.status} · {confidencePct}% confidence
          </div>
        </div>
      </div>

      <button
        type="button"
        className="spot-panel__cta"
        onClick={onConfirm}
      >
        Select Spot
      </button>
    </aside>
  );
}
