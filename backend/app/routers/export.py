"""
Football Tracker - Training Data Export Router
Exports corrected annotations in YOLO format for model retraining.

Based on industry standards from:
- Roboflow YOLO format: https://roboflow.com/formats/yolo
- Ultralytics dataset structure: https://docs.ultralytics.com/datasets/detect/
- CVAT export workflows: https://docs.cvat.ai/docs/dataset_management/formats/
"""

import os
import io
import zipfile
import yaml
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import cv2
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import get_db
from app.models.tracking import Detection, Frame
from app.models.team import Match
from app.models.user import User
from app.auth import get_current_user

# Video directory
VIDEO_DIR = Path("/Users/Sean/Desktop/Football Tracker")

router = APIRouter()

# Class mapping for YOLO export (zero-indexed)
CLASS_MAPPING = {
    "team_a": 0,
    "team_b": 1,
    "ball": 2,
    "referee": 3,
    "linesman": 4,
    "goalkeeper_a": 5,
    "goalkeeper_b": 6,
}

# Reverse mapping for data.yaml
CLASS_NAMES = {v: k for k, v in CLASS_MAPPING.items()}


def normalize_bbox(bbox_x1: float, bbox_y1: float, bbox_x2: float, bbox_y2: float,
                   img_width: int, img_height: int) -> tuple:
    """
    Convert pixel coordinates to YOLO normalized format.

    YOLO format: <class_id> <x_center> <y_center> <width> <height>
    All values normalized to 0-1 range.

    Based on: https://roboflow.com/formats/yolo
    """
    # Calculate center and dimensions in pixels
    x_center_px = (bbox_x1 + bbox_x2) / 2
    y_center_px = (bbox_y1 + bbox_y2) / 2
    width_px = bbox_x2 - bbox_x1
    height_px = bbox_y2 - bbox_y1

    # Normalize to 0-1 range
    x_center = x_center_px / img_width
    y_center = y_center_px / img_height
    width = width_px / img_width
    height = height_px / img_height

    # Clamp values to valid range
    x_center = max(0.0, min(1.0, x_center))
    y_center = max(0.0, min(1.0, y_center))
    width = max(0.0, min(1.0, width))
    height = max(0.0, min(1.0, height))

    return x_center, y_center, width, height


def get_video_dimensions(video_path: Path) -> tuple:
    """Get video width and height."""
    cap = cv2.VideoCapture(str(video_path))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    return width, height


def extract_frame_image(video_path: Path, frame_number: int) -> bytes:
    """Extract a single frame from video as JPEG bytes."""
    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
    ret, img = cap.read()
    cap.release()

    if not ret or img is None:
        return None

    _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return buffer.tobytes()


@router.get("/matches/{match_id}/export/yolo")
async def export_yolo_dataset(
    match_id: int,
    corrected_only: bool = Query(True, description="Export only human-corrected detections"),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0, description="Minimum confidence threshold"),
    train_split: float = Query(0.8, ge=0.5, le=0.95, description="Training set ratio (remainder is validation)"),
    include_images: bool = Query(True, description="Include frame images in export"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export match detections in YOLO format for training.

    Creates a ZIP file with:
    - images/train/*.jpg
    - images/val/*.jpg
    - labels/train/*.txt
    - labels/val/*.txt
    - data.yaml (dataset config)
    - export_info.yaml (metadata about the export)

    YOLO label format: <class_id> <x_center> <y_center> <width> <height>
    All coordinates normalized to 0-1 range.

    Based on Ultralytics dataset structure:
    https://docs.ultralytics.com/datasets/detect/
    """
    # Get match
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    if not match.video_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Match has no video file"
        )

    video_path = VIDEO_DIR / match.video_filename
    if not video_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video file not found: {match.video_filename}"
        )

    # Get video dimensions for normalization
    img_width, img_height = get_video_dimensions(video_path)

    # Build query for detections
    query = db.query(Detection).join(Frame).filter(Frame.match_id == match_id)

    if corrected_only:
        query = query.filter(Detection.is_corrected == True)

    if min_confidence > 0:
        query = query.filter(Detection.confidence >= min_confidence)

    detections = query.all()

    if not detections:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No detections found matching criteria"
        )

    # Group detections by frame
    frames_data = {}
    for det in detections:
        frame = det.frame
        if frame.id not in frames_data:
            frames_data[frame.id] = {
                "frame_number": frame.frame_number,
                "detections": []
            }

        # Get class name (corrected if available, otherwise AI prediction)
        class_name = det.corrected_class if det.is_corrected and det.corrected_class else det.ai_detection_class

        if class_name and class_name in CLASS_MAPPING:
            class_id = CLASS_MAPPING[class_name]

            # Normalize bounding box
            x_center, y_center, width, height = normalize_bbox(
                det.bbox_x1, det.bbox_y1, det.bbox_x2, det.bbox_y2,
                img_width, img_height
            )

            frames_data[frame.id]["detections"].append({
                "class_id": class_id,
                "x_center": x_center,
                "y_center": y_center,
                "width": width,
                "height": height,
                "original_class": det.ai_detection_class,
                "corrected_class": det.corrected_class,
                "is_corrected": det.is_corrected,
                "confidence": det.confidence
            })

    # Split into train/val
    frame_ids = list(frames_data.keys())
    import random
    random.shuffle(frame_ids)

    split_idx = int(len(frame_ids) * train_split)
    train_frames = frame_ids[:split_idx]
    val_frames = frame_ids[split_idx:]

    # Create ZIP file in memory
    zip_buffer = io.BytesIO()

    # Statistics for export info
    stats = {
        "total_frames": len(frames_data),
        "train_frames": len(train_frames),
        "val_frames": len(val_frames),
        "total_detections": sum(len(f["detections"]) for f in frames_data.values()),
        "corrected_detections": sum(
            sum(1 for d in f["detections"] if d["is_corrected"])
            for f in frames_data.values()
        ),
        "classes_count": {},
    }

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Process each frame
        for split_name, frame_list in [("train", train_frames), ("val", val_frames)]:
            for frame_id in frame_list:
                frame_data = frames_data[frame_id]
                frame_num = frame_data["frame_number"]

                # Generate filename (match_id_frame_number)
                base_name = f"match{match_id}_frame{frame_num:06d}"

                # Write label file (YOLO format)
                label_lines = []
                for det in frame_data["detections"]:
                    # YOLO format: class_id x_center y_center width height
                    label_lines.append(
                        f"{det['class_id']} {det['x_center']:.6f} {det['y_center']:.6f} "
                        f"{det['width']:.6f} {det['height']:.6f}"
                    )

                    # Track class statistics
                    class_name = CLASS_NAMES[det['class_id']]
                    stats["classes_count"][class_name] = stats["classes_count"].get(class_name, 0) + 1

                label_content = "\n".join(label_lines)
                zf.writestr(f"labels/{split_name}/{base_name}.txt", label_content)

                # Write image file (if requested)
                if include_images:
                    img_bytes = extract_frame_image(video_path, frame_num)
                    if img_bytes:
                        zf.writestr(f"images/{split_name}/{base_name}.jpg", img_bytes)

        # Write data.yaml (Ultralytics format)
        data_yaml = {
            "path": ".",  # Dataset root
            "train": "images/train",
            "val": "images/val",
            "names": CLASS_NAMES
        }
        zf.writestr("data.yaml", yaml.dump(data_yaml, default_flow_style=False))

        # Write export info
        export_info = {
            "export_date": datetime.utcnow().isoformat(),
            "match_id": match_id,
            "match_name": f"{match.home_team_name} vs {match.away_team_name}",
            "video_file": match.video_filename,
            "image_dimensions": {"width": img_width, "height": img_height},
            "export_settings": {
                "corrected_only": corrected_only,
                "min_confidence": min_confidence,
                "train_split": train_split,
                "include_images": include_images
            },
            "statistics": stats,
            "format_info": {
                "label_format": "YOLO (Ultralytics)",
                "coordinates": "normalized (0-1)",
                "structure": "<class_id> <x_center> <y_center> <width> <height>"
            }
        }
        zf.writestr("export_info.yaml", yaml.dump(export_info, default_flow_style=False))

        # Write classes.txt (some tools expect this)
        classes_txt = "\n".join(CLASS_NAMES[i] for i in sorted(CLASS_NAMES.keys()))
        zf.writestr("classes.txt", classes_txt)

    zip_buffer.seek(0)

    # Generate filename
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"football_tracker_match{match_id}_{timestamp}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/matches/{match_id}/export/stats")
async def get_export_stats(
    match_id: int,
    corrected_only: bool = Query(True),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics about what would be exported (preview before download).
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    # Build query
    query = db.query(Detection).join(Frame).filter(Frame.match_id == match_id)

    if corrected_only:
        query = query.filter(Detection.is_corrected == True)

    if min_confidence > 0:
        query = query.filter(Detection.confidence >= min_confidence)

    detections = query.all()

    # Calculate stats
    frames_with_detections = set()
    class_counts = {}
    corrected_count = 0

    for det in detections:
        frames_with_detections.add(det.frame_id)

        class_name = det.corrected_class if det.is_corrected and det.corrected_class else det.ai_detection_class
        if class_name:
            class_counts[class_name] = class_counts.get(class_name, 0) + 1

        if det.is_corrected:
            corrected_count += 1

    return {
        "match_id": match_id,
        "match_name": f"{match.home_team_name} vs {match.away_team_name}",
        "total_detections": len(detections),
        "corrected_detections": corrected_count,
        "frames_with_detections": len(frames_with_detections),
        "by_class": class_counts,
        "export_ready": len(detections) > 0,
        "settings": {
            "corrected_only": corrected_only,
            "min_confidence": min_confidence
        }
    }


@router.get("/export/class-mapping")
async def get_class_mapping(
    current_user: User = Depends(get_current_user)
):
    """
    Get the class mapping used for YOLO export.
    Useful for understanding what class IDs map to what labels.
    """
    return {
        "class_to_id": CLASS_MAPPING,
        "id_to_class": CLASS_NAMES,
        "total_classes": len(CLASS_MAPPING)
    }


@router.get("/matches/{match_id}/export/events")
async def export_event_corrections(
    match_id: int,
    verified_only: bool = Query(True, description="Export only verified events"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export event corrections as JSON for classifier training.

    Returns a ZIP containing:
    - events.json: All event data with corrections
    - corrections.json: Only the corrected events
    - statistics.json: Export statistics
    """
    from app.models.events import Event

    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    # Get events
    query = db.query(Event).filter(
        Event.match_id == match_id,
        Event.is_deleted == False
    )

    if verified_only:
        query = query.filter(Event.is_verified == True)

    events = query.order_by(Event.timestamp_ms).all()

    # Build event data
    all_events = []
    corrections = []

    for e in events:
        event_data = {
            "id": e.id,
            "event_type": str(e.event_type) if e.event_type else None,
            "event_category": str(e.event_category) if e.event_category else None,
            "timestamp_ms": e.timestamp_ms,
            "frame_start": e.frame_start,
            "frame_end": e.frame_end,
            "match_minute": e.match_minute,
            "half": e.half,
            "player_track_id": e.player_track_id,
            "target_track_id": e.target_track_id,
            "start_pos": [float(e.start_x), float(e.start_y)] if e.start_x else None,
            "end_pos": [float(e.end_x), float(e.end_y)] if e.end_x else None,
            "outcome_success": e.outcome_success,
            "ai_confidence": float(e.ai_confidence) if e.ai_confidence else None,
            "is_verified": e.is_verified,
            "is_correct": e.is_correct,
            "corrected_type": e.corrected_type,
        }
        all_events.append(event_data)

        # Add to corrections if corrected
        if e.is_verified and not e.is_correct and e.corrected_type:
            corrections.append({
                "original_type": str(e.event_type) if e.event_type else None,
                "corrected_type": e.corrected_type,
                "timestamp_ms": e.timestamp_ms,
                "ai_confidence": float(e.ai_confidence) if e.ai_confidence else None,
                "frame_start": e.frame_start,
            })

    # Calculate statistics
    stats = {
        "match_id": match_id,
        "match_name": f"{match.home_team_name} vs {match.away_team_name}",
        "export_date": datetime.utcnow().isoformat(),
        "total_events": len(all_events),
        "verified_events": sum(1 for e in all_events if e["is_verified"]),
        "correct_events": sum(1 for e in all_events if e["is_correct"]),
        "incorrect_events": sum(1 for e in all_events if e["is_verified"] and not e["is_correct"]),
        "corrections_count": len(corrections),
        "by_type": {},
        "accuracy_by_type": {},
    }

    # Count by type
    for e in all_events:
        event_type = e["event_type"] or "unknown"
        if event_type not in stats["by_type"]:
            stats["by_type"][event_type] = {"total": 0, "correct": 0, "incorrect": 0}
        stats["by_type"][event_type]["total"] += 1
        if e["is_verified"]:
            if e["is_correct"]:
                stats["by_type"][event_type]["correct"] += 1
            else:
                stats["by_type"][event_type]["incorrect"] += 1

    # Calculate accuracy by type
    for event_type, counts in stats["by_type"].items():
        verified = counts["correct"] + counts["incorrect"]
        if verified > 0:
            stats["accuracy_by_type"][event_type] = {
                "verified": verified,
                "accuracy": counts["correct"] / verified
            }

    # Create ZIP
    import json
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("events.json", json.dumps(all_events, indent=2))
        zf.writestr("corrections.json", json.dumps(corrections, indent=2))
        zf.writestr("statistics.json", json.dumps(stats, indent=2))

    zip_buffer.seek(0)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"event_corrections_match{match_id}_{timestamp}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/matches/{match_id}/export/all")
async def export_all_corrections(
    match_id: int,
    include_images: bool = Query(False, description="Include frame images (large file)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export all corrections (detections in YOLO format + events in JSON).

    Creates a comprehensive ZIP with:
    - detections/ (YOLO format)
    - events/ (JSON format)
    - summary.json
    """
    from app.models.events import Event

    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    video_path = VIDEO_DIR / match.video_filename if match.video_filename else None
    img_width, img_height = (1920, 1080)  # Default
    if video_path and video_path.exists():
        img_width, img_height = get_video_dimensions(video_path)

    # Get corrected detections
    detections = db.query(Detection).join(Frame).filter(
        Frame.match_id == match_id,
        Detection.is_corrected == True
    ).all()

    # Get verified events
    events = db.query(Event).filter(
        Event.match_id == match_id,
        Event.is_verified == True,
        Event.is_deleted == False
    ).all()

    # Create ZIP
    import json
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Detection labels (YOLO format)
        frames_exported = set()
        detection_count = 0

        frames_data = {}
        for det in detections:
            frame = det.frame
            if frame.id not in frames_data:
                frames_data[frame.id] = {
                    "frame_number": frame.frame_number,
                    "detections": []
                }

            class_name = det.corrected_class or det.ai_detection_class
            if class_name and class_name in CLASS_MAPPING:
                class_id = CLASS_MAPPING[class_name]
                x_center, y_center, width, height = normalize_bbox(
                    float(det.bbox_x1), float(det.bbox_y1),
                    float(det.bbox_x2), float(det.bbox_y2),
                    img_width, img_height
                )
                frames_data[frame.id]["detections"].append(
                    f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}"
                )
                detection_count += 1

        for frame_id, data in frames_data.items():
            if data["detections"]:
                base_name = f"match{match_id}_frame{data['frame_number']:06d}"
                label_content = "\n".join(data["detections"])
                zf.writestr(f"detections/labels/{base_name}.txt", label_content)
                frames_exported.add(frame_id)

                if include_images and video_path and video_path.exists():
                    img_bytes = extract_frame_image(video_path, data["frame_number"])
                    if img_bytes:
                        zf.writestr(f"detections/images/{base_name}.jpg", img_bytes)

        # data.yaml for detections
        data_yaml = {
            "path": "detections",
            "train": "images",
            "val": "images",
            "names": CLASS_NAMES
        }
        zf.writestr("detections/data.yaml", yaml.dump(data_yaml, default_flow_style=False))

        # Events JSON
        events_data = [{
            "id": e.id,
            "event_type": str(e.event_type) if e.event_type else None,
            "timestamp_ms": e.timestamp_ms,
            "frame_start": e.frame_start,
            "is_correct": e.is_correct,
            "corrected_type": e.corrected_type,
            "ai_confidence": float(e.ai_confidence) if e.ai_confidence else None,
        } for e in events]

        zf.writestr("events/events.json", json.dumps(events_data, indent=2))

        # Summary
        summary = {
            "match_id": match_id,
            "match_name": f"{match.home_team_name} vs {match.away_team_name}",
            "export_date": datetime.utcnow().isoformat(),
            "detections": {
                "total_corrected": detection_count,
                "frames_exported": len(frames_exported),
            },
            "events": {
                "total_verified": len(events),
                "correct": sum(1 for e in events if e.is_correct),
                "incorrect": sum(1 for e in events if not e.is_correct),
            }
        }
        zf.writestr("summary.json", json.dumps(summary, indent=2))

    zip_buffer.seek(0)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"all_corrections_match{match_id}_{timestamp}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
