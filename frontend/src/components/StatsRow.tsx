import type { Occupancy } from "../lib/types";

interface StatsRowProps {
  occupancy: Occupancy;
}

export function StatsRow({ occupancy }: StatsRowProps) {
  return (
    <div className="summary" role="group" aria-label="Lot summary">
      <div className="summary__cell">
        <div className="summary__num summary__num--available">
          {occupancy.available}
        </div>
        <div className="summary__lab">Available</div>
      </div>
      <div className="summary__cell">
        <div className="summary__num summary__num--occupied">
          {occupancy.occupied}
        </div>
        <div className="summary__lab">Occupied</div>
      </div>
      <div className="summary__cell">
        <div className="summary__num summary__num--total">
          {occupancy.capacity}
        </div>
        <div className="summary__lab">Total Spots</div>
      </div>
    </div>
  );
}
