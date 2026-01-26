"""Tracking data schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.tracking import TeamSide, DetectionClass


# ============================================================================
# DETECTION SCHEMAS
# ============================================================================

class DetectionResponse(BaseModel):
    """Schema for detection response."""
    id: int
    frame_id: int
    track_id: Optional[int]

    # Bounding box
    bbox_x1: float
    bbox_y1: float
    bbox_x2: float
    bbox_y2: float

    # Center and foot position
    center_x: float
    center_y: float
    foot_x: float
    foot_y: float

    # Calibrated coordinates
    pitch_x: Optional[float]
    pitch_y: Optional[float]

    # Classification
    confidence: float
    ai_detection_class: DetectionClass
    ai_team: TeamSide

    class Config:
        from_attributes = True


# ============================================================================
# TRACK SCHEMAS
# ============================================================================

class TrackResponse(BaseModel):
    """Schema for track response."""
    id: int
    match_id: int
    track_id: int

    # AI predictions
    ai_team: TeamSide
    ai_detection_class: DetectionClass
    ai_jersey_number: Optional[int]

    # Corrected values
    corrected_team: Optional[TeamSide]
    corrected_detection_class: Optional[DetectionClass]
    corrected_jersey_number: Optional[int]

    # Player assignment
    assigned_player_id: Optional[int]

    # Effective values (corrected or AI)
    team: TeamSide
    detection_class: DetectionClass
    jersey_number: Optional[int]

    # Track lifecycle
    first_frame: int
    last_frame: int
    total_detections: int

    # Physical metrics
    avg_confidence: Optional[float]
    total_distance_m: Optional[float]
    max_speed_ms: Optional[float]
    avg_speed_ms: Optional[float]
    sprint_count: Optional[int]

    # Status
    is_reviewed: bool
    is_corrected: bool

    class Config:
        from_attributes = True


class TrackUpdate(BaseModel):
    """Schema for updating a track."""
    corrected_team: Optional[TeamSide] = None
    corrected_detection_class: Optional[DetectionClass] = None
    corrected_jersey_number: Optional[int] = None
    assigned_player_id: Optional[int] = None
    is_reviewed: Optional[bool] = None


class TrackListResponse(BaseModel):
    """Schema for listing tracks with summary info."""
    id: int
    track_id: int
    team: TeamSide
    detection_class: DetectionClass
    jersey_number: Optional[int]
    assigned_player_id: Optional[int]
    first_frame: int
    last_frame: int
    total_detections: int
    is_reviewed: bool
    is_corrected: bool
    total_distance_m: Optional[float]
    max_speed_ms: Optional[float]

    class Config:
        from_attributes = True


# ============================================================================
# BALL POSITION SCHEMAS
# ============================================================================

class BallPositionResponse(BaseModel):
    """Schema for ball position response."""
    id: int
    frame_id: int

    # Pixel coordinates
    pixel_x: float
    pixel_y: float

    # Pitch coordinates
    pitch_x: Optional[float]
    pitch_y: Optional[float]

    # Status
    confidence: float
    is_visible: bool
    is_in_play: bool
    is_corrected: bool

    # Corrections
    corrected_x: Optional[float]
    corrected_y: Optional[float]

    class Config:
        from_attributes = True


class BallPositionUpdate(BaseModel):
    """Schema for updating ball position."""
    corrected_x: Optional[float] = None
    corrected_y: Optional[float] = None
    is_visible: Optional[bool] = None
    is_in_play: Optional[bool] = None


# ============================================================================
# FRAME SCHEMAS
# ============================================================================

class FrameResponse(BaseModel):
    """Schema for frame response with all data."""
    id: int
    match_id: int
    frame_number: int
    timestamp_ms: Optional[int]

    # Related data
    detections: List[DetectionResponse]
    ball_position: Optional[BallPositionResponse]

    class Config:
        from_attributes = True


class FrameSummary(BaseModel):
    """Schema for frame summary (lightweight)."""
    frame_number: int
    detection_count: int
    has_ball: bool
    event_count: int

    class Config:
        from_attributes = True
