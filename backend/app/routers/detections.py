"""
Football Tracker - Detection Review Router
CRUD operations for reviewing and correcting AI detections.
Compatible with the tracked model structure.
"""

from datetime import datetime
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, Integer

from app.database import get_db
from app.models.tracking import Detection, Frame, DetectionClass, TeamSide
from app.models.team import Match
from app.models.user import User
from app.auth import get_current_user, require_analyst

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class DetectionResponse(BaseModel):
    id: int
    frame_id: int
    track_id: Optional[int] = None
    bbox: BoundingBox
    center_x: Optional[float] = None
    center_y: Optional[float] = None
    confidence: Optional[float] = None
    class_name: Optional[str] = None
    team: Optional[str] = None
    is_corrected: bool = False

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_detection(cls, det: Detection) -> "DetectionResponse":
        """Convert a Detection ORM object to a response."""
        # Map detection class + team to friendly display name
        def get_display_class(detection_class, team):
            if detection_class == DetectionClass.BALL:
                return 'ball'
            elif detection_class == DetectionClass.REFEREE:
                return 'referee'
            elif detection_class == DetectionClass.LINESMAN:
                return 'linesman'
            elif detection_class in (DetectionClass.PLAYER, DetectionClass.GOALKEEPER):
                if team == TeamSide.HOME:
                    return 'team_a'
                elif team == TeamSide.AWAY:
                    return 'team_b'
                else:
                    return 'team_a'  # Default
            else:
                return 'team_a'  # Default for unknown

        display_class = get_display_class(det.ai_detection_class, det.ai_team)

        return cls(
            id=det.id,
            frame_id=det.frame_id,
            track_id=det.track_id,
            bbox=BoundingBox(
                x1=float(det.bbox_x1 or 0),
                y1=float(det.bbox_y1 or 0),
                x2=float(det.bbox_x2 or 0),
                y2=float(det.bbox_y2 or 0)
            ),
            center_x=float(det.center_x) if det.center_x else None,
            center_y=float(det.center_y) if det.center_y else None,
            confidence=float(det.confidence) if det.confidence else None,
            class_name=display_class,
            team=det.ai_team.value if det.ai_team else None,
            is_corrected=False  # Simplified for now
        )


class FrameResponse(BaseModel):
    id: int
    match_id: int
    frame_number: int
    timestamp_ms: int
    detections: List[DetectionResponse]

    class Config:
        from_attributes = True


class FrameListResponse(BaseModel):
    id: int
    frame_number: int
    timestamp_ms: int
    detection_count: int
    corrected_count: int


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/matches/{match_id}/frames", response_model=List[FrameListResponse])
async def list_frames(
    match_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List frames for a match with detection counts.
    """
    # Verify match exists
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    # Single query with aggregation
    frames_with_counts = db.query(
        Frame.id,
        Frame.frame_number,
        Frame.timestamp_ms,
        func.count(Detection.id).label('detection_count'),
    ).outerjoin(
        Detection, Detection.frame_id == Frame.id
    ).filter(
        Frame.match_id == match_id
    ).group_by(
        Frame.id
    ).order_by(
        Frame.frame_number
    ).offset(skip).limit(limit).all()

    return [
        FrameListResponse(
            id=row.id,
            frame_number=row.frame_number,
            timestamp_ms=row.timestamp_ms or 0,
            detection_count=row.detection_count or 0,
            corrected_count=0  # Simplified
        )
        for row in frames_with_counts
    ]


@router.get("/frames/{frame_id}", response_model=FrameResponse)
async def get_frame(
    frame_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a single frame with all its detections.
    """
    frame = db.query(Frame).filter(Frame.id == frame_id).first()
    if not frame:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Frame not found"
        )

    return FrameResponse(
        id=frame.id,
        match_id=frame.match_id,
        frame_number=frame.frame_number,
        timestamp_ms=frame.timestamp_ms or 0,
        detections=[DetectionResponse.from_orm_detection(d) for d in frame.detections]
    )


@router.get("/matches/{match_id}/frames/{frame_number}")
async def get_frame_by_number(
    match_id: int,
    frame_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get frame data by match ID and frame number.
    Creates the frame record if it doesn't exist.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    # Try to find existing frame
    frame = db.query(Frame).filter(
        Frame.match_id == match_id,
        Frame.frame_number == frame_number
    ).first()

    # If no frame exists, create one (for on-the-fly detection review)
    if not frame:
        fps = float(match.fps) if match.fps else 30.0
        frame = Frame(
            match_id=match_id,
            frame_number=frame_number,
            timestamp_ms=int(frame_number * 1000 / fps)
        )
        db.add(frame)
        db.commit()
        db.refresh(frame)

    # Get total frames for navigation
    total_frames = match.total_frames or 0

    return {
        "id": frame.id,
        "match_id": frame.match_id,
        "frame_number": frame.frame_number,
        "timestamp_ms": frame.timestamp_ms or 0,
        "total_frames": total_frames,
        "detections": [DetectionResponse.from_orm_detection(d) for d in frame.detections]
    }


@router.get("/matches/{match_id}/detection-stats")
async def get_detection_stats(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detection statistics for a match.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    # Count frames
    frame_count = db.query(Frame).filter(Frame.match_id == match_id).count()

    # Count detections
    total_detections = db.query(Detection).join(Frame).filter(
        Frame.match_id == match_id
    ).count()

    # Count by class
    class_counts = {}
    detections = db.query(Detection).join(Frame).filter(
        Frame.match_id == match_id
    ).all()

    for det in detections:
        cls = det.ai_detection_class.value if det.ai_detection_class else 'unknown'
        class_counts[cls] = class_counts.get(cls, 0) + 1

    return {
        "match_id": match_id,
        "frame_count": frame_count,
        "total_detections": total_detections,
        "corrected_detections": 0,  # Simplified
        "correction_rate": 0,
        "by_class": class_counts
    }
