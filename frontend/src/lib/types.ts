export type SpotStatus = "available" | "occupied" | "unknown";

export type FacilityStatus = "open" | "busy" | "nearly_full";

export interface Spot {
  id: string;
  label: string;
  level: string;
  status: SpotStatus;
  confidence: number;
}

export interface Occupancy {
  lot_id: string;
  lot_slug: string;
  lot_name: string;
  location: string;
  facility_status: FacilityStatus;
  capacity: number;
  available: number;
  occupied: number;
  unknown: number;
  occupancy_pct: number;
  spots: Spot[];
}
