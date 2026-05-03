## Phase 5: Brighton Ski Resort + YOLO Integration

We are starting Phase 5.

The completed Phase 4 OSU flow should be preserved:
Splash → Home → Garage Overview → Spot Visualization / Navigation → Parked Confirmation

New facility:
Brighton Ski Resort

Brighton is different from OSU:
- OSU = parking garage with levels
- Brighton = surface parking lot with zones
- Brighton has 3 zones
- Zone 1 uses YOLO/video-derived occupancy data
- Zones 2 and 3 use mock data for now

Important:
- Preserve the OSU flow.
- Preserve ParkingGarage3D for OSU.
- Do not try to make ParkingGarage3D support Brighton unless explicitly asked.
- Brighton should eventually have a separate surface-lot/zone visualization.
- Use the current Occupancy/Spot shape as the normalized frontend contract.

Backend context:
- OSU demo data comes from `/demo/occupancy`.
- YOLO/camera data comes from `/status`.
- WebSocket `/ws` exists but should not be used first.
- Use REST first.
- The YOLO data should be normalized into the same frontend Occupancy shape.

Phase 5 implementation principle:
Start with the data layer, not the visual layer.

Recommended sequence:
1. Facility metadata
2. Facility-aware API functions
3. Facility-aware occupancy cache
4. Brighton normalizer: Zone 1 YOLO + Zone 2/3 mock
5. Home screen shows both OSU and Brighton
6. Garage Overview supports Level vs Zone labels
7. Brighton surface-lot visualization
8. Optional WebSocket live updates later

Do not modify:
- detector.py
- run.py
- calibrate.py
- ParkingGarage3D
- carModelLoader
- backend camera loop
- Supabase secrets
- `.env`

Do not add:
- real GPS
- real maps
- auth
- payments
- cloud deployment
- Base44 SDK

When planning, explicitly mention:
- how OSU behavior stays unchanged
- how Brighton Zone 1 YOLO data is normalized
- how Zones 2 and 3 mock data are merged
- how Level vs Zone display labels are handled