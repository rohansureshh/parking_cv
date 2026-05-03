# SwiftPark Codex Instructions

## Project summary

SwiftPark is a parking availability demo app.

Core idea:
SwiftPark uses existing parking garage camera footage and computer vision to detect whether parking spots are available, occupied, or unknown, then displays availability through a polished mobile-style web app.

## Current status

Phase 3C is complete and merged into main.

The current frontend includes:
- SwiftPark mobile-style UI
- 3D parking garage hero visualization
- external GLB car models
- floor selector
- selected spot panel
- Run Detection Simulation button
- FastAPI backend integration

## Current stack

Frontend:
- Vite
- React
- TypeScript
- plain CSS
- Three.js

Backend:
- FastAPI
- Supabase demo database

## Backend endpoints

Frontend should call FastAPI only.

Local backend:
http://127.0.0.1:8000

Endpoints:
- GET /health
- POST /demo/seed
- GET /demo/occupancy
- POST /demo/simulate-detection

Do not call Supabase directly from the frontend.
Do not expose Supabase keys in the frontend.

## Files/directories

Frontend:
- frontend/src/App.tsx
- frontend/src/index.css
- frontend/src/components/
- frontend/src/components/parking/ParkingGarage3D.tsx
- frontend/src/components/parking/carModelLoader.ts
- frontend/public/models/cars-bundle/

Backend:
- api/

Do not modify:
- detector.py
- run.py
- calibrate.py
- backend Supabase logic
- .env

unless explicitly asked.

## Phase 4 goal

Build the rest of the SwiftPark app flow around the existing hero screen.

Phase 4 should add a demo flow inspired by the original SwiftPark mockup:
1. Splash / loading screen
2. Home / map-style garage discovery screen
3. Garage overview/details screen
4. Spot visualization screen
5. Navigation-style screen
6. Parked confirmation screen

Important:
- This is a demo app, not a production mobile app.
- Use mock/static data where needed.
- Preserve the existing 3D spot visualization screen.
- Preserve FastAPI API integration.
- Do not add real maps, real GPS, auth, payments, or cloud deployment yet.

## UI style

Use the original SwiftPark mockup as visual direction:
- clean iPhone-style UI
- blue-and-white SwiftPark branding
- SwiftPark wordmark
- tagline: "Stress less. Park better."
- rounded cards
- subtle shadows
- polished mobile app feel
- investor/demo-ready

Status colors:
- available = blue
- occupied = red
- unknown = gray
- selected = bright blue

## Guardrails

Do not:
- use @base44/sdk
- add auth
- add payments
- add real maps or external map APIs
- add real GPS
- add cloud deployment
- expose Supabase keys
- rewrite the detector
- break the current 3D visualization
- commit generated files

Do not commit:
- .env
- frontend/.env.local
- frontend/node_modules/
- frontend/dist/
- frontend/.vite/
- design-reference/
- venv/
- __pycache__/
- *.pyc

## Build and test commands

Backend:

```powershell
.\venv\Scripts\Activate.ps1
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
curl.exe -X POST http://127.0.0.1:8000/demo/seed