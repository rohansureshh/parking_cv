import { useEffect } from "react";
import type { Spot } from "../lib/types";

interface ConfirmationModalProps {
  spot: Spot;
  garageName: string;
  onClose: () => void;
}

export function ConfirmationModal({
  spot,
  garageName,
  onClose,
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
        <div className="modal__icon" aria-hidden="true">✓</div>
        <h2 id="confirm-title" className="modal__title">Spot Selected</h2>
        <p className="modal__sub">Head over when you're ready.</p>

        <dl className="modal__details">
          <dt>Spot</dt>
          <dd>{spot.label}</dd>
          <dt>Level</dt>
          <dd>{spot.level}</dd>
          <dt>Garage</dt>
          <dd>{garageName}</dd>
        </dl>

        <button
          type="button"
          className="modal__close"
          onClick={onClose}
          autoFocus
        >
          Done
        </button>
      </div>
    </div>
  );
}
