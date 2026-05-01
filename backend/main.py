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

