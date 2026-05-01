"""
run.py
------
Run the parking detector on a video file.

Usage:
    python run.py --video parking_lot.mp4 --capacity 50
    python run.py --video parking_lot.mp4 --capacity 50 --spots spots.json
    python run.py --video parking_lot.mp4 --capacity 50 --save output.mp4
"""

import argparse
import json
import cv2
import sys
from detector import ParkingDetector


def parse_args():
    parser = argparse.ArgumentParser(description="Parking lot occupancy detector")
    parser.add_argument("--video",    required=True,          help="Path to input video file")
    parser.add_argument("--capacity", type=int, default=100,  help="Total parking spots in the lot")
    parser.add_argument("--model",    default="yolov8n.pt",   help="YOLO model weights file")
    parser.add_argument("--conf",     type=float, default=0.4,help="Detection confidence threshold")
    parser.add_argument("--spots",    default=None,           help="Path to spots JSON file (pro tier)")
    parser.add_argument("--save",     default=None,           help="Save annotated output to this path")
    parser.add_argument("--skip",     type=int, default=2,    help="Process every Nth frame (1 = all frames)")
    return parser.parse_args()


def main():
    args = parse_args()

    # --- Open video ---
    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        print(f"Error: Could not open video file: {args.video}")
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS)
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Video: {width}x{height} @ {fps:.1f} fps | {total_frames} frames")

    # --- Set up detector ---
    detector = ParkingDetector(
        model_path=args.model,
        capacity=args.capacity,
        confidence_threshold=args.conf,
    )

    # Load spot definitions if provided (pro tier)
    if args.spots:
        with open(args.spots) as f:
            spots_config = json.load(f)
        detector.load_spots(spots_config)

    # --- Optional video writer ---
    writer = None
    if args.save:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(args.save, fourcc, fps / args.skip, (width, height))
        print(f"Saving output to: {args.save}")

    # --- Main loop ---
    frame_idx = 0
    print("\nPress 'q' to quit, SPACE to pause\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
            # print("End of video.")
            # break

        frame_idx += 1

        # Skip frames for performance
        if frame_idx % args.skip != 0:
            continue

        # Run detection
        result = detector.process_frame(frame)

        # Print to console every 30 processed frames
        if (frame_idx // args.skip) % 30 == 0:
            print(
                f"Frame {frame_idx:5d} | "
                f"Vehicles: {result.smoothed_count:3d} | "
                f"Occupancy: {result.occupancy_pct * 100:.1f}%"
            )

        # Show in window
        cv2.imshow("Parking Detector", result.frame)

        if writer:
            writer.write(result.frame)

        # Keyboard controls
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            print("Quit by user.")
            break
        elif key == ord(" "):
            print("Paused. Press any key to continue.")
            cv2.waitKey(0)

    # --- Cleanup ---
    cap.release()
    if writer:
        writer.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
