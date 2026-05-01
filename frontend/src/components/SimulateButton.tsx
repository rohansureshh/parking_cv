interface SimulateButtonProps {
  simulating: boolean;
  onClick: () => void;
}

export function SimulateButton({ simulating, onClick }: SimulateButtonProps) {
  return (
    <button
      type="button"
      className="simulate-btn"
      onClick={onClick}
      disabled={simulating}
      aria-busy={simulating}
    >
      <span className="simulate-btn__icon" aria-hidden="true">
        {simulating ? (
          <span className="spinner" />
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 2L10 6L3 10V2Z" fill="currentColor" />
          </svg>
        )}
      </span>
      <span>{simulating ? "Running detection…" : "Run Detection Simulation"}</span>
    </button>
  );
}
