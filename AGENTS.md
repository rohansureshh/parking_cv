## Phase 5: Brighton Ski Resort + YOLO Integration

We are starting Phase 5.

Goal:
Add a second facility called Brighton Ski Resort while preserving the completed OSU Parking Structure 1 flow.

Current completed OSU flow:
Splash → Home → Garage Overview → Spot Visualization / Navigation → Parked Confirmation

Brighton requirements:
- Brighton Ski Resort is a surface parking lot, not a parking garage.
- Brighton has 3 zones.
- Zone 1 should use YOLO/video-derived occupancy data from the new backend.
- Zones 2 and 3 should use mock data for now.
- Brighton should eventually use a surface-lot visualization, not ParkingGarage3D.
- OSU should continue using the existing ParkingGarage3D garage visualization.

Important backend context:
- Existing OSU demo API uses `/demo/occupancy` and `/demo/simulate-detection`.
- New YOLO/camera backend exposes `/status` and `/ws`.
- The new backend models mostly match the frontend Occupancy and Spot shapes.
- The API endpoints are different, so `frontend/src/lib/api.ts` needs to become facility-aware.

Implementation direction:
- Start with frontend facility-aware API/cache plumbing.
- Do not merge or rewrite backend apps in the first step.
- Use REST `/status` first for Brighton Zone 1.
- Do not add WebSocket integration yet.
- Keep OSU behavior unchanged.
- Cache occupancy by facility slug, not one global cache.
- Keep `Spot.level` as the grouping field.
- For OSU, display `level` as Level.
- For Brighton, display `level` as Zone.

Recommended first implementation:
1. Add facility metadata.
2. Update API functions to accept a facility slug.
3. Update occupancy cache to cache by facility slug.
4. Add Brighton normalizer that combines:
   - Zone 1 from YOLO `/status`
   - Zone 2 mock data
   - Zone 3 mock data
5. Keep existing OSU UI/flow unchanged during the foundation step.

Do not touch unless explicitly asked:
- `ParkingGarage3D`
- `carModelLoader`
- `cv/detector.py`
- `run.py`
- `calibrate.py`
- backend camera loop
- Supabase secrets
- `.env`

Do not add:
- real maps
- real GPS
- auth
- payments
- cloud deployment
- `@base44/sdk`

Validation:
- Ensure existing OSU flow still works.
- Run frontend typecheck/build:
  - `cd frontend`
  - `npx tsc -b`
  - `npx vite build`