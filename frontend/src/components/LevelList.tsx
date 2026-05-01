import type { Spot } from "../lib/types";

interface LevelListProps {
  spots: Spot[];
}

interface LevelSummary {
  level: string;
  total: number;
  available: number;
}

function summarize(spots: Spot[]): LevelSummary[] {
  const map = new Map<string, LevelSummary>();
  for (const spot of spots) {
    const entry = map.get(spot.level) ?? {
      level: spot.level,
      total: 0,
      available: 0,
    };
    entry.total += 1;
    if (spot.status === "available") entry.available += 1;
    map.set(spot.level, entry);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.level.localeCompare(b.level, undefined, { numeric: true }),
  );
}

export function LevelList({ spots }: LevelListProps) {
  const levels = summarize(spots);

  if (levels.length === 0) {
    return null;
  }

  return (
    <section className="card">
      <h3 className="section-title">By level</h3>
      <div className="level-list">
        {levels.map((level) => {
          const pct = level.total === 0 ? 0 : (level.available / level.total) * 100;
          return (
            <div key={level.level} className="level-row">
              <span className="level-row__chip">{level.level}</span>
              <div className="level-row__bar" aria-hidden="true">
                <div
                  className="level-row__bar-inner"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="level-row__count">
                <strong>{level.available}</strong> / {level.total} open
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
