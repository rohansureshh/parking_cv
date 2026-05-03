# SwiftPark Claude Instructions

## Current branch

We are working on `phase-4-claude-redesign`.

We are restarting Phase 4 from the current main branch.

The previous Codex Phase 4A implementation was rejected visually. It created a rough app flow, but the UI quality was poor and did not match the original SwiftPark mockup closely enough.

Do not use the Codex Phase 4A screens as the visual standard.

## Current good baseline

The current main branch has the approved Phase 3C hero screen:

- polished Spot Visualization screen
- SwiftPark branding
- 3D parking garage hero visualization
- external GLB car models
- floor selector
- selected spot flow
- Run Detection Simulation button
- FastAPI-only frontend integration

Preserve this existing Phase 3C Spot Visualization screen.

## Product flow we want

The target app flow is:

Splash → Home / map-style screen → Garage Overview → Spot Visualization → Navigation → Parked Confirmation

Build this flow one polished screen at a time.

## Visual direction

Use the original SwiftPark multi-screen mockup as the primary design reference.

The app should feel:
- polished
- iPhone-style
- blue-and-white
- clean and premium
- investor/demo-ready
- close to the original SwiftPark mockup

Branding:
- SwiftPark wordmark
- “Swift” in dark text
- “Park” in blue
- tagline: “Stress less. Park better.”
- blue parking pin / P icon style

## Important constraints

Do not modify:
- detector.py
- run.py
- calibrate.py
- backend Python
- Supabase logic
- .env

Do not add:
- real maps
- real GPS
- auth
- payments
- cloud deployment
- @base44/sdk

Do not expose Supabase keys in the frontend.

Frontend should call FastAPI only.

Backend local URL:
http://127.0.0.1:8000

Current backend endpoints:
- GET /health
- POST /demo/seed
- GET /demo/occupancy
- POST /demo/simulate-detection

## Build approach

Build one screen at a time.

Do not build the full Phase 4 flow in one giant pass.

Start with:
1. Splash screen
2. Home screen
3. Garage Overview screen
4. Navigation screen
5. Parked Confirmation screen
6. Final flow wiring and polish