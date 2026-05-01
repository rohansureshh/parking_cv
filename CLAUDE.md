# SwiftPark Project Context

SwiftPark is a YC demo prototype for a computer vision parking availability startup.

## Core idea

SwiftPark uses existing parking garage camera footage and computer vision to detect which parking spots are available, occupied, or unknown.

The demo should show:
- a polished frontend dashboard
- live/demo occupancy data
- a 2.5D parking spot visualization
- data updating through the FastAPI backend

## Current repo

The original repo contains:
- detector.py: YOLOv8-based parking detector
- run.py: runs detector on videos
- calibrate.py: creates spot polygons
- test videos

Do not modify detector.py, run.py, or calibrate.py unless explicitly asked.

## Backend

We already have a FastAPI backend.

Current endpoints:
- GET /health
- POST /demo/seed
- GET /demo/occupancy
- POST /demo/simulate-detection

Backend local URL:
http://127.0.0.1:8000

Frontend should call FastAPI only.

Do not put Supabase keys in the frontend.

## Supabase schema

facilities:
- id uuid
- slug text
- name text
- location text
- capacity int
- status text
- created_at
- updated_at

parking_spots:
- id uuid
- facility_id uuid
- label text
- level text
- status text: "available", "occupied", or "unknown"
- confidence float
- created_at
- updated_at

occupancy_events:
- id uuid
- facility_id uuid
- parking_spot_id uuid nullable
- status text nullable
- available_count int
- occupied_count int
- unknown_count int
- capacity int
- occupancy_pct float
- source text
- created_at

## Frontend goal

Build Step 13: a polished mobile-style web frontend.

Design direction:
- SwiftPark branding
- tagline: "Stress less. Park better."
- blue primary color
- white/light gray background
- modern rounded cards
- available = blue
- occupied = red
- unknown = gray
- professional startup / B2B SaaS feel
- centered phone-style layout on desktop
- full width on mobile

## Scope

Build:
- single-page frontend
- garage overview
- stats card
- by-level availability
- 2.5D spot map
- clickable available spots
- selected spot panel
- "Select Spot" confirmation
- "Run Detection Simulation" button
- smooth spot animations

Do not build:
- full 3D garage
- real GPS
- Google Maps / Mapbox
- real navigation
- authentication
- payments
- cloud deployment
- native mobile app

## Important UX wording

Use "Select Spot", not "Reserve Spot".

Reservations imply a real transactional reservation system, which we are not building yet.