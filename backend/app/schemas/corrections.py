"""Correction schemas."""
from datetime import datetime
from typing import Optional, Any, Dict
from pydantic import BaseModel
from app.models.corrections import CorrectionType


class CorrectionCreate(BaseModel):
    """Schema for creating a correction."""
    match_id: int
    correction_type: CorrectionType

    # What was corrected
    track_id: Optional[int] = None
    event_id: Optional[int] = None
    frame_number: Optional[int] = None
    detection_id: Optional[int] = None

    # The values
    original_value: Optional[Dict[str, Any]] = None
    corrected_value: Optional[Dict[str, Any]] = None

    # Optional notes
    notes: Optional[str] = None
    reviewer_confidence: Optional[float] = None


class CorrectionResponse(BaseModel):
    """Schema for correction response."""
    id: int
    match_id: int
    user_id: int
    correction_type: CorrectionType

    # What was corrected
    track_id: Optional[int]
    event_id: Optional[int]
    frame_number: Optional[int]
    detection_id: Optional[int]

    # The values
    original_value: Optional[Dict[str, Any]]
    corrected_value: Optional[Dict[str, Any]]

    # Notes
    notes: Optional[str]
    reviewer_confidence: Optional[float]

    # Training status
    used_in_training: bool
    training_export_id: Optional[int]

    created_at: datetime

    class Config:
        from_attributes = True


class CorrectionSummary(BaseModel):
    """Schema for correction summary."""
    total_corrections: int
    by_type: Dict[str, int]
    by_user: Dict[str, int]
    used_in_training: int
    pending_training: int


class CorrectionBatch(BaseModel):
    """Schema for batch corrections."""
    corrections: list[CorrectionCreate]
