"""
Import script for football_tracker_v2 data.

This script imports tracking and event data from the football_tracker_v2
system into the annotation tool's PostgreSQL database.

Usage:
    python -m scripts.import_tracker_data --match-dir /path/to/match/output
    python -m scripts.import_tracker_data --json-file /path/to/data.json
"""

import argparse
import json
import os
import sys
from datetime import datetime, date
from pathlib import Path
from typing import Optional, Dict, Any, List

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models.team import Team, Player, Match, MatchPlayer
from app.models.tracking import Frame, Detection, Track, BallPosition, TeamSide, DetectionClass
from app.models.events import Event, EventType, EventCategory, BodyPart, PassHeight
from app.models.calibration import PitchCalibration, CalibrationPoint

# Mapping from tracker_v2 event types to our EventType enum
EVENT_TYPE_MAP = {
    "pass": EventType.PASS,
    "shot": EventType.SHOT,
    "tackle": EventType.TACKLE,
    "interception": EventType.INTERCEPTION,
    "clearance": EventType.CLEARANCE,
    "duel": EventType.DUEL,
    "sprint": EventType.SPRINT,
    "pressing": EventType.PRESSING_TRIGGER,
    "reception": EventType.BALL_RECEIPT,
    "possession_start": EventType.RECOVERY,
    "possession_end": EventType.DISPOSSESSED,
}

# Mapping for event categories
EVENT_CATEGORY_MAP = {
    "pass": EventCategory.PASS,
    "shot": EventCategory.SHOT,
    "tackle": EventCategory.DEFENSIVE,
    "interception": EventCategory.DEFENSIVE,
    "clearance": EventCategory.DEFENSIVE,
    "duel": EventCategory.DUEL,
    "sprint": EventCategory.PHYSICAL,
    "pressing": EventCategory.PHYSICAL,
    "reception": EventCategory.BALL_CONTROL,
}


def get_or_create_team(db: Session, name: str, short_name: str = None, primary_color: str = None, secondary_color: str = None) -> Team:
    """Get existing team or create new one."""
    team = db.query(Team).filter(Team.name == name).first()
    if not team:
        team = Team(
            name=name,
            short_name=short_name or name[:3].upper(),
            primary_color=primary_color or "#3B82F6",
            secondary_color=secondary_color or "#FFFFFF",
        )
        db.add(team)
        db.commit()
        db.refresh(team)
    return team


def get_or_create_player(db: Session, team_id: int, jersey_number: int, name: str = None) -> Player:
    """Get existing player or create new one."""
    player = db.query(Player).filter(
        Player.team_id == team_id,
        Player.jersey_number == jersey_number
    ).first()

    if not player:
        player = Player(
            team_id=team_id,
            name=name or f"Player {jersey_number}",
            jersey_number=jersey_number,
            position="Unknown",
        )
        db.add(player)
        db.commit()
        db.refresh(player)
    return player


def import_match_from_json(db: Session, data: Dict[str, Any]) -> Match:
    """Import a match from JSON data."""

    # Get or create teams
    home_team_data = data.get("home_team", {})
    away_team_data = data.get("away_team", {})

    home_team = get_or_create_team(
        db,
        name=home_team_data.get("name", "Home Team"),
        primary_color=home_team_data.get("primary_color"),
        secondary_color=home_team_data.get("secondary_color"),
    )

    away_team = get_or_create_team(
        db,
        name=away_team_data.get("name", "Away Team"),
        primary_color=away_team_data.get("primary_color"),
        secondary_color=away_team_data.get("secondary_color"),
    )

    # Parse match date
    match_date_str = data.get("match_date", datetime.now().strftime("%Y-%m-%d"))
    if isinstance(match_date_str, str):
        match_date = datetime.strptime(match_date_str[:10], "%Y-%m-%d").date()
    else:
        match_date = match_date_str

    # Create match
    match = Match(
        home_team_id=home_team.id,
        away_team_id=away_team.id,
        match_date=match_date,
        competition=data.get("competition", ""),
        venue=data.get("venue", ""),
        fps=data.get("fps", 25.0),
        total_frames=data.get("total_frames", 0),
        video_width=data.get("video_width", 1920),
        video_height=data.get("video_height", 1080),
        is_processed=True,
    )

    db.add(match)
    db.commit()
    db.refresh(match)

    print(f"Created match: {home_team.name} vs {away_team.name} (ID: {match.id})")

    return match


def import_tracks(db: Session, match: Match, tracks_data: List[Dict[str, Any]]) -> Dict[int, Track]:
    """Import tracks from tracker_v2 format."""
    track_map = {}  # Maps tracker_v2 track_id to our Track model

    for track_data in tracks_data:
        tracker_id = track_data.get("track_id")

        # Determine team side
        team_str = track_data.get("team", "unknown")
        if team_str == "home":
            ai_team = TeamSide.HOME
        elif team_str == "away":
            ai_team = TeamSide.AWAY
        elif team_str == "referee":
            ai_team = TeamSide.REFEREE
        else:
            ai_team = TeamSide.UNKNOWN

        # Determine detection class
        class_str = track_data.get("detection_class", "player")
        if class_str == "ball":
            detection_class = DetectionClass.BALL
        elif class_str == "referee":
            detection_class = DetectionClass.REFEREE
        elif class_str == "goalkeeper":
            detection_class = DetectionClass.GOALKEEPER
        else:
            detection_class = DetectionClass.PLAYER

        track = Track(
            match_id=match.id,
            track_id=tracker_id,
            ai_team=ai_team,
            ai_detection_class=detection_class,
            ai_jersey_number=track_data.get("jersey_number"),
            ai_confidence=track_data.get("confidence", 0.5),
            first_frame=track_data.get("start_frame", 0),
            last_frame=track_data.get("end_frame", 0),
        )

        db.add(track)
        db.commit()
        db.refresh(track)

        track_map[tracker_id] = track

        # Import track points as detections
        points = track_data.get("points", [])
        for point in points:
            frame_num = point.get("frame_number", 0)

            # Get or create frame
            frame = db.query(Frame).filter(
                Frame.match_id == match.id,
                Frame.frame_number == frame_num
            ).first()

            if not frame:
                frame = Frame(
                    match_id=match.id,
                    frame_number=frame_num,
                    timestamp=point.get("timestamp", frame_num / match.fps),
                )
                db.add(frame)
                db.commit()
                db.refresh(frame)

            # Create detection
            bbox = point.get("bbox", {})
            detection = Detection(
                frame_id=frame.id,
                track_id=track.id,
                x=bbox.get("x", 0),
                y=bbox.get("y", 0),
                width=bbox.get("width", 0),
                height=bbox.get("height", 0),
                confidence=point.get("confidence", 0.5),
                pitch_x=point.get("pitch_x"),
                pitch_y=point.get("pitch_y"),
            )
            db.add(detection)

    db.commit()
    print(f"Imported {len(track_map)} tracks")

    return track_map


def import_events(db: Session, match: Match, events_data: List[Dict[str, Any]], track_map: Dict[int, Track]):
    """Import events from tracker_v2 format."""
    event_count = 0

    for event_data in events_data:
        # Map event type
        event_type_str = event_data.get("event_type", "pass")
        event_type = EVENT_TYPE_MAP.get(event_type_str, EventType.PASS)
        event_category = EVENT_CATEGORY_MAP.get(event_type_str, EventCategory.PASS)

        # Get player track if available
        player_track_id = None
        if "player_track_id" in event_data and event_data["player_track_id"] in track_map:
            player_track_id = track_map[event_data["player_track_id"]].id

        target_track_id = None
        if "target_track_id" in event_data and event_data["target_track_id"] in track_map:
            target_track_id = track_map[event_data["target_track_id"]].id

        opponent_track_id = None
        if "opponent_track_id" in event_data and event_data["opponent_track_id"] in track_map:
            opponent_track_id = track_map[event_data["opponent_track_id"]].id

        # Body part mapping
        body_part = None
        body_part_str = event_data.get("body_part")
        if body_part_str:
            body_part_map = {
                "foot": BodyPart.FOOT,
                "right_foot": BodyPart.RIGHT_FOOT,
                "left_foot": BodyPart.LEFT_FOOT,
                "head": BodyPart.HEAD,
            }
            body_part = body_part_map.get(body_part_str, BodyPart.FOOT)

        # Pass height mapping
        pass_height = None
        pass_height_str = event_data.get("pass_height")
        if pass_height_str:
            pass_height_map = {
                "ground": PassHeight.GROUND,
                "low": PassHeight.LOW,
                "high": PassHeight.HIGH,
            }
            pass_height = pass_height_map.get(pass_height_str)

        event = Event(
            match_id=match.id,
            frame_start=event_data.get("frame_number", 0),
            frame_end=event_data.get("frame_end", event_data.get("frame_number", 0)),
            event_type=event_type,
            event_category=event_category,
            player_track_id=player_track_id,
            target_track_id=target_track_id,
            opponent_track_id=opponent_track_id,
            start_x=event_data.get("start_x"),
            start_y=event_data.get("start_y"),
            end_x=event_data.get("end_x"),
            end_y=event_data.get("end_y"),
            outcome_success=event_data.get("is_successful"),
            body_part=body_part,
            pass_height=pass_height,
            under_pressure=event_data.get("under_pressure", False),
            half=event_data.get("half", 1),
            is_ai_generated=True,
            ai_confidence=event_data.get("confidence", 0.5),
        )

        db.add(event)
        event_count += 1

    db.commit()
    print(f"Imported {event_count} events")


def import_ball_positions(db: Session, match: Match, ball_data: List[Dict[str, Any]]):
    """Import ball tracking data."""
    for point in ball_data:
        frame_num = point.get("frame_number", 0)

        # Get or create frame
        frame = db.query(Frame).filter(
            Frame.match_id == match.id,
            Frame.frame_number == frame_num
        ).first()

        if not frame:
            frame = Frame(
                match_id=match.id,
                frame_number=frame_num,
                timestamp=point.get("timestamp", frame_num / match.fps),
            )
            db.add(frame)
            db.commit()
            db.refresh(frame)

        ball_pos = BallPosition(
            frame_id=frame.id,
            x=point.get("x", 0),
            y=point.get("y", 0),
            pitch_x=point.get("pitch_x"),
            pitch_y=point.get("pitch_y"),
            confidence=point.get("confidence", 0.5),
            is_visible=point.get("is_visible", True),
        )
        db.add(ball_pos)

    db.commit()
    print(f"Imported {len(ball_data)} ball positions")


def import_calibration(db: Session, match: Match, calibration_data: Dict[str, Any]):
    """Import pitch calibration data."""
    if not calibration_data:
        return

    homography = calibration_data.get("homography_matrix")

    calibration = PitchCalibration(
        match_id=match.id,
        homography_matrix=homography,
        pitch_length=calibration_data.get("pitch_length", 105.0),
        pitch_width=calibration_data.get("pitch_width", 68.0),
        is_active=True,
    )

    db.add(calibration)
    db.commit()
    db.refresh(calibration)

    # Import calibration points
    points = calibration_data.get("points", [])
    for point in points:
        cal_point = CalibrationPoint(
            calibration_id=calibration.id,
            point_type=point.get("type", "custom"),
            pixel_x=point.get("pixel_x", 0),
            pixel_y=point.get("pixel_y", 0),
            pitch_x=point.get("pitch_x", 0),
            pitch_y=point.get("pitch_y", 0),
        )
        db.add(cal_point)

    db.commit()
    print("Imported calibration data")


def import_from_json_file(db: Session, json_path: str):
    """Import all data from a JSON file."""
    print(f"Loading data from {json_path}...")

    with open(json_path, 'r') as f:
        data = json.load(f)

    # Import match
    match = import_match_from_json(db, data)

    # Import tracks
    track_map = {}
    if "tracks" in data:
        track_map = import_tracks(db, match, data["tracks"])

    # Import events
    if "events" in data:
        import_events(db, match, data["events"], track_map)

    # Import ball positions
    if "ball_positions" in data:
        import_ball_positions(db, match, data["ball_positions"])

    # Import calibration
    if "calibration" in data:
        import_calibration(db, match, data["calibration"])

    print(f"\nImport complete! Match ID: {match.id}")
    return match


def create_sample_export_format():
    """Create a sample JSON export format for reference."""
    sample = {
        "home_team": {
            "name": "Seekirchen",
            "primary_color": "#FF0000",
            "secondary_color": "#FFFFFF"
        },
        "away_team": {
            "name": "Bischofshofen",
            "primary_color": "#0000FF",
            "secondary_color": "#FFFFFF"
        },
        "match_date": "2024-01-15",
        "competition": "Regional League",
        "venue": "Home Stadium",
        "fps": 25.0,
        "total_frames": 135000,
        "video_width": 1920,
        "video_height": 1080,
        "calibration": {
            "pitch_length": 105.0,
            "pitch_width": 68.0,
            "homography_matrix": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            "points": [
                {"type": "center_circle", "pixel_x": 960, "pixel_y": 540, "pitch_x": 52.5, "pitch_y": 34.0}
            ]
        },
        "tracks": [
            {
                "track_id": 1,
                "team": "home",
                "detection_class": "player",
                "jersey_number": 10,
                "confidence": 0.85,
                "start_frame": 0,
                "end_frame": 1000,
                "points": [
                    {
                        "frame_number": 0,
                        "timestamp": 0.0,
                        "bbox": {"x": 100, "y": 200, "width": 50, "height": 100},
                        "confidence": 0.9,
                        "pitch_x": 30.0,
                        "pitch_y": 40.0
                    }
                ]
            }
        ],
        "events": [
            {
                "event_type": "pass",
                "frame_number": 100,
                "frame_end": 150,
                "player_track_id": 1,
                "target_track_id": 2,
                "start_x": 30.0,
                "start_y": 40.0,
                "end_x": 50.0,
                "end_y": 35.0,
                "is_successful": True,
                "body_part": "right_foot",
                "under_pressure": False,
                "half": 1,
                "confidence": 0.75
            }
        ],
        "ball_positions": [
            {
                "frame_number": 0,
                "timestamp": 0.0,
                "x": 960,
                "y": 540,
                "pitch_x": 52.5,
                "pitch_y": 34.0,
                "confidence": 0.8,
                "is_visible": True
            }
        ]
    }

    return sample


def main():
    parser = argparse.ArgumentParser(description="Import football_tracker_v2 data")
    parser.add_argument("--json-file", help="Path to JSON file to import")
    parser.add_argument("--create-sample", action="store_true", help="Create sample JSON format file")

    args = parser.parse_args()

    if args.create_sample:
        sample = create_sample_export_format()
        output_path = "sample_import_format.json"
        with open(output_path, 'w') as f:
            json.dump(sample, f, indent=2)
        print(f"Sample format saved to {output_path}")
        return

    if not args.json_file:
        print("Please provide --json-file or use --create-sample")
        return

    # Create database tables
    Base.metadata.create_all(bind=engine)

    # Create session and import
    db = SessionLocal()
    try:
        import_from_json_file(db, args.json_file)
    finally:
        db.close()


if __name__ == "__main__":
    main()
