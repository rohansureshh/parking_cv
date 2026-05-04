import { useEffect } from "react";
import type { Spot } from "../lib/types";

interface ConfirmationModalProps {
  spot: Spot;
  garageName: string;
  onClose: () => void;
  sectionLabel?: "Level" | "Zone";
  /** When provided, the primary CTA reads "Start Navigation" and calls this
   *  with the confirmed spot. When omitted, the primary CTA falls back to
   *  the original "Done" behavior (just close the modal). */
  onStartNavigation?: (spot: Spot) => void;
}

export function ConfirmationModal({
  spot,
  garageName,
  onClose,
  sectionLabel = "Level",
  onStartNavigation,
}: ConfirmationModalProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onClose}
    >
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal__icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <path
              d="M6 16.5L13 23L26 9"
              stroke="white"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 id="confirm-title" className="modal__title">Spot Selected</h2>
        <p className="modal__sub">Head over when you're ready.</p>

        <div className="modal__details">
          <div className="modal__row">
            <span className="modal__label">Spot</span>
            <span className="modal__value modal__value--accent">{spot.label}</span>
          </div>
          <div className="modal__divider" />
          <div className="modal__row">
            <span className="modal__label">{sectionLabel}</span>
            <span className="modal__value">
              {formatSectionShortValue(spot.level, sectionLabel)}
            </span>
          </div>
          <div className="modal__divider" />
          <div className="modal__row">
            <span className="modal__label">Garage</span>
            <span className="modal__value modal__value--muted">{garageName}</span>
          </div>
        </div>

        <button
          type="button"
          className="modal__close"
          onClick={
            onStartNavigation ? () => onStartNavigation(spot) : onClose
          }
          autoFocus
        >
          {onStartNavigation ? "Start Navigation" : "Done"}
        </button>
      </div>
    </div>
  );
}

function formatSectionShortValue(level: string, sectionLabel: "Level" | "Zone") {
  if (sectionLabel === "Zone") return level.toUpperCase();
  return level;
}
