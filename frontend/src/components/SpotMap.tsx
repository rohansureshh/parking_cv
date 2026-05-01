import type { CSSProperties } from "react";
import type { Spot } from "../lib/types";

interface SpotMapProps {
  spots: Spot[];
  selectedSpotId: string | null;
  onSelectSpot: (spot: Spot) => void;
}

interface FloorGroup {
  level: string;
  spots: Spot[];
  available: number;
}

function groupByLevel(spots: Spot[]): FloorGroup[] {
  const map = new Map<string, FloorGroup>();
  for (const spot of spots) {
    const entry = map.get(spot.level) ?? {
      level: spot.level,
      spots: [],
      available: 0,
    };
    entry.spots.push(spot);
    if (spot.status === "available") entry.available += 1;
    map.set(spot.level, entry);
  }

  const groups = Array.from(map.values());
  groups.sort((a, b) =>
    a.level.localeCompare(b.level, undefined, { numeric: true }),
  );
  for (const group of groups) {
    group.spots.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
  }
  return groups;
}

export function SpotMap({ spots, selectedSpotId, onSelectSpot }: SpotMapProps) {
  if (spots.length === 0) {
    return null;
  }

  const floors = groupByLevel(spots);

  return (
    <section className="card">
      <div className="map">
        <div>
          <h3 className="section-title">Live spot map</h3>
          <div className="map__legend" aria-label="Spot status legend">
            <span className="legend-pill">
              <span className="legend-swatch" data-status="available" />
              Available
            </span>
            <span className="legend-pill">
              <span className="legend-swatch" data-status="occupied" />
              Occupied
            </span>
            <span className="legend-pill">
              <span className="legend-swatch" data-status="unknown" />
              Unknown
            </span>
          </div>
        </div>

        {floors.map((floor) => (
          <Floor
            key={floor.level}
            floor={floor}
            selectedSpotId={selectedSpotId}
            onSelectSpot={onSelectSpot}
          />
        ))}
      </div>
    </section>
  );
}

interface FloorProps {
  floor: FloorGroup;
  selectedSpotId: string | null;
  onSelectSpot: (spot: Spot) => void;
}

function Floor({ floor, selectedSpotId, onSelectSpot }: FloorProps) {
  const half = Math.ceil(floor.spots.length / 2);
  const topRow = floor.spots.slice(0, half);
  const bottomRow = floor.spots.slice(half);

  return (
    <div className="floor">
      <div className="floor__head">
        <span className="floor__name">Level {floor.level}</span>
        <span className="floor__meta">
          {floor.available} / {floor.spots.length} open
        </span>
      </div>

      <div className="floor__stage">
        <div className="floor__grid">
          {topRow.map((spot, idx) => (
            <SpotTile
              key={spot.id}
              spot={spot}
              index={idx}
              selected={spot.id === selectedSpotId}
              onSelect={onSelectSpot}
            />
          ))}
          <div className="floor__aisle" aria-hidden="true" />
          {bottomRow.map((spot, idx) => (
            <SpotTile
              key={spot.id}
              spot={spot}
              index={topRow.length + idx}
              selected={spot.id === selectedSpotId}
              onSelect={onSelectSpot}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface SpotTileProps {
  spot: Spot;
  index: number;
  selected: boolean;
  onSelect: (spot: Spot) => void;
}

function SpotTile({ spot, index, selected, onSelect }: SpotTileProps) {
  const isAvailable = spot.status === "available";

  return (
    <button
      type="button"
      className="spot"
      data-status={spot.status}
      data-selected={selected ? "true" : undefined}
      style={{ ["--i" as string]: index } as CSSProperties}
      disabled={!isAvailable}
      aria-label={`Spot ${spot.label}, ${spot.status}`}
      aria-pressed={selected}
      onClick={() => isAvailable && onSelect(spot)}
    >
      <span>{spot.label}</span>
      {selected && <span className="spot__check" aria-hidden="true">✓</span>}
    </button>
  );
}
