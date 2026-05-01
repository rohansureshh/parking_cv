import type { FacilityStatus } from "../lib/types";

const STATUS_COPY: Record<FacilityStatus, string> = {
  open: "Open",
  busy: "Busy",
  nearly_full: "Nearly full",
};

interface TopBarProps {
  title?: string;
  facilityStatus?: FacilityStatus;
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * Mobile-app top bar — left brand badge, centered title with eyebrow,
 * right action button. Replaces the old dashboard-style Header.
 */
export function TopBar({
  title = "Spot Visualization",
  facilityStatus,
  onRefresh,
  refreshing = false,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__brand" aria-label="SwiftPark">
        <div className="topbar__pin">P</div>
      </div>

      <div className="topbar__center">
        <div className="topbar__eyebrow">
          <span className="swift">Swift</span>
          <span className="park">Park</span>
          <span className="topbar__eyebrow-dot">·</span>
          <span className="topbar__tagline">Stress less. Park better.</span>
        </div>
        <h1 className="topbar__title">{title}</h1>
        {facilityStatus && (
          <span className="topbar__status" data-status={facilityStatus}>
            <span className="topbar__status-dot" aria-hidden="true" />
            {STATUS_COPY[facilityStatus]}
          </span>
        )}
      </div>

      <button
        type="button"
        className="topbar__action"
        onClick={onRefresh}
        aria-label="Refresh occupancy"
        disabled={!onRefresh || refreshing}
      >
        {refreshing ? (
          <span className="spinner spinner--dark" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 12a9 9 0 1018-2.1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M21 4v6h-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        )}
      </button>
    </header>
  );
}
