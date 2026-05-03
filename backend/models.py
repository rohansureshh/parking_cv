from pydantic import BaseModel
from datetime import datetime


class SpotStatus(BaseModel):
    id: str
    label: str
    level: str = "1"              # floor/level, default to "1" for single level
    status: str                   # "available" | "occupied" | "unknown"
    confidence: float = 1.0       # detection confidence, 0.0 - 1.0


class OccupancySnapshot(BaseModel):
    lot_id: str = "lot_1"
    lot_slug: str = "lot-1"
    lot_name: str = "Parking Lot"
    location: str = ""
    facility_status: str          # "open" | "busy" | "nearly_full"
    timestamp: datetime
    capacity: int
    available: int
    occupied: int
    unknown: int = 0
    occupancy_pct: float
    spots: list[SpotStatus] = []


def compute_facility_status(occupancy_pct: float) -> str:
    if occupancy_pct < 0.6:
        return "open"
    elif occupancy_pct < 0.85:
        return "busy"
    else:
        return "nearly_full"