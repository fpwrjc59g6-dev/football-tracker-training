"""Tracks router."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.tracking import Track, Detection, Frame, TeamSide, DetectionClass
from app.models.team import Match
from app.models.user import User
from app.models.corrections import Correction, CorrectionType
from app.schemas.tracking import TrackResponse, TrackUpdate, TrackListResponse, DetectionResponse
from app.auth import get_current_user, require_analyst

router = APIRouter(prefix="/matches/{match_id}/tracks", tags=["Tracks"])


@router.get("", response_model=List[TrackListResponse])
async def list_tracks(
    match_id: int,
    team: Optional[TeamSide] = Query(None, description="Filter by team"),
    detection_class: Optional[DetectionClass] = Query(None, description="Filter by class"),
    is_reviewed: Optional[bool] = Query(None, description="Filter by review status"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List tracks in a match."""
    # Verify match exists
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    query = db.query(Track).filter(Track.match_id == match_id)

    if team:
        # Filter by effective team (corrected or AI)
        query = query.filter(
            (Track.corrected_team == team) |
            ((Track.corrected_team.is_(None)) & (Track.ai_team == team))
        )

    if detection_class:
        query = query.filter(
            (Track.corrected_detection_class == detection_class) |
            ((Track.corrected_detection_class.is_(None)) & (Track.ai_detection_class == detection_class))
        )

    if is_reviewed is not None:
        query = query.filter(Track.is_reviewed == is_reviewed)

    tracks = query.order_by(Track.track_id).offset(skip).limit(limit).all()

    # Add computed properties
    result = []
    for track in tracks:
        result.append(TrackListResponse(
            id=track.id,
            track_id=track.track_id,
            team=track.team,
            detection_class=track.detection_class,
            jersey_number=track.jersey_number,
            assigned_player_id=track.assigned_player_id,
            first_frame=track.first_frame,
            last_frame=track.last_frame,
            total_detections=track.total_detections,
            is_reviewed=track.is_reviewed,
            is_corrected=track.is_corrected,
            total_distance_m=track.total_distance_m,
            max_speed_ms=track.max_speed_ms,
        ))

    return result


@router.get("/{track_id}", response_model=TrackResponse)
async def get_track(
    match_id: int,
    track_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a track by ID."""
    track = db.query(Track).filter(
        Track.match_id == match_id,
        Track.track_id == track_id
    ).first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    return TrackResponse(
        id=track.id,
        match_id=track.match_id,
        track_id=track.track_id,
        ai_team=track.ai_team,
        ai_detection_class=track.ai_detection_class,
        ai_jersey_number=track.ai_jersey_number,
        corrected_team=track.corrected_team,
        corrected_detection_class=track.corrected_detection_class,
        corrected_jersey_number=track.corrected_jersey_number,
        assigned_player_id=track.assigned_player_id,
        team=track.team,
        detection_class=track.detection_class,
        jersey_number=track.jersey_number,
        first_frame=track.first_frame,
        last_frame=track.last_frame,
        total_detections=track.total_detections,
        avg_confidence=track.avg_confidence,
        total_distance_m=track.total_distance_m,
        max_speed_ms=track.max_speed_ms,
        avg_speed_ms=track.avg_speed_ms,
        sprint_count=track.sprint_count,
        is_reviewed=track.is_reviewed,
        is_corrected=track.is_corrected,
    )


@router.put("/{track_id}", response_model=TrackResponse)
async def update_track(
    match_id: int,
    track_id: int,
    track_data: TrackUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Update a track (correct AI predictions)."""
    track = db.query(Track).filter(
        Track.match_id == match_id,
        Track.track_id == track_id
    ).first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Store original values for correction record
    original_values = {}
    corrected_values = {}

    update_data = track_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if key.startswith("corrected_") or key == "assigned_player_id":
            original_key = key.replace("corrected_", "ai_") if key.startswith("corrected_") else key
            if hasattr(track, original_key):
                original_values[key] = getattr(track, original_key)
            corrected_values[key] = value

        setattr(track, key, value)

    # Mark as corrected if any correction fields changed
    if any(k.startswith("corrected_") for k in update_data):
        track.is_corrected = True

    if "is_reviewed" not in update_data:
        track.is_reviewed = True

    db.commit()

    # Create correction record
    if corrected_values:
        correction = Correction(
            match_id=match_id,
            user_id=current_user.id,
            correction_type=CorrectionType.TRACK_TEAM_ASSIGNMENT if "corrected_team" in corrected_values
                else CorrectionType.TRACK_PLAYER_ID if "assigned_player_id" in corrected_values
                else CorrectionType.TRACK_JERSEY_NUMBER if "corrected_jersey_number" in corrected_values
                else CorrectionType.TRACK_CLASS,
            track_id=track.id,
            original_value=original_values,
            corrected_value=corrected_values,
        )
        db.add(correction)
        db.commit()

    db.refresh(track)

    return TrackResponse(
        id=track.id,
        match_id=track.match_id,
        track_id=track.track_id,
        ai_team=track.ai_team,
        ai_detection_class=track.ai_detection_class,
        ai_jersey_number=track.ai_jersey_number,
        corrected_team=track.corrected_team,
        corrected_detection_class=track.corrected_detection_class,
        corrected_jersey_number=track.corrected_jersey_number,
        assigned_player_id=track.assigned_player_id,
        team=track.team,
        detection_class=track.detection_class,
        jersey_number=track.jersey_number,
        first_frame=track.first_frame,
        last_frame=track.last_frame,
        total_detections=track.total_detections,
        avg_confidence=track.avg_confidence,
        total_distance_m=track.total_distance_m,
        max_speed_ms=track.max_speed_ms,
        avg_speed_ms=track.avg_speed_ms,
        sprint_count=track.sprint_count,
        is_reviewed=track.is_reviewed,
        is_corrected=track.is_corrected,
    )


@router.get("/{track_id}/detections", response_model=List[DetectionResponse])
async def get_track_detections(
    match_id: int,
    track_id: int,
    frame_start: Optional[int] = Query(None, description="Start frame"),
    frame_end: Optional[int] = Query(None, description="End frame"),
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all detections for a track."""
    track = db.query(Track).filter(
        Track.match_id == match_id,
        Track.track_id == track_id
    ).first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    query = db.query(Detection).join(Frame).filter(
        Detection.track_id == track.id,
        Frame.match_id == match_id
    )

    if frame_start is not None:
        query = query.filter(Frame.frame_number >= frame_start)

    if frame_end is not None:
        query = query.filter(Frame.frame_number <= frame_end)

    detections = query.order_by(Frame.frame_number).offset(skip).limit(limit).all()
    return detections
