"""
camera.py
---------
Runs the parking detector continuously in a background thread.
Decouples the CV inference from the API layer so they don't block each other.

The CameraWorker:
  - Reads frames from a video file or IP camera stream
  - Runs the detector on each frame
  - Stores the latest OccupancySnapshot in memory
  - Notifies any active WebSocket connections when state updates
"""

import cv2
import threading
import asyncio
import json
from datetime import datetime, timezone
from typing import Optional, Callable
import sys
import os

# Add parent directory to path so we can import detector.py
cv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'cv')
sys.path.append(os.path.normpath(cv_path))


from detector import ParkingDetector
from models import OccupancySnapshot, SpotStatus, compute_status


class CameraWorker:
    """
    Runs in a background thread. Continuously reads frames and updates state.
    """

    def __init__(
        self,
        source: str,            # Vid file
        capacity: int = 100,
        model_path: str = "yolov8n.pt",
        confidence: float = 0.4,
        spots_config: Optional[list] = None,
        frame_skip: int = 2,    # Process every Nth frame
        loop_video: bool = True, # TODO Remove this in prod, loop video for testing
    ):
        self.source = source
        self.capacity = capacity
        self.frame_skip = frame_skip
        self.loop_video = loop_video

        # Detector defined in cv
        self.detector = ParkingDetector(
            model_path=model_path,
            capacity=capacity,
            confidence_threshold=confidence,
        )
        if spots_config:
            self.detector.load_spots(spots_config)

        # Shared state, written by background thread, read by API
        self._snapshot: Optional[OccupancySnapshot] = None
        self._lock = threading.Lock()
        self._running = False

        # WebSocket broadcast callback (set by main.py)
        self._on_update: Optional[Callable] = None

    