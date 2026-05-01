"""
detector.py
-----------
Core car detection and counting pipeline using YOLOv8.
Handles both occupancy counting (lite tier) and spot-level detection (pro tier).
"""

import cv2
import numpy as np
from ultralytics import YOLO
from dataclasses import dataclass, field
from collections import deque
from typing import Optional

# YOLO class index for 'car' in the COCO dataset
# Also includes truck (7), bus (5) if you want to count all vehicles
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


@dataclass
class ParkingSpot:
    """Represents a single defined parking spot (pro tier)."""
    spot_id: str
    polygon: np.ndarray          # Shape: (N, 2) array of (x, y) points
    is_occupied: bool = False


@dataclass
class DetectionResult:
    """Output from a single frame of inference."""
    frame: np.ndarray            # Annotated frame for display/streaming
    car_count: int               # Number of cars detected in the frame
    smoothed_count: int          # Smoothed count to reduce flickering
    occupancy_pct: float         # 0.0 - 1.0, requires capacity to be set
    spots: list[ParkingSpot] = field(default_factory=list)  # Pro tier only


class ParkingDetector:
    """
    Detects cars in video frames and determines parking occupancy.

    Usage (lite tier - just counting):
        detector = ParkingDetector(capacity=50)
        result = detector.process_frame(frame)
        print(result.occupancy_pct)

    Usage (pro tier - spot level):
        detector = ParkingDetector(capacity=50)
        detector.load_spots("spots.json")
        result = detector.process_frame(frame)
        for spot in result.spots:
            print(spot.spot_id, spot.is_occupied)
    """

    def __init__(
        self,
        model_path: str = "yolov8n.pt",   # nano = fastest and most accurate
        capacity: int = 100,               # Total number of spots in the lot
        confidence_threshold: float = 0.4,
        smoothing_window: int = 30,         # Frames to average for count smoothing
        iou_threshold: float = 0.15,        # Overlap needed to mark a spot occupied
    ):
        print(f"Loading YOLO model: {model_path}")
        self.model = YOLO(model_path)
        self.capacity = capacity
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold

        # Rolling window for count smoothing (prevents flickering)
        self._count_history: deque = deque(maxlen=smoothing_window)

        # Pro tier: defined parking spots
        self.spots: list[ParkingSpot] = []

    # ------------------------------------------------------------------
    # Spot management (pro tier)
    # ------------------------------------------------------------------

    def load_spots(self, spots_config: list[dict]):
        """
        Load parking spot definitions from a list of dicts.
        Each dict: { "id": "A1", "polygon": [[x1,y1], [x2,y2], ...] }
        """
        self.spots = [
            ParkingSpot(
                spot_id=s["id"],
                polygon=np.array(s["polygon"], dtype=np.int32)
            )
            for s in spots_config
        ]
        print(f"Loaded {len(self.spots)} parking spots")

    # ------------------------------------------------------------------
    # Core inference
    # ------------------------------------------------------------------

    def process_frame(self, frame: np.ndarray) -> DetectionResult:
        """Run inference on a single frame and return detection results."""
        results = self.model(frame, verbose=False)[0]

        # Filter to vehicle classes above confidence threshold
        car_boxes = []
        for box in results.boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            if cls in VEHICLE_CLASSES and conf >= self.confidence_threshold:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                car_boxes.append((x1, y1, x2, y2))

        # Smooth the count
        self._count_history.append(len(car_boxes))
        smoothed = int(round(sum(self._count_history) / len(self._count_history)))

        # Occupancy percentage
        occupancy_pct = min(smoothed / self.capacity, 1.0) if self.capacity > 0 else 0.0

        # Pro tier: check each defined spot
        if self.spots:
            self._update_spot_occupancy(car_boxes)

        # Draw annotations on frame
        annotated = self._draw_annotations(frame.copy(), car_boxes, smoothed, occupancy_pct)

        return DetectionResult(
            frame=annotated,
            car_count=len(car_boxes),
            smoothed_count=smoothed,
            occupancy_pct=occupancy_pct,
            spots=list(self.spots),
        )

    # ------------------------------------------------------------------
    # Spot occupancy check via IoU
    # ------------------------------------------------------------------

    def _update_spot_occupancy(self, car_boxes: list[tuple]):
        """Check each spot against detected car bounding boxes."""
        for spot in self.spots:
            spot.is_occupied = False
            spot_rect = cv2.boundingRect(spot.polygon)  # (x, y, w, h)
            sx, sy, sw, sh = spot_rect

            for (cx1, cy1, cx2, cy2) in car_boxes:
                iou = self._compute_iou(
                    (sx, sy, sx + sw, sy + sh),
                    (cx1, cy1, cx2, cy2)
                )
                if iou >= self.iou_threshold:
                    spot.is_occupied = True
                    break

    @staticmethod
    def _compute_iou(box_a: tuple, box_b: tuple) -> float:
        """
        Compute Intersection over Union between two boxes.
        Each box: (x1, y1, x2, y2)
        """
        ax1, ay1, ax2, ay2 = box_a
        bx1, by1, bx2, by2 = box_b

        inter_x1 = max(ax1, bx1)
        inter_y1 = max(ay1, by1)
        inter_x2 = min(ax2, bx2)
        inter_y2 = min(ay2, by2)

        inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
        if inter_area == 0:
            return 0.0

        area_a = (ax2 - ax1) * (ay2 - ay1)
        area_b = (bx2 - bx1) * (by2 - by1)
        union_area = area_a + area_b - inter_area

        return inter_area / union_area if union_area > 0 else 0.0

    # ------------------------------------------------------------------
    # Visualization
    # ------------------------------------------------------------------

    def _draw_annotations(
        self,
        frame: np.ndarray,
        car_boxes: list[tuple],
        smoothed_count: int,
        occupancy_pct: float,
    ) -> np.ndarray:
        """Draw bounding boxes, spot overlays, and HUD onto the frame."""

        # Draw car bounding boxes
        for (x1, y1, x2, y2) in car_boxes:
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # Draw parking spot polygons (pro tier)
        for spot in self.spots:
            color = (0, 0, 255) if spot.is_occupied else (0, 255, 0)  # red / green
            cv2.polylines(frame, [spot.polygon], isClosed=True, color=color, thickness=2)
            cx = int(spot.polygon[:, 0].mean())
            cy = int(spot.polygon[:, 1].mean())
            cv2.putText(frame, spot.spot_id, (cx - 10, cy),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

        # HUD overlay
        occupied = smoothed_count
        available = max(self.capacity - occupied, 0)
        pct_label = f"{occupancy_pct * 100:.0f}%"

        # Color the HUD based on occupancy
        if occupancy_pct < 0.6:
            hud_color = (0, 200, 0)    # green
        elif occupancy_pct < 0.85:
            hud_color = (0, 165, 255)  # orange
        else:
            hud_color = (0, 0, 255)    # red

        cv2.rectangle(frame, (10, 10), (300, 100), (0, 0, 0), -1)  # black background
        cv2.putText(frame, f"Vehicles detected: {occupied}", (20, 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        cv2.putText(frame, f"Available spots:   {available}/{self.capacity}", (20, 58),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        cv2.putText(frame, f"Occupancy: {pct_label}", (20, 81),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)

        return frame
