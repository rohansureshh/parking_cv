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
from models import OccupancySnapshot, SpotStatus, compute_facility_status


class CameraWorker:
    """
    Runs in a background thread. Continuously reads frames and updates state.
    """

    def __init__(
        self,
        source: str,            # Vid file
        capacity: int = 100,
        model_path: str = "yolov8n.pt",
        confidence: float = 0.14,
        spots_config: Optional[list] = None,
        frame_skip: int = 6,    # Process every Nth frame
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
            smoothing_window=30,
        )
        if spots_config:
            self.detector.load_spots(spots_config)

        # Shared state, written by background thread, read by API
        self._snapshot: Optional[OccupancySnapshot] = None
        self._lock = threading.Lock()
        self._running = False

        # WebSocket broadcast callback (set by main.py)
        self._on_update: Optional[Callable] = None

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def set_update_callback(self, callback: Callable):
        """Register a callback that fires whenever a new snapshot is ready."""
        self._on_update = callback

    def get_snapshot(self) -> Optional[OccupancySnapshot]:
        """Thread-safe read of the latest snapshot."""
        with self._lock:
            return self._snapshot

    def start(self):
        """Start the background detection thread."""
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        print(f"Camera worker started: {self.source}")

    def stop(self):
        """Stop the background thread."""
        self._running = False

    # ------------------------------------------------------------------
    # Background thread
    # ------------------------------------------------------------------

    def _run(self):

        
        while self._running:
            cap = cv2.VideoCapture(self.source)
            if not cap.isOpened():
                print(f"ERROR: Could not open video source: {self.source}")
                return

            frame_idx = 0
            while self._running:
                ret, frame = cap.read()

                if not ret:
                    # End of video file
                    if self.loop_video:
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # rewind
                        continue
                    else:
                        print("Video ended.")
                        self._running = False
                        break

                frame_idx += 1
                if frame_idx % self.frame_skip != 0:
                    continue

                # Run detection
                result = self.detector.process_frame(frame)

                # Show debug window
                cv2.imshow("SwiftPark - Debug Feed", result.frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    self._running = False


                # status=compute_facility_status(result.occupancy_pct),

                # Build snapshot
                snapshot = OccupancySnapshot(
                    lot_id="lot_1",
                    lot_slug="lot-1",
                    lot_name="Demo Parking Lot",
                    location="123 Main St",
                    facility_status=compute_facility_status(result.occupancy_pct),
                    timestamp=datetime.now(timezone.utc),
                    capacity=self.capacity,
                    available=max(self.capacity - result.smoothed_count, 0),
                    occupied=result.smoothed_count,
                    unknown=0,
                    occupancy_pct=round(result.occupancy_pct, 3),
                    spots=[
                        SpotStatus(
                            id=s.spot_id,
                            label=s.spot_id,
                            level="1",
                            status="occupied" if s.is_occupied else "available",
                            confidence=1.0,
                        )
                        for s in result.spots
                    ],
                )

                # Write snapshot (thread-safe)
                with self._lock:
                    self._snapshot = snapshot

                # Notify WebSocket subscribers
                if self._on_update:
                    self._on_update(snapshot)

            cap.release()
            cv2.destroyAllWindows()