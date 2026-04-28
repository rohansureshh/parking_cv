"""
Small FastAPI backend for the SwiftPark YC demo.

This API uses sample in-memory data for now. It is intentionally separate from
detector.py so the existing YOLO parking detector stays unchanged.
"""

from datetime import datetime, timezone
import random

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="SwiftPark Demo API")

# Allow local frontends, such as React/Vite, to call this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


demo_lot = {
    "lot_id": "osu-structure-1",
    "lot_name": "OSU Parking Structure 1",
    "capacity": 120,
    "occupied": 86,
    "available": 34,
    "occupancy_pct": 72,
    "status": "busy",
    "last_updated": datetime.now(timezone.utc).isoformat(),
}


def update_demo_lot(occupied: int) -> dict:
    """Update the sample lot numbers and return the latest data."""
    capacity = demo_lot["capacity"]
    occupied = max(0, min(occupied, capacity))
    available = capacity - occupied
    occupancy_pct = round((occupied / capacity) * 100)

    if occupancy_pct >= 85:
        status = "nearly_full"
    elif occupancy_pct >= 60:
        status = "busy"
    else:
        status = "open"

    demo_lot.update(
        {
            "occupied": occupied,
            "available": available,
            "occupancy_pct": occupancy_pct,
            "status": status,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
    )
    return demo_lot


@app.get("/health")
def health():
    """Simple check that the API is running."""
    return {"ok": True, "service": "swiftpark-demo-api"}


@app.get("/demo/occupancy")
def get_demo_occupancy():
    """Return sample occupancy data for the demo parking lot."""
    return demo_lot


@app.post("/demo/simulate-detection")
def simulate_detection():
    """
    Pretend a new camera detection came in.

    For the demo, this randomly moves occupancy up or down a little.
    """
    change = random.randint(-8, 8)
    return update_demo_lot(demo_lot["occupied"] + change)
