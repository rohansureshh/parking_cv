# AI Model and Backend for SwiftPark

## Setup

```bash
pip install -r requirements.txt
```

YOLOv8 weights (`yolov8n.pt`) will download automatically on first run (~6MB).

---

## Run the Demo Backend on Windows

### 1. Install dependencies

From this repo folder in PowerShell:

```powershell
py -m venv venv
.\venv\Scripts\activate
py -m pip install -r requirements.txt
```

### 2. Create the Supabase tables

In Supabase, open the SQL Editor and run:

```sql
create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  location text,
  capacity integer not null,
  status text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists parking_spots (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  label text not null,
  level text,
  status text not null check (status in ('available', 'occupied', 'unknown')),
  confidence double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists occupancy_events (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  parking_spot_id uuid references parking_spots(id),
  status text check (status in ('available', 'occupied', 'unknown')),
  available_count integer not null,
  occupied_count integer not null,
  unknown_count integer not null,
  capacity integer not null,
  occupancy_pct double precision not null,
  source text not null,
  created_at timestamptz default now()
);
```

If you already created earlier demo tables, recreate or migrate those tables
first. `create table if not exists` will not change old columns.

### 3. Add backend environment variables

Create a local `.env` file. Use `.env.example` as the template:

```powershell
Copy-Item .env.example .env
notepad .env
```

Fill in:

```text
SUPABASE_URL=your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=your backend-only service role key
```

Do not put the service role key in a frontend app. It belongs only in this
backend `.env` file.

### 4. Start the backend

```powershell
py -m uvicorn api.main:app --reload
```

The API runs at:

```text
http://127.0.0.1:8000
```

### 5. Test the demo endpoints

In a second PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod -Method Post http://127.0.0.1:8000/demo/seed
Invoke-RestMethod http://127.0.0.1:8000/demo/occupancy
Invoke-RestMethod -Method Post http://127.0.0.1:8000/demo/simulate-detection
Invoke-RestMethod http://127.0.0.1:8000/demo/occupancy
```

The seed endpoint creates sample data for "OSU Parking Structure 1" in these
Supabase tables:

- `facilities`
- `parking_spots`
- `occupancy_events`

The demo uses `osu-structure-1` as the facility `slug`. Supabase generates the
UUID `id`, and the backend uses that UUID for `parking_spots.facility_id` and
`occupancy_events.facility_id`.

Parking spot availability is stored in `parking_spots.status` using:

- `available`
- `occupied`
- `unknown`

You can also try these GET endpoints in your browser:

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8000/demo/occupancy
```

This backend still does not run the YOLO detector from `detector.py` yet. For
the YC demo, `/demo/simulate-detection` pretends a camera detection happened by
randomly updating spot statuses in Supabase.

---

## Quick Start

### Lite tier - just count cars and get occupancy %

```bash
python run.py --video your_parking_lot.mp4 --capacity 50
```

This shows a live window with bounding boxes around detected cars and a HUD showing:
- Vehicles detected
- Available spots
- Occupancy %

### Pro tier - spot-level detection

First, run the calibration tool on your video to define each spot:
```bash
python calibrate.py --video your_parking_lot.mp4 --output spots.json
```

Draw a polygon around each empty parking spot (left click to add points, Enter to save a spot).

Then run with the spots file:
```bash
python run.py --video your_parking_lot.mp4 --capacity 50 --spots spots.json
```

Each spot will show green (open) or red (occupied).

---

## Options

| Flag         | Default       | Description                              |
|--------------|---------------|------------------------------------------|
| `--video`    | required      | Path to input video                      |
| `--capacity` | 100           | Total number of spots in the lot         |
| `--model`    | yolov8n.pt    | YOLO model (n=fast, s=balanced, m=accurate) |
| `--conf`     | 0.4           | Confidence threshold (0.0 - 1.0)         |
| `--spots`    | None          | Path to spots.json for pro tier          |
| `--save`     | None          | Save annotated video to this path        |
| `--skip`     | 2             | Process every Nth frame (higher = faster)|

---

## File Structure

```
parking_cv/
├── detector.py       # Core ParkingDetector class
├── run.py            # Video runner script
├── calibrate.py      # Spot calibration tool (pro tier)
├── requirements.txt
└── spots.json        # Generated by calibrate.py (pro tier)
```

---

## Next Steps

Once this pipeline is working, the next layer is:
1. Finetune model with parking garage datesets
2. A **FastAPI backend** that runs the detector and exposes occupancy data via REST/WebSocket
3. A **React frontend** with the map UI showing green/red spots or occupancy % per lot
