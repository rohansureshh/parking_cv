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
 * Two-row mobile header.
 *
 *   Row 1: [back]   ⬢ SwiftPark   [refresh]
 *                  Stress less. Park better.
 *   Row 2:    Spot Visualization · ● Busy
 *
 * The SwiftPark wordmark is the primary brand element; "Spot Visualization"
 * is rendered as a quieter screen subtitle below it.
 */
export function TopBar({
  title = "Spot Visualization",
  facilityStatus,
  onRefresh,
  refreshing = false,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__row">
        <button
          type="button"
          className="topbar__icon-btn"
          aria-label="Back"
          disabled
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 13L5 8L10 3"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="topbar__brand">
          <div className="brand__row">
            <svg
              className="brand__pin"
              viewBox="0 0 48 56"
              aria-hidden="true"
            >
              <path
                d="M24 0C14.06 0 6 8.06 6 18c0 13.5 18 38 18 38s18-24.5 18-38C42 8.06 33.94 0 24 0z"
                fill="#2563eb"
              />
              <circle cx="24" cy="18" r="11" fill="white" />
              <text
                x="24"
                y="22.6"
                textAnchor="middle"
                fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
                fontWeight="900"
                fontSize="13.5"
                fill="#2563eb"
              >
                P
              </text>
            </svg>
            <span className="brand__wordmark">
              <span className="swift">Swift</span>
              <span className="park">Park</span>
            </span>
          </div>
          <div className="brand__tagline">Stress less. Park better.</div>
        </div>

        <button
          type="button"
          className="topbar__icon-btn"
          onClick={onRefresh}
          aria-label="Refresh occupancy"
          disabled={!onRefresh || refreshing}
        >
          {refreshing ? (
            <span className="spinner spinner--dark" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M14 8a6 6 0 1 1-1.7-4.2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M14 2.4V6h-3.6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          )}
        </button>
      </div>

      <div className="topbar__sub">
        <span className="topbar__sub-title">{title}</span>
        {facilityStatus && (
          <>
            <span className="topbar__sub-dot" aria-hidden="true">·</span>
            <span className="topbar__status" data-status={facilityStatus}>
              <span className="topbar__status-dot" aria-hidden="true" />
              {STATUS_COPY[facilityStatus]}
            </span>
          </>
        )}
      </div>
    </header>
  );
}
