"""Events router."""
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from pydantic import BaseModel
from app.database import get_db
from app.models.events import Event, EventType, EventCategory
from app.models.team import Match
from app.models.user import User
from app.models.corrections import Correction, CorrectionType
from app.schemas.events import EventCreate, EventUpdate, EventResponse, EventListResponse, EventSummary
from app.auth import get_current_user, require_analyst

router = APIRouter(prefix="/matches/{match_id}/events", tags=["Events"])


@router.get("", response_model=List[EventListResponse])
async def list_events(
    match_id: int,
    event_type: Optional[EventType] = Query(None, description="Filter by event type"),
    event_category: Optional[EventCategory] = Query(None, description="Filter by category"),
    player_track_id: Optional[int] = Query(None, description="Filter by player track"),
    half: Optional[int] = Query(None, description="Filter by half (1 or 2)"),
    frame_start: Optional[int] = Query(None, description="Filter from frame"),
    frame_end: Optional[int] = Query(None, description="Filter to frame"),
    include_deleted: bool = Query(False, description="Include deleted events"),
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List events in a match."""
    # Verify match exists
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    query = db.query(Event).filter(Event.match_id == match_id)

    if not include_deleted:
        query = query.filter(Event.is_deleted == False)

    if event_type:
        query = query.filter(Event.event_type == event_type)

    if event_category:
        query = query.filter(Event.event_category == event_category)

    if player_track_id:
        query = query.filter(Event.player_track_id == player_track_id)

    if half:
        query = query.filter(Event.half == half)

    if frame_start is not None:
        query = query.filter(Event.frame_start >= frame_start)

    if frame_end is not None:
        query = query.filter(Event.frame_start <= frame_end)

    events = query.order_by(Event.frame_start).offset(skip).limit(limit).all()
    return events


@router.get("/summary", response_model=EventSummary)
async def get_event_summary(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get event summary statistics for a match."""
    # Verify match exists
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Total events
    total = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_deleted == False
    ).scalar()

    # By category
    by_category = dict(
        db.query(Event.event_category, func.count(Event.id)).filter(
            Event.match_id == match_id,
            Event.is_deleted == False
        ).group_by(Event.event_category).all()
    )

    # By type
    by_type = dict(
        db.query(Event.event_type, func.count(Event.id)).filter(
            Event.match_id == match_id,
            Event.is_deleted == False
        ).group_by(Event.event_type).all()
    )

    # Counts
    ai_generated = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_ai_generated == True,
        Event.is_deleted == False
    ).scalar()

    corrected = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_corrected == True,
        Event.is_deleted == False
    ).scalar()

    deleted = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_deleted == True
    ).scalar()

    manually_added = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_manually_added == True,
        Event.is_deleted == False
    ).scalar()

    return EventSummary(
        total_events=total,
        by_category={str(k.value): v for k, v in by_category.items()},
        by_type={str(k.value): v for k, v in by_type.items()},
        ai_generated_count=ai_generated,
        corrected_count=corrected,
        deleted_count=deleted,
        manually_added_count=manually_added,
    )


# ============================================================================
# KICK-OFF CALIBRATION ENDPOINTS
# ============================================================================

class KickoffCreate(BaseModel):
    """Request body for creating a kick-off event."""
    frame_number: int
    timestamp_ms: int
    half: int = 1
    team: Optional[str] = None  # 'team_a' or 'team_b'


class KickoffResponse(BaseModel):
    """Response for kick-off data."""
    id: int
    half: int
    frame_start: int
    timestamp_ms: int
    team: Optional[str] = None
    is_verified: bool = False
    is_manually_added: bool = False


@router.get("/kickoffs")
async def get_match_kickoffs(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get kick-off events for a match (used for timestamp calibration)."""
    kickoffs = db.query(Event).filter(
        Event.match_id == match_id,
        Event.event_type == EventType.kickoff
    ).order_by(Event.half).all()

    return {
        "kickoffs": [
            {
                "id": k.id,
                "half": k.half,
                "frame_start": k.frame_start,
                "timestamp_ms": k.timestamp_ms,
                "team": k.metadata.get('team') if k.metadata else None,
                "is_verified": k.is_verified or False,
                "is_manually_added": k.is_manually_added or False
            }
            for k in kickoffs
        ],
        "has_first_half": any(k.half == 1 for k in kickoffs),
        "has_second_half": any(k.half == 2 for k in kickoffs)
    }


@router.post("/kickoff")
async def create_kickoff_event(
    match_id: int,
    kickoff: KickoffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """
    Create or update a kick-off event for timestamp calibration.

    This is used to mark the exact moment of kick-off in the video,
    which serves as a reference point for aligning all other events.
    """
    # Verify match exists
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Check if kick-off already exists for this half
    existing = db.query(Event).filter(
        Event.match_id == match_id,
        Event.event_type == EventType.kickoff,
        Event.half == kickoff.half
    ).first()

    if existing:
        # Update existing kick-off
        existing.frame_start = kickoff.frame_number
        existing.frame_end = kickoff.frame_number
        existing.timestamp_ms = kickoff.timestamp_ms
        existing.match_minute = 0 if kickoff.half == 1 else 45
        existing.match_second = 0
        existing.is_verified = True
        existing.is_manually_added = True
        if kickoff.team:
            existing.metadata = existing.metadata or {}
            existing.metadata['team'] = kickoff.team
        db.commit()
        return {
            "message": f"Kick-off for half {kickoff.half} updated",
            "id": existing.id,
            "action": "updated"
        }
    else:
        # Create new kick-off event
        new_kickoff = Event(
            match_id=match_id,
            event_type=EventType.kickoff,
            event_category=EventCategory.set_piece,
            frame_start=kickoff.frame_number,
            frame_end=kickoff.frame_number,
            timestamp_ms=kickoff.timestamp_ms,
            match_minute=0 if kickoff.half == 1 else 45,
            match_second=0,
            half=kickoff.half,
            is_ai_generated=False,
            is_manually_added=True,
            is_verified=True,
            ai_confidence=1.0,
            metadata={'team': kickoff.team} if kickoff.team else {}
        )
        db.add(new_kickoff)
        db.commit()
        return {
            "message": f"Kick-off for half {kickoff.half} created",
            "id": new_kickoff.id,
            "action": "created"
        }


class TimestampOffsetApply(BaseModel):
    """Request body for applying timestamp offset."""
    offset_ms: int
    offset_frames: int
    half: Optional[int] = None  # Apply to specific half or all


@router.post("/apply-offset")
async def apply_timestamp_offset(
    match_id: int,
    offset: TimestampOffsetApply,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """
    Apply a timestamp offset to all events in the match.

    This is used after calibrating kick-off to align all events with the video.
    """
    # Apply offset using raw SQL for efficiency
    if offset.half:
        db.execute(text("""
            UPDATE events
            SET
                frame_start = frame_start + :offset_frames,
                frame_end = CASE WHEN frame_end IS NOT NULL THEN frame_end + :offset_frames ELSE NULL END,
                timestamp_ms = timestamp_ms + :offset_ms
            WHERE match_id = :match_id AND half = :half
        """), {
            "offset_frames": offset.offset_frames,
            "offset_ms": offset.offset_ms,
            "match_id": match_id,
            "half": offset.half
        })
    else:
        db.execute(text("""
            UPDATE events
            SET
                frame_start = frame_start + :offset_frames,
                frame_end = CASE WHEN frame_end IS NOT NULL THEN frame_end + :offset_frames ELSE NULL END,
                timestamp_ms = timestamp_ms + :offset_ms
            WHERE match_id = :match_id
        """), {
            "offset_frames": offset.offset_frames,
            "offset_ms": offset.offset_ms,
            "match_id": match_id
        })

    db.commit()

    # Get count of affected events
    affected = db.query(Event).filter(Event.match_id == match_id).count()

    return {
        "message": f"Offset applied to {affected} events",
        "offset_ms": offset.offset_ms,
        "offset_frames": offset.offset_frames,
        "half": offset.half or "all"
    }


# ============================================================================
# STANDARD EVENT CRUD
# ============================================================================

@router.post("", response_model=EventResponse)
async def create_event(
    match_id: int,
    event_data: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Create a new event (manually add)."""
    # Verify match exists
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Ensure match_id matches
    event_data_dict = event_data.model_dump()
    event_data_dict["match_id"] = match_id
    event_data_dict["is_manually_added"] = True
    event_data_dict["is_ai_generated"] = False

    event = Event(**event_data_dict)
    db.add(event)
    db.commit()
    db.refresh(event)

    # Create correction record for manually added event
    correction = Correction(
        match_id=match_id,
        user_id=current_user.id,
        correction_type=CorrectionType.EVENT_ADD,
        event_id=event.id,
        frame_number=event.frame_start,
        corrected_value={"event_type": event.event_type.value},
    )
    db.add(correction)
    db.commit()

    return event


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    match_id: int,
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get an event by ID."""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.match_id == match_id
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return event


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    match_id: int,
    event_id: int,
    event_data: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Update an event (correct AI prediction)."""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.match_id == match_id
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Store original values
    original_values = {}
    corrected_values = {}

    update_data = event_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        original_value = getattr(event, key)
        if original_value != value:
            original_values[key] = str(original_value) if original_value else None
            corrected_values[key] = str(value) if value else None

        setattr(event, key, value)

    # Mark as corrected if this was an AI event
    if event.is_ai_generated and corrected_values:
        event.is_corrected = True

    db.commit()

    # Create correction record
    if corrected_values:
        # Determine correction type
        if "event_type" in corrected_values:
            correction_type = CorrectionType.EVENT_TYPE
        elif "player_track_id" in corrected_values or "player_id" in corrected_values:
            correction_type = CorrectionType.EVENT_PLAYER
        elif "target_track_id" in corrected_values or "target_player_id" in corrected_values:
            correction_type = CorrectionType.EVENT_TARGET
        elif "outcome_success" in corrected_values:
            correction_type = CorrectionType.EVENT_OUTCOME
        elif any(k in corrected_values for k in ["start_x", "start_y", "end_x", "end_y"]):
            correction_type = CorrectionType.EVENT_LOCATION
        elif "frame_start" in corrected_values or "frame_end" in corrected_values:
            correction_type = CorrectionType.EVENT_TIMING
        elif "is_deleted" in corrected_values and corrected_values["is_deleted"] == "True":
            correction_type = CorrectionType.EVENT_DELETE
        else:
            correction_type = CorrectionType.EVENT_DETAILS

        correction = Correction(
            match_id=match_id,
            user_id=current_user.id,
            correction_type=correction_type,
            event_id=event.id,
            frame_number=event.frame_start,
            original_value=original_values,
            corrected_value=corrected_values,
        )
        db.add(correction)
        db.commit()

    db.refresh(event)
    return event


@router.delete("/{event_id}")
async def delete_event(
    match_id: int,
    event_id: int,
    hard_delete: bool = Query(False, description="Permanently delete instead of soft delete"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Delete an event (soft delete by default for AI events)."""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.match_id == match_id
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if hard_delete or event.is_manually_added:
        # Actually delete manually added events or when explicitly requested
        db.delete(event)
    else:
        # Soft delete AI events (mark as deleted)
        event.is_deleted = True

        # Create correction record
        correction = Correction(
            match_id=match_id,
            user_id=current_user.id,
            correction_type=CorrectionType.EVENT_DELETE,
            event_id=event.id,
            frame_number=event.frame_start,
            original_value={"event_type": event.event_type.value},
            corrected_value={"is_deleted": True},
        )
        db.add(correction)

    db.commit()
    return {"message": "Event deleted"}
