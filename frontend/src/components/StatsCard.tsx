import type { Occupancy } from "../lib/types";

interface StatsCardProps {
  occupancy: Occupancy;
  lastUpdated: Date | null;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function StatsCard({ occupancy, lastUpdated }: StatsCardProps) {
  const occupancyPct = Math.min(100, Math.max(0, occupancy.occupancy_pct));

  return (
    <section className="card">
      <div className="stats__top">
        <div>
          <h2 className="stats__lot">{occupancy.lot_name} — Demo Data</h2>
          <p className="stats__location">{occupancy.location}</p>
        </div>
        {lastUpdated && (
          <div className="stats__updated">
            Updated {formatTime(lastUpdated)}
          </div>
        )}
      </div>

      <div className="stats__hero">
        <span className="stats__big">{occupancy.available}</span>
        <span className="stats__big-label">spots available</span>
      </div>

      <div className="stats__row">
        <div className="stat">
          <div className="stat__value">{occupancy.occupied}</div>
          <div className="stat__label">Occupied</div>
        </div>
        <div className="stat">
          <div className="stat__value">{occupancy.unknown}</div>
          <div className="stat__label">Unknown</div>
        </div>
        <div className="stat">
          <div className="stat__value">{occupancy.capacity}</div>
          <div className="stat__label">Capacity</div>
        </div>
      </div>

      <div className="progress">
        <div className="progress__head">
          <span>Occupancy</span>
          <strong>{occupancyPct.toFixed(1)}%</strong>
        </div>
        <div className="progress__track">
          <div
            className="progress__bar"
            data-status={occupancy.facility_status}
            style={{ width: `${occupancyPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
