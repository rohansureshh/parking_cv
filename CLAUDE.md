# SwiftPark Claude Instructions

## Current branch

We are working on the `ui-revamp-base44-3d` branch.

The previous dashboard-style frontend was not approved. The new goal is to build a polished mobile-app-style SwiftPark UI using the Base44 export as a design and component reference.

## Project summary

SwiftPark uses existing parking garage camera footage and computer vision to detect which parking spots are available, occupied, or unknown.

The frontend should show:
- a polished mobile-app experience
- SwiftPark branding
- tagline: "Stress less. Park better."
- garage availability
- selected floor
- 3D or high-quality 2.5D parking spot visualization
- selected spot flow
- detection simulation updates

## Existing repo

The original repo contains:
- detector.py: YOLOv8-based parking detector
- run.py: runs detector on videos
- calibrate.py: creates spot polygons
- test videos

Do not modify:
- detector.py
- run.py
- calibrate.py

unless explicitly asked.

## Backend

The backend is FastAPI and Supabase-backed.

Frontend should call FastAPI only.

Do not call Supabase directly from the frontend.
Do not expose Supabase keys in the frontend.

Backend local URL:
http://127.0.0.1:8000

Current endpoints:
- GET /health
- POST /demo/seed
- GET /demo/occupancy
- POST /demo/simulate-detection

## Supabase data shape

Parking spots have:
- id
- label
- level
- status: "available", "occupied", or "unknown"
- confidence

## Base44 reference

Use the Base44 export only as a design/component reference.

Important reference:
- design-reference/base44/src/components/parking/ParkingGarage3D.jsx

Useful references:
- SpotVisualization.jsx for mobile app layout
- Splash.jsx for branding direction
- ParkingConfirmation.jsx for confirmation styling
- FloorAvailability.jsx for floor selector/list ideas

Do not import the entire Base44 app blindly.

Do not use:
- @base44/sdk
- Base44 auth
- protected routes
- maps
- navigation
- payments
- cloud deployment

## UI direction

The new UI should feel like:
- a real mobile parking app
- iPhone-style
- polished and investor-ready
- clean blue-and-white SwiftPark theme
- premium smart mobility product
- not an admin dashboard

Branding:
- App name: SwiftPark
- Tagline: "Stress less. Park better."
- Primary color: blue
- Available = blue
- Occupied = red
- Unknown = gray
- Selected = bright blue glow/highlight

## 3D visualization direction

For this branch, a lightweight Three.js-based 3D parking visualization is allowed and encouraged.

Goal:
- use the Base44 ParkingGarage3D concept
- adapt it to our backend spot data
- show one selected floor at a time
- support floor selection
- occupied spots should show sleek simplified futuristic car models
- car models should look refined, not like basic blocks
- available spots should be clearly selectable
- selected spots should glow/highlight

If true 3D becomes unstable, fall back to a very polished 2.5D version, but do not revert to the old admin-style dashboard.

## Scope

Build:
- mobile app shell
- header/branding
- garage summary
- floor selector
- 3D/premium parking visualization
- selected spot panel
- "Select Spot" confirmation
- "Run Detection Simulation" button

Do not build:
- real GPS
- Google Maps / Mapbox
- real navigation
- auth
- payments
- cloud deployment
- native mobile app
- production reservation system

## UX wording

Use "Select Spot", not "Reserve Spot".

Reservations imply a transactional feature we have not built yet.