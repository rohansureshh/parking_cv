"""
FastAPI backend for the parking lot occupancy system.

Endpoints:
  GET  /status      
  GET  /health          
  WS   /ws              

"""

import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from camera import CameraWorker
from models import OccupancySnapshot

# TODO hardcoded default global variables for now

VIDEO_SOURCE = os.getenv("VIDEO_SOURCE", "../assets/test2.mp4")   
LOT_CAPACITY = int(os.getenv("LOT_CAPACITY", "50"))
YOLO_MODEL   = os.getenv("YOLO_MODEL", "yolov8n.pt")
SPOTS_FILE   = os.getenv("SPOTS_FILE", "")               

# ------------------------------------------------------------------
# WebSocket connection manager
# Keeps track of all connected frontend clients
# ------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        print(f"WebSocket connected. Total clients: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)
        print(f"WebSocket disconnected. Total clients: {len(self.active)}")

    async def broadcast(self, data: str):
        """Send a message to all connected clients."""
        disconnected = []
        for ws in self.active:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.active.remove(ws)


manager = ConnectionManager()

# ------------------------------------------------------------------
# Camera worker setup
# ------------------------------------------------------------------

spots_config = None
if SPOTS_FILE and os.path.exists(SPOTS_FILE):
    import json as _json
    with open(SPOTS_FILE) as f:
        spots_config = _json.load(f)
    print(f"Loaded spots config: {SPOTS_FILE}")

worker = CameraWorker(
    source=VIDEO_SOURCE,
    capacity=LOT_CAPACITY,
    model_path=YOLO_MODEL,
    spots_config=spots_config,
)

def on_snapshot_update(snapshot: OccupancySnapshot):
    """Called by camera worker whenever a new snapshot is ready."""
    data = snapshot.model_dump_json()
    # Schedule the async broadcast from the sync thread
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast(data), loop)
    except RuntimeError:
        pass  # No event loop yet during startup

worker.set_update_callback(on_snapshot_update)

# ------------------------------------------------------------------
# App lifecycle
# ------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start camera worker when server starts
    worker.start()
    yield
    # Stop when server shuts down
    worker.stop()


app = FastAPI(
    title="Parking Lot Occupancy API",
    version="0.1.0",
    lifespan=lifespan,
)

# Use cors to allow requests from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# REST Endpoints
# ------------------------------------------------------------------

@app.get("/health")
def health():
    """Quick check that the server and camera worker are running."""
    snapshot = worker.get_snapshot()
    return {
        "server": "ok",
        "camera": "ok" if snapshot else "initializing",
    }


@app.get("/status", response_model=OccupancySnapshot)
def get_status():
    """
    Returns the latest occupancy snapshot.
    Call this once when the frontend loads to get the current state.
    """
    snapshot = worker.get_snapshot()
    if snapshot is None:
        raise HTTPException(status_code=503, detail="Camera worker is still initializing")
    return snapshot


# ------------------------------------------------------------------
# WebSocket Endpoint
# ------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Connect here to receive live occupancy updates as they happen

    Each message is a JSON-serialized OccupancySnapshot.

    The frontend connects once and receives updates pushed from the server,
    rather than polling /status repeatedly.
    """
    await manager.connect(websocket)

    # Send the current state immediately on connect
    snapshot = worker.get_snapshot()
    if snapshot:
        await websocket.send_text(snapshot.model_dump_json())

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)