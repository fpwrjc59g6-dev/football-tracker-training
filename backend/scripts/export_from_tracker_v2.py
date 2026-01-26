"""
Export script to convert football_tracker_v2 output to annotation tool import format.

This script converts the Python dataclass objects from football_tracker_v2
into JSON format that can be imported into the annotation tool.

Usage:
    python -m scripts.export_from_tracker_v2 --output /path/to/output.json
"""

import argparse
import json
import sys
from pathlib import Path
from dataclasses import asdict
from typing import Dict, Any, List, Optional

# Add football_tracker_v2 to path
TRACKER_V2_PATH = Path(__file__).parent.parent.parent.parent / "football_tracker_v2"
sys.path.insert(0, str(TRACKER_V2_PATH))

try:
    from football_tracker_v2.models import (
        Match, Team, Player, Track, TrackPoint,
        Event, PassEvent, ShotEvent, TackleEvent,
        InterceptionEvent, ClearanceEvent, DuelEvent, SprintEvent, PressingEvent,
        Calibration, Keypoint,
    )
    from football_tracker_v2.models.tracking import BallTrack
    TRACKER_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import football_tracker_v2 models: {e}")
    TRACKER_AVAILABLE = False


def dataclass_to_dict(obj) -> Dict[str, Any]:
    """Convert a dataclass to dictionary, handling nested objects."""
    if obj is None:
        return None

    if hasattr(obj, '__dataclass_fields__'):
        result = {}
        for field_name in obj.__dataclass_fields__:
            value = getattr(obj, field_name)
            result[field_name] = dataclass_to_dict(value)
        return result

    if isinstance(obj, list):
        return [dataclass_to_dict(item) for item in obj]

    if hasattr(obj, 'value'):  # Enum
        return obj.value

    return obj


def convert_track(track: 'Track') -> Dict[str, Any]:
    """Convert a Track object to import format."""
    points = []
    for point in track.points:
        point_data = {
            "frame_number": point.frame_number,
            "timestamp": point.timestamp,
            "bbox": {
                "x": point.bbox.x,
                "y": point.bbox.y,
                "width": point.bbox.width,
                "height": point.bbox.height,
            },
            "confidence": point.confidence,
        }

        if point.pitch_position:
            point_data["pitch_x"] = point.pitch_position.x
            point_data["pitch_y"] = point.pitch_position.y

        points.append(point_data)

    return {
        "track_id": track.track_id,
        "team": track.team,
        "detection_class": "player",  # Default, can be enhanced
        "jersey_number": None,  # Would need jersey recognition
        "confidence": track.identity_confidence,
        "start_frame": track.start_frame,
        "end_frame": track.end_frame,
        "points": points,
    }


def convert_event(event: 'Event') -> Dict[str, Any]:
    """Convert an Event object to import format."""
    event_data = {
        "event_type": event.event_type.value if hasattr(event.event_type, 'value') else str(event.event_type),
        "frame_number": event.frame_number,
        "frame_end": event.frame_number,  # Events are typically single-frame
        "player_track_id": event.player_id,
        "half": event.half,
        "confidence": 0.5,  # Default confidence for detected events
    }

    if event.pitch_position:
        event_data["start_x"] = event.pitch_position.x
        event_data["start_y"] = event.pitch_position.y

    # Handle specific event types
    if isinstance(event, PassEvent):
        event_data["target_track_id"] = event.receiver_id
        event_data["is_successful"] = event.is_successful
        event_data["under_pressure"] = event.under_pressure
        event_data["body_part"] = event.body_part
        if event.start_position:
            event_data["start_x"] = event.start_position.x
            event_data["start_y"] = event.start_position.y
        if event.end_position:
            event_data["end_x"] = event.end_position.x
            event_data["end_y"] = event.end_position.y

    elif isinstance(event, ShotEvent):
        event_data["is_successful"] = event.outcome.value == "goal" if hasattr(event.outcome, 'value') else False
        event_data["body_part"] = event.body_part

    elif isinstance(event, TackleEvent):
        event_data["opponent_track_id"] = event.opponent_id
        event_data["is_successful"] = event.is_successful

    elif isinstance(event, InterceptionEvent):
        event_data["is_successful"] = True  # Interception is inherently successful

    return event_data


def convert_calibration(calibration: 'Calibration') -> Dict[str, Any]:
    """Convert a Calibration object to import format."""
    points = []
    for keypoint in calibration.keypoints:
        points.append({
            "type": keypoint.name,
            "pixel_x": keypoint.pixel_coords[0] if keypoint.pixel_coords else 0,
            "pixel_y": keypoint.pixel_coords[1] if keypoint.pixel_coords else 0,
            "pitch_x": keypoint.world_coords[0] if keypoint.world_coords else 0,
            "pitch_y": keypoint.world_coords[1] if keypoint.world_coords else 0,
        })

    return {
        "pitch_length": 105.0,
        "pitch_width": 68.0,
        "homography_matrix": calibration.homography.matrix.tolist() if calibration.homography else None,
        "points": points,
    }


def convert_match_data(
    home_team: 'Team',
    away_team: 'Team',
    tracks: List['Track'],
    events: List['Event'],
    calibration: Optional['Calibration'] = None,
    ball_track: Optional['BallTrack'] = None,
    match_date: str = None,
    fps: float = 25.0,
    total_frames: int = 0,
) -> Dict[str, Any]:
    """Convert full match data to import format."""

    result = {
        "home_team": {
            "name": home_team.name if home_team else "Home Team",
            "primary_color": home_team.kit_color if home_team else "#FF0000",
            "secondary_color": "#FFFFFF",
        },
        "away_team": {
            "name": away_team.name if away_team else "Away Team",
            "primary_color": away_team.kit_color if away_team else "#0000FF",
            "secondary_color": "#FFFFFF",
        },
        "match_date": match_date or "2024-01-01",
        "fps": fps,
        "total_frames": total_frames,
        "video_width": 1920,
        "video_height": 1080,
    }

    # Convert tracks
    if tracks:
        result["tracks"] = [convert_track(t) for t in tracks]

    # Convert events
    if events:
        result["events"] = [convert_event(e) for e in events]

    # Convert calibration
    if calibration:
        result["calibration"] = convert_calibration(calibration)

    # Convert ball positions
    if ball_track and ball_track.points:
        result["ball_positions"] = []
        for point in ball_track.points:
            ball_data = {
                "frame_number": point.frame_number,
                "timestamp": point.timestamp,
                "x": point.bbox.x + point.bbox.width // 2,
                "y": point.bbox.y + point.bbox.height // 2,
                "confidence": point.confidence,
                "is_visible": True,
            }
            if point.pitch_position:
                ball_data["pitch_x"] = point.pitch_position.x
                ball_data["pitch_y"] = point.pitch_position.y
            result["ball_positions"].append(ball_data)

    return result


def create_demo_export():
    """Create a demo export with realistic sample data."""
    return {
        "home_team": {
            "name": "Seekirchen",
            "primary_color": "#E31937",
            "secondary_color": "#FFFFFF"
        },
        "away_team": {
            "name": "Bischofshofen",
            "primary_color": "#002B5C",
            "secondary_color": "#FFD700"
        },
        "match_date": "2024-01-15",
        "competition": "Salzburg Liga",
        "venue": "Seekirchen Stadium",
        "fps": 25.0,
        "total_frames": 135000,
        "video_width": 1920,
        "video_height": 1080,
        "calibration": {
            "pitch_length": 105.0,
            "pitch_width": 68.0,
            "homography_matrix": [
                [0.15, 0.0, -50],
                [0.0, 0.15, -30],
                [0.0, 0.0, 1.0]
            ],
            "points": [
                {"type": "center_spot", "pixel_x": 960, "pixel_y": 540, "pitch_x": 52.5, "pitch_y": 34.0},
                {"type": "left_corner", "pixel_x": 100, "pixel_y": 900, "pitch_x": 0.0, "pitch_y": 0.0},
                {"type": "right_corner", "pixel_x": 1820, "pixel_y": 900, "pitch_x": 105.0, "pitch_y": 0.0},
                {"type": "penalty_spot_left", "pixel_x": 300, "pixel_y": 540, "pitch_x": 11.0, "pitch_y": 34.0},
                {"type": "penalty_spot_right", "pixel_x": 1620, "pixel_y": 540, "pitch_x": 94.0, "pitch_y": 34.0},
            ]
        },
        "tracks": [
            {
                "track_id": 1,
                "team": "home",
                "detection_class": "goalkeeper",
                "jersey_number": 1,
                "confidence": 0.95,
                "start_frame": 0,
                "end_frame": 1000,
                "points": [
                    {"frame_number": i, "timestamp": i/25.0, "bbox": {"x": 150, "y": 500, "width": 40, "height": 80}, "confidence": 0.9, "pitch_x": 5.0, "pitch_y": 34.0}
                    for i in range(0, 100, 5)
                ]
            },
            {
                "track_id": 2,
                "team": "home",
                "detection_class": "player",
                "jersey_number": 10,
                "confidence": 0.88,
                "start_frame": 0,
                "end_frame": 1000,
                "points": [
                    {"frame_number": i, "timestamp": i/25.0, "bbox": {"x": 500 + i//2, "y": 450, "width": 40, "height": 80}, "confidence": 0.85, "pitch_x": 30.0 + i*0.1, "pitch_y": 40.0}
                    for i in range(0, 100, 5)
                ]
            },
            {
                "track_id": 3,
                "team": "away",
                "detection_class": "player",
                "jersey_number": 9,
                "confidence": 0.85,
                "start_frame": 0,
                "end_frame": 1000,
                "points": [
                    {"frame_number": i, "timestamp": i/25.0, "bbox": {"x": 800 - i//3, "y": 400, "width": 40, "height": 80}, "confidence": 0.82, "pitch_x": 70.0 - i*0.1, "pitch_y": 30.0}
                    for i in range(0, 100, 5)
                ]
            }
        ],
        "events": [
            {
                "event_type": "pass",
                "frame_number": 50,
                "frame_end": 75,
                "player_track_id": 1,
                "target_track_id": 2,
                "start_x": 5.0,
                "start_y": 34.0,
                "end_x": 30.0,
                "end_y": 40.0,
                "is_successful": True,
                "body_part": "right_foot",
                "under_pressure": False,
                "half": 1,
                "confidence": 0.8
            },
            {
                "event_type": "pass",
                "frame_number": 100,
                "frame_end": 130,
                "player_track_id": 2,
                "start_x": 35.0,
                "start_y": 40.0,
                "end_x": 55.0,
                "end_y": 35.0,
                "is_successful": True,
                "body_part": "right_foot",
                "under_pressure": True,
                "half": 1,
                "confidence": 0.75
            },
            {
                "event_type": "interception",
                "frame_number": 200,
                "player_track_id": 3,
                "start_x": 60.0,
                "start_y": 30.0,
                "is_successful": True,
                "half": 1,
                "confidence": 0.7
            },
            {
                "event_type": "shot",
                "frame_number": 500,
                "player_track_id": 3,
                "start_x": 20.0,
                "start_y": 34.0,
                "is_successful": False,
                "body_part": "right_foot",
                "half": 1,
                "confidence": 0.85
            }
        ],
        "ball_positions": [
            {"frame_number": i, "timestamp": i/25.0, "x": 960 + (i % 100 - 50), "y": 540 + (i % 80 - 40), "pitch_x": 52.5 + (i % 50 - 25)*0.5, "pitch_y": 34.0 + (i % 40 - 20)*0.5, "confidence": 0.7, "is_visible": True}
            for i in range(0, 1000, 10)
        ]
    }


def main():
    parser = argparse.ArgumentParser(description="Export football_tracker_v2 data to import format")
    parser.add_argument("--output", "-o", default="tracker_export.json", help="Output JSON file path")
    parser.add_argument("--demo", action="store_true", help="Create demo export with sample data")

    args = parser.parse_args()

    if args.demo:
        data = create_demo_export()
        with open(args.output, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"Demo export saved to {args.output}")
        print(f"Import it with: python -m scripts.import_tracker_data --json-file {args.output}")
        return

    if not TRACKER_AVAILABLE:
        print("football_tracker_v2 not available. Use --demo to create sample data.")
        return

    # If tracker is available, you would load your data here
    # For now, create demo data
    print("No match data provided. Use --demo for sample data.")


if __name__ == "__main__":
    main()
