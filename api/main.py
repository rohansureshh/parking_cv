"""Small FastAPI backend for the SwiftPark YC demo."""

from datetime import datetime, timezone
import random

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.supabase_client import get_supabase


app = FastAPI(title="SwiftPark Demo API")

# Allow local frontends, such as React/Vite, to call this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


DEMO_FACILITY_SLUG = "osu-structure-1"
DEMO_FACILITY_NAME = "OSU Parking Structure 1"
DEMO_FACILITY_LOCATION = "Oregon State University, Corvallis, OR"
DEMO_CAPACITY = 120
DEMO_STARTING_AVAILABLE = 30
DEMO_STARTING_UNKNOWN = 4
SPOT_STATUSES = ("available", "occupied", "unknown")


def utc_now() -> str:
    """Return a timestamp Supabase can store in timestamptz columns."""
    return datetime.now(timezone.utc).isoformat()


def get_facility_status(occupancy_pct: float) -> str:
    """Convert an occupancy percentage into a simple demo status."""
    if occupancy_pct >= 85:
        return "nearly_full"
    if occupancy_pct >= 60:
        return "busy"
    return "open"


def get_demo_spots(facility_id: str) -> list[dict]:
    """Create the sample spot rows used by /demo/seed."""
    spots = []
    for spot_number in range(1, DEMO_CAPACITY + 1):
        if spot_number <= DEMO_STARTING_AVAILABLE:
            status = "available"
        elif spot_number > DEMO_CAPACITY - DEMO_STARTING_UNKNOWN:
            status = "unknown"
        else:
            status = "occupied"

        spots.append(
            {
                "facility_id": facility_id,
                "label": f"S{spot_number:03d}",
                "level": f"L{1 + ((spot_number - 1) // 40)}",
                "status": status,
                "confidence": 0.92 if status != "unknown" else 0.45,
            }
        )
    return spots


def count_spot_statuses(spots: list[dict]) -> dict:
    """Count the current spot statuses."""
    capacity = len(spots)
    available = sum(1 for spot in spots if spot["status"] == "available")
    occupied = sum(1 for spot in spots if spot["status"] == "occupied")
    unknown = sum(1 for spot in spots if spot["status"] == "unknown")
    occupancy_pct = round((occupied / capacity) * 100, 1) if capacity else 0.0

    return {
        "available": available,
        "occupied": occupied,
        "unknown": unknown,
        "capacity": capacity,
        "occupancy_pct": occupancy_pct,
    }


def build_occupancy_response(facility: dict, spots: list[dict]) -> dict:
    """Turn Supabase rows into the shape the frontend needs."""
    counts = count_spot_statuses(spots)
    spot_list = [
        {
            "id": spot["id"],
            "label": spot["label"],
            "level": spot["level"],
            "status": spot["status"],
            "confidence": spot["confidence"],
        }
        for spot in spots
    ]

    return {
        "lot_id": facility["id"],
        "lot_slug": facility["slug"],
        "lot_name": facility["name"],
        "location": facility["location"],
        "facility_status": get_facility_status(counts["occupancy_pct"]),
        "capacity": counts["capacity"],
        "available": counts["available"],
        "occupied": counts["occupied"],
        "unknown": counts["unknown"],
        "occupancy_pct": counts["occupancy_pct"],
        "spots": spot_list,
    }


def get_demo_facility() -> dict:
    """Find the demo facility by slug and return its Supabase row."""
    try:
        supabase = get_supabase()
        facility_result = (
            supabase.table("facilities")
            .select("*")
            .eq("slug", DEMO_FACILITY_SLUG)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    facilities = facility_result.data or []
    if not facilities:
        raise HTTPException(
            status_code=404,
            detail="Demo facility not found. Run POST /demo/seed first.",
        )

    return facilities[0]


def load_demo_occupancy() -> dict:
    """Read the demo facility and spot statuses from Supabase."""
    facility = get_demo_facility()

    try:
        supabase = get_supabase()
        spots_result = (
            supabase.table("parking_spots")
            .select("*")
            .eq("facility_id", facility["id"])
            .order("label")
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return build_occupancy_response(facility, spots_result.data or [])


def save_occupancy_event(occupancy: dict, source: str) -> None:
    """Store a simple history row for the latest occupancy reading."""
    supabase = get_supabase()
    supabase.table("occupancy_events").insert(
        {
            "facility_id": occupancy["lot_id"],
            "parking_spot_id": None,
            "status": None,
            "available_count": occupancy["available"],
            "occupied_count": occupancy["occupied"],
            "unknown_count": occupancy["unknown"],
            "capacity": occupancy["capacity"],
            "occupancy_pct": occupancy["occupancy_pct"],
            "source": source,
        }
    ).execute()


def update_facility_summary(facility_id: str, occupancy: dict) -> None:
    """Keep the facility summary fields in sync with spot statuses."""
    supabase = get_supabase()
    supabase.table("facilities").update(
        {
            "capacity": occupancy["capacity"],
            "status": get_facility_status(occupancy["occupancy_pct"]),
            "updated_at": utc_now(),
        }
    ).eq("id", facility_id).execute()


def set_random_spot_statuses(spots: list[dict]) -> None:
    """Randomly assign a new status to each parking spot."""
    supabase = get_supabase()
    for spot in spots:
        status = random.choices(SPOT_STATUSES, weights=[30, 65, 5], k=1)[0]
        confidence = round(random.uniform(0.85, 0.98), 2)
        if status == "unknown":
            confidence = round(random.uniform(0.25, 0.55), 2)

        supabase.table("parking_spots").update(
            {
                "status": status,
                "confidence": confidence,
                "updated_at": utc_now(),
            }
        ).eq("id", spot["id"]).execute()


@app.post("/demo/seed")
def seed_demo_data():
    """Create or reset sample Supabase data for OSU Parking Structure 1."""
    try:
        supabase = get_supabase()
        facility_result = (
            supabase.table("facilities")
            .select("*")
            .eq("slug", DEMO_FACILITY_SLUG)
            .limit(1)
            .execute()
        )
        facilities = facility_result.data or []

        if facilities:
            facility = facilities[0]
            supabase.table("facilities").update(
                {
                    "name": DEMO_FACILITY_NAME,
                    "location": DEMO_FACILITY_LOCATION,
                    "capacity": DEMO_CAPACITY,
                    "status": "busy",
                    "updated_at": utc_now(),
                }
            ).eq("id", facility["id"]).execute()
        else:
            insert_result = (
                supabase.table("facilities")
                .insert(
                    {
                        "slug": DEMO_FACILITY_SLUG,
                        "name": DEMO_FACILITY_NAME,
                        "location": DEMO_FACILITY_LOCATION,
                        "capacity": DEMO_CAPACITY,
                        "status": "busy",
                    }
                )
                .execute()
            )
            facility = insert_result.data[0]

        facility_id = facility["id"]
        supabase.table("parking_spots").delete().eq(
            "facility_id", facility_id
        ).execute()
        supabase.table("parking_spots").insert(get_demo_spots(facility_id)).execute()

        occupancy = load_demo_occupancy()
        update_facility_summary(facility_id, occupancy)
        save_occupancy_event(occupancy, source="demo_seed")
        return occupancy
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
def health():
    """Simple check that the API is running."""
    return {"ok": True, "service": "swiftpark-demo-api"}


@app.get("/demo/occupancy")
def get_demo_occupancy():
    """Return current occupancy data for the demo parking lot."""
    return load_demo_occupancy()


@app.post("/demo/simulate-detection")
def simulate_detection():
    """
    Pretend a new camera detection came in.

    For the demo, this randomly flips a few spot statuses in Supabase.
    """
    try:
        occupancy = load_demo_occupancy()
        set_random_spot_statuses(occupancy["spots"])
        updated_occupancy = load_demo_occupancy()
        update_facility_summary(updated_occupancy["lot_id"], updated_occupancy)
        save_occupancy_event(updated_occupancy, source="demo_simulation")
        return updated_occupancy
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ----------------------------------------------------------------------
# Brighton Zone 2 / Zone 3 mock data
# ----------------------------------------------------------------------
#
# Brighton Zone 1 is served live from the YOLO backend (`/status` on
# port 8001). Zones 2 and 3 are estimated/mock for the demo. They live
# in this same FastAPI process so the frontend can pick them up with the
# same /demo/* base URL used for OSU. The data is deterministic — we
# don't randomise here so simulations don't make Brighton's mock zones
# silently drift.

BRIGHTON_MOCK_ZONES = (
    {
        "level": "Z2",
        "label_prefix": "Z2",
        "capacity": 30,
        "occupied": 12,
        "unknown": 2,
        "confidence": 0.88,
    },
    {
        "level": "Z3",
        "label_prefix": "Z3",
        "capacity": 20,
        "occupied": 7,
        "unknown": 1,
        "confidence": 0.85,
    },
)


def _build_brighton_mock_spots() -> list[dict]:
    """Deterministic spot list for Brighton Zones 2 + 3."""
    spots: list[dict] = []
    for zone in BRIGHTON_MOCK_ZONES:
        capacity = int(zone["capacity"])
        occupied = min(int(zone["occupied"]), capacity)
        unknown = min(int(zone["unknown"]), max(capacity - occupied, 0))
        available = max(capacity - occupied - unknown, 0)
        statuses: list[str] = (
            ["available"] * available
            + ["occupied"] * occupied
            + ["unknown"] * unknown
        )[:capacity]
        for index, status in enumerate(statuses):
            label_num = f"{index + 1:03d}"
            confidence = (
                round(float(zone["confidence"]) - 0.4, 2)
                if status == "unknown"
                else float(zone["confidence"])
            )
            spots.append(
                {
                    "id": f"brighton-{zone['level'].lower()}-{label_num}",
                    "label": f"{zone['label_prefix']}-{label_num}",
                    "level": zone["level"],
                    "status": status,
                    "confidence": confidence,
                }
            )
    return spots


@app.get("/demo/brighton-mock-zones")
def get_brighton_mock_zones():
    """Return the Brighton Zone 2 + Zone 3 mock occupancy.

    Frontend `api.ts` fetches this in parallel with the YOLO
    `/status` (Zone 1 live) and stitches the two responses into a
    combined Brighton Occupancy. Zone 1 stays driven by the camera.
    """
    spots = _build_brighton_mock_spots()
    capacity = sum(int(z["capacity"]) for z in BRIGHTON_MOCK_ZONES)
    available = sum(1 for s in spots if s["status"] == "available")
    occupied = sum(1 for s in spots if s["status"] == "occupied")
    unknown = sum(1 for s in spots if s["status"] == "unknown")
    return {
        "zones": [
            {
                "level": zone["level"],
                "label_prefix": zone["label_prefix"],
                "capacity": int(zone["capacity"]),
                "occupied": int(zone["occupied"]),
                "unknown": int(zone["unknown"]),
                "confidence": float(zone["confidence"]),
            }
            for zone in BRIGHTON_MOCK_ZONES
        ],
        "capacity": capacity,
        "available": available,
        "occupied": occupied,
        "unknown": unknown,
        "spots": spots,
    }
