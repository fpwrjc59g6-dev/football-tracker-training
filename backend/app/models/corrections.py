"""Correction models - tracking all human corrections for training."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Enum, Text, JSON
)
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class CorrectionType(str, enum.Enum):
    """Types of corrections that can be made."""

    # Track corrections
    TRACK_TEAM_ASSIGNMENT = "track_team_assignment"  # Wrong team assigned
    TRACK_PLAYER_ID = "track_player_id"  # Wrong player identified
    TRACK_JERSEY_NUMBER = "track_jersey_number"  # Wrong jersey number
    TRACK_CLASS = "track_class"  # Wrong class (player/referee/etc)
    TRACK_MERGE = "track_merge"  # Two tracks should be one
    TRACK_SPLIT = "track_split"  # One track should be two
    TRACK_DELETE = "track_delete"  # False positive track

    # Detection corrections
    DETECTION_BBOX = "detection_bbox"  # Bounding box wrong
    DETECTION_ADD = "detection_add"  # Missing detection
    DETECTION_DELETE = "detection_delete"  # False positive detection

    # Ball corrections
    BALL_POSITION = "ball_position"  # Wrong ball position
    BALL_ADD = "ball_add"  # Missing ball detection
    BALL_DELETE = "ball_delete"  # False positive ball

    # Event corrections
    EVENT_TYPE = "event_type"  # Wrong event type
    EVENT_PLAYER = "event_player"  # Wrong player assigned
    EVENT_TARGET = "event_target"  # Wrong target player
    EVENT_OUTCOME = "event_outcome"  # Wrong success/fail
    EVENT_LOCATION = "event_location"  # Wrong location
    EVENT_TIMING = "event_timing"  # Wrong frame/time
    EVENT_ADD = "event_add"  # Missing event
    EVENT_DELETE = "event_delete"  # False positive event
    EVENT_DETAILS = "event_details"  # Other details wrong (body part, pressure, etc)

    # Calibration corrections
    CALIBRATION_POINT = "calibration_point"  # Calibration point adjustment


class Correction(Base):
    """Record of a correction made by a human reviewer."""
    __tablename__ = "corrections"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Correction type
    correction_type = Column(Enum(CorrectionType), nullable=False, index=True)

    # What was corrected (entity references)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True, index=True)
    frame_number = Column(Integer, nullable=True)
    detection_id = Column(Integer, ForeignKey("detections.id"), nullable=True)

    # The correction data
    # Original value (what AI predicted)
    original_value = Column(JSON, nullable=True)

    # Corrected value (what human said it should be)
    corrected_value = Column(JSON, nullable=True)

    # Optional notes from reviewer
    notes = Column(Text, nullable=True)

    # Confidence of reviewer (optional self-assessment)
    reviewer_confidence = Column(Float, nullable=True)  # 0-1

    # Has this correction been used in training?
    used_in_training = Column(Boolean, default=False, nullable=False)
    training_export_id = Column(Integer, ForeignKey("training_exports.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    match = relationship("Match", back_populates="corrections")
    user = relationship("User", back_populates="corrections")
    track = relationship("Track")
    event = relationship("Event")
    detection = relationship("Detection")
    training_export = relationship("TrainingExport", back_populates="corrections")

    def __repr__(self):
        return f"<Correction {self.correction_type.value} by user {self.user_id}>"
