"""Event schemas."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.models.events import EventType, EventCategory, BodyPart, PassHeight, PitchZone


class EventCreate(BaseModel):
    """Schema for creating an event."""
    match_id: int
    frame_start: int
    frame_end: Optional[int] = None
    match_minute: Optional[int] = None
    match_second: Optional[int] = None
    half: int = 1

    event_type: EventType
    event_category: EventCategory

    # Players
    player_track_id: Optional[int] = None
    player_id: Optional[int] = None
    target_track_id: Optional[int] = None
    target_player_id: Optional[int] = None
    opponent_track_id: Optional[int] = None
    opponent_player_id: Optional[int] = None

    # Location - pixel coordinates
    start_x: Optional[float] = None
    start_y: Optional[float] = None
    end_x: Optional[float] = None
    end_y: Optional[float] = None

    # Location - pitch coordinates
    start_pitch_x: Optional[float] = None
    start_pitch_y: Optional[float] = None
    end_pitch_x: Optional[float] = None
    end_pitch_y: Optional[float] = None

    # Details
    outcome_success: Optional[bool] = None
    body_part: Optional[BodyPart] = None
    pass_height: Optional[PassHeight] = None
    start_zone: Optional[PitchZone] = None
    end_zone: Optional[PitchZone] = None

    # Context
    under_pressure: bool = False
    is_counter_attack: bool = False
    is_set_piece: bool = False
    is_first_touch: bool = False

    # Linked event
    related_event_id: Optional[int] = None

    # AI info
    is_ai_generated: bool = True
    ai_confidence: Optional[float] = None
    is_manually_added: bool = False

    # Additional data
    metadata: Optional[Dict[str, Any]] = None


class EventUpdate(BaseModel):
    """Schema for updating an event."""
    frame_start: Optional[int] = None
    frame_end: Optional[int] = None
    match_minute: Optional[int] = None
    match_second: Optional[int] = None
    half: Optional[int] = None

    event_type: Optional[EventType] = None
    event_category: Optional[EventCategory] = None

    # Players
    player_track_id: Optional[int] = None
    player_id: Optional[int] = None
    target_track_id: Optional[int] = None
    target_player_id: Optional[int] = None
    opponent_track_id: Optional[int] = None
    opponent_player_id: Optional[int] = None

    # Location - pixel coordinates
    start_x: Optional[float] = None
    start_y: Optional[float] = None
    end_x: Optional[float] = None
    end_y: Optional[float] = None

    # Location - pitch coordinates
    start_pitch_x: Optional[float] = None
    start_pitch_y: Optional[float] = None
    end_pitch_x: Optional[float] = None
    end_pitch_y: Optional[float] = None

    # Calculated
    distance_m: Optional[float] = None
    speed_ms: Optional[float] = None
    angle_deg: Optional[float] = None

    # Details
    outcome_success: Optional[bool] = None
    body_part: Optional[BodyPart] = None
    pass_height: Optional[PassHeight] = None
    start_zone: Optional[PitchZone] = None
    end_zone: Optional[PitchZone] = None

    # Context
    under_pressure: Optional[bool] = None
    is_counter_attack: Optional[bool] = None
    is_set_piece: Optional[bool] = None
    is_first_touch: Optional[bool] = None

    # Linked event
    related_event_id: Optional[int] = None

    # Correction
    is_corrected: Optional[bool] = None
    is_deleted: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_correct: Optional[bool] = None
    corrected_type: Optional[str] = None

    # Additional data
    metadata: Optional[Dict[str, Any]] = None


class EventResponse(BaseModel):
    """Schema for event response."""
    id: int
    match_id: int
    frame_start: int
    frame_end: Optional[int]
    timestamp_ms: Optional[int]
    match_minute: Optional[int]
    match_second: Optional[int]
    half: int

    event_type: EventType
    event_category: EventCategory

    # Players
    player_track_id: Optional[int]
    player_id: Optional[int]
    target_track_id: Optional[int]
    target_player_id: Optional[int]
    opponent_track_id: Optional[int]
    opponent_player_id: Optional[int]

    # Location - pixel coordinates
    start_x: Optional[float]
    start_y: Optional[float]
    end_x: Optional[float]
    end_y: Optional[float]

    # Location - pitch coordinates
    start_pitch_x: Optional[float]
    start_pitch_y: Optional[float]
    end_pitch_x: Optional[float]
    end_pitch_y: Optional[float]

    # Calculated
    distance_m: Optional[float]
    speed_ms: Optional[float]
    angle_deg: Optional[float]

    # Details
    outcome_success: Optional[bool]
    body_part: Optional[BodyPart]
    pass_height: Optional[PassHeight]
    start_zone: Optional[PitchZone]
    end_zone: Optional[PitchZone]

    # Context
    under_pressure: bool
    is_counter_attack: bool
    is_set_piece: bool
    is_first_touch: bool

    # Linked event
    related_event_id: Optional[int]

    # AI info
    is_ai_generated: bool
    ai_confidence: Optional[float]
    is_corrected: bool
    is_deleted: bool
    is_manually_added: bool
    is_verified: bool = False
    is_correct: Optional[bool] = None

    # Additional data - maps to event_metadata in database
    metadata: Optional[Dict[str, Any]] = Field(default=None, alias="event_metadata")

    # Timestamps
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


class EventListResponse(BaseModel):
    """Schema for listing events (lighter weight)."""
    id: int
    match_id: int
    frame_start: int
    timestamp_ms: Optional[int] = None
    match_minute: Optional[int] = None
    half: int
    event_type: EventType
    event_category: EventCategory
    player_track_id: Optional[int] = None
    outcome_success: Optional[bool] = None
    is_ai_generated: bool
    is_corrected: bool
    is_deleted: bool

    class Config:
        from_attributes = True


class EventSummary(BaseModel):
    """Schema for event summary statistics."""
    total_events: int
    by_category: Dict[str, int]
    by_type: Dict[str, int]
    ai_generated_count: int
    corrected_count: int
    deleted_count: int
    manually_added_count: int
