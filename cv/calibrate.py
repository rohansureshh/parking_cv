"""
calibrate.py
------------
One-time tool to define parking spot polygons on a still frame.
Saves spot definitions to spots.json which is loaded by run.py.

Controls:
  - Left click: add a point to the current polygon
  - Right click / Enter: finish current polygon (saves the spot)
  - 'u': undo last point
  - 'd': delete last completed spot
  - 's': save all spots to file and exit
  - 'q': quit without saving

Usage:
    python calibrate.py --video parking_lot.mp4 --output spots.json
    python calibrate.py --image parking_lot_frame.jpg --output spots.json
"""

import argparse
import json
import cv2
import numpy as np
import sys


def parse_args():
    parser = argparse.ArgumentParser(description="Parking spot calibration tool")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--video", help="Path to video (uses first frame)")
    group.add_argument("--image", help="Path to still image")
    parser.add_argument("--output", default="spots.json", help="Output JSON file for spot definitions")
    return parser.parse_args()


class SpotCalibrator:
    def __init__(self, frame: np.ndarray, output_path: str):
        self.base_frame = frame.copy()
        self.output_path = output_path
        self.completed_spots: list[dict] = []
        self.current_points: list[tuple] = []
        self.spot_counter = 1

    def _get_spot_id(self) -> str:
        return f"S{self.spot_counter:02d}"

    def _draw(self):
        frame = self.base_frame.copy()

        # Draw completed spots
        for spot in self.completed_spots:
            pts = np.array(spot["polygon"], dtype=np.int32)
            cv2.polylines(frame, [pts], isClosed=True, color=(0, 255, 0), thickness=2)
            cx = int(pts[:, 0].mean())
            cy = int(pts[:, 1].mean())
            cv2.putText(frame, spot["id"], (cx - 10, cy),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        # Draw current in-progress polygon
        for pt in self.current_points:
            cv2.circle(frame, pt, 4, (0, 165, 255), -1)
        if len(self.current_points) > 1:
            cv2.polylines(frame, [np.array(self.current_points, dtype=np.int32)],
                          isClosed=False, color=(0, 165, 255), thickness=2)

        # Instructions overlay
        instructions = [
            "Left click: add point",
            "Enter / Right click: finish spot",
            "'u': undo last point",
            "'d': delete last spot",
            f"'s': save ({len(self.completed_spots)} spots saved)",
            "'q': quit without saving",
        ]
        for i, line in enumerate(instructions):
            cv2.putText(frame, line, (10, 20 + i * 22),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

        cv2.imshow("Calibration", frame)

    def _on_mouse(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            self.current_points.append((x, y))
            self._draw()
        elif event == cv2.EVENT_RBUTTONDOWN:
            self._finish_spot()

    def _finish_spot(self):
        if len(self.current_points) < 3:
            print("Need at least 3 points to define a spot. Keep clicking.")
            return
        spot = {
            "id": self._get_spot_id(),
            "polygon": self.current_points.copy()
        }
        self.completed_spots.append(spot)
        print(f"  Spot {spot['id']} saved with {len(self.current_points)} points")
        self.spot_counter += 1
        self.current_points = []
        self._draw()

    def run(self):
        cv2.namedWindow("Calibration")
        cv2.setMouseCallback("Calibration", self._on_mouse)
        self._draw()

        while True:
            key = cv2.waitKey(0) & 0xFF

            if key == 13 or key == 10:  # Enter
                self._finish_spot()

            elif key == ord("u"):       # Undo last point
                if self.current_points:
                    self.current_points.pop()
                    self._draw()

            elif key == ord("d"):       # Delete last completed spot
                if self.completed_spots:
                    removed = self.completed_spots.pop()
                    self.spot_counter -= 1
                    print(f"  Deleted spot {removed['id']}")
                    self._draw()

            elif key == ord("s"):       # Save and exit
                self._save()
                break

            elif key == ord("q"):       # Quit without saving
                print("Quit without saving.")
                break

        cv2.destroyAllWindows()

    def _save(self):
        with open(self.output_path, "w") as f:
            json.dump(self.completed_spots, f, indent=2)
        print(f"\nSaved {len(self.completed_spots)} spots to {self.output_path}")


def main():
    args = parse_args()

    if args.video:
        cap = cv2.VideoCapture(args.video)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            print(f"Error: Could not read frame from {args.video}")
            sys.exit(1)
    else:
        frame = cv2.imread(args.image)
        if frame is None:
            print(f"Error: Could not load image {args.image}")
            sys.exit(1)

    print("Calibration tool ready.")
    print("Draw polygons around each empty parking spot.")
    calibrator = SpotCalibrator(frame, args.output)
    calibrator.run()


if __name__ == "__main__":
    main()
