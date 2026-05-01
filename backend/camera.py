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


