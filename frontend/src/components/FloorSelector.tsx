interface FloorSelectorProps {
  levels: string[];
  activeLevel: string | null;
  onSelect: (level: string) => void;
  sectionLabel?: "Level" | "Zone";
}

export function FloorSelector({
  levels,
  activeLevel,
  onSelect,
  sectionLabel = "Level",
}: FloorSelectorProps) {
  if (levels.length === 0) return null;
  return (
    <div className="floor-seg" role="tablist" aria-label={`${sectionLabel} selector`}>
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
            {formatSectionLabel(level, sectionLabel)}
          </button>
        );
      })}
    </div>
  );
}

function formatSectionLabel(level: string, sectionLabel: "Level" | "Zone") {
  if (sectionLabel === "Zone") return `Zone ${level.replace(/^Z/i, "")}`;
  return `Level ${level}`;
}
