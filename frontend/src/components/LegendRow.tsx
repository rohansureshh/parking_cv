type LegendKey = "available" | "occupied" | "selected";

const LEGEND: Array<{ key: LegendKey; label: string }> = [
  { key: "available", label: "Available" },
  { key: "occupied", label: "Occupied" },
  { key: "selected", label: "Selected" },
];

export function LegendRow() {
  return (
    <div className="legend-row" role="list" aria-label="Spot legend">
      {LEGEND.map(({ key, label }) => (
        <div key={key} className="legend-chip" data-status={key} role="listitem">
          <span className="legend-chip__icon" aria-hidden="true">
            {key === "selected" && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6.2L5 8.6L9.5 4"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <span className="legend-chip__label">{label}</span>
        </div>
      ))}
    </div>
  );
}
