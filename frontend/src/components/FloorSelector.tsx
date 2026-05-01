interface FloorSelectorProps {
  levels: string[];
  activeLevel: string | null;
  onSelect: (level: string) => void;
}

export function FloorSelector({
  levels,
  activeLevel,
  onSelect,
}: FloorSelectorProps) {
  if (levels.length === 0) return null;
  return (
    <div className="floor-seg" role="tablist" aria-label="Floor selector">
      {levels.map((level) => {
        const isActive = level === activeLevel;
        return (
          <button
            key={level}
            type="button"
            role="tab"
            aria-selected={isActive}
            className="floor-seg__btn"
            data-active={isActive ? "true" : undefined}
            onClick={() => onSelect(level)}
          >
            Level {level}
          </button>
        );
      })}
    </div>
  );
}
