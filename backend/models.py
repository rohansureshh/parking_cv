"""
models.py
---------
Data shapes for what the API returns.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SpotStatus(BaseModel):
    """Status to flag if spot is taken or not, will be used in an array inside OccupancySnapshot"""
    spot_id: str
    is_occupied: bool


class OccupancySnapshot(BaseModel):
    """
    The core data object, represents the state of the lot at a point in time.
    This is what gets sent to the frontend via REST or WebSocket.
    """
    timestamp: datetime
    capacity: int
    vehicles_detected: int
    available_spots: int
    occupancy_pct: float          # 0.0 - 1.0
    status: str                   # "low" | "moderate" | "high" | "full"
    spots: list[SpotStatus] = []  


def compute_status(occupancy_pct: float) -> str:
    """Human-readable status label based on occupancy percentage (CAN ADJUST LATER)"""
    if occupancy_pct < 0.3:
        return "low"
    elif occupancy_pct < 0.6:
        return "moderate"
    elif occupancy_pct < 0.8:
        return "high"
    else:
        return "full"