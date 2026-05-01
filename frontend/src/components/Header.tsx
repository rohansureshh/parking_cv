import type { FacilityStatus } from "../lib/types";

const STATUS_COPY: Record<FacilityStatus, string> = {
  open: "Open",
  busy: "Busy",
  nearly_full: "Nearly full",
};

interface HeaderProps {
  facilityStatus?: FacilityStatus;
}

export function Header({ facilityStatus }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand__wordmark">
          <span className="swift">Swift</span>
          <span className="park">Park</span>
        </div>
        <div className="brand__tagline">Stress less. Park better.</div>
      </div>

      {facilityStatus && (
        <span className="header__badge" data-status={facilityStatus}>
          <span className="dot" aria-hidden="true" />
          {STATUS_COPY[facilityStatus]}
        </span>
      )}
    </header>
  );
}
