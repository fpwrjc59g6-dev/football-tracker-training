"""Tracking data models - frames, detections, tracks, ball positions."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Enum, Index
)
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class TeamSide(str, enum.Enum):
    """Which team a detection belongs to."""
    HOME = "home"
    AWAY = "away"
    REFEREE = "referee"
    LINESMAN = "linesman"
    UNKNOWN = "unknown"


class DetectionClass(str, enum.Enum):
    """Detection classification from the AI model."""
    PLAYER = "player"
    GOALKEEPER = "goalkeeper"
    REFEREE = "referee"
    LINESMAN = "linesman"
    BALL = "ball"
    UNKNOWN = "unknown"


class Frame(Base):
    """Single video frame with all detections."""
    __tablename__ = "frames"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)

    # Frame info
    frame_number = Column(Integer, nullable=False, index=True)
    timestamp_ms = Column(Integer, nullable=True)  # Milliseconds from start

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    match = relationship("Match", back_populates="frames")
    detections = relationship("Detection", back_populates="frame", cascade="all, delete-orphan")
    ball_position = relationship("BallPosition", back_populates="frame", uselist=False, cascade="all, delete-orphan")

    # Composite index for efficient queries
    __table_args__ = (
        Index("idx_frame_match_number", "match_id", "frame_number"),
    )

    def __repr__(self):
        return f"<Frame {self.frame_number} of match {self.match_id}>"


class Track(Base):
    """A tracked entity across multiple frames (person track)."""
    __tablename__ = "tracks"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)

    # Track identification
    track_id = Column(Integer, nullable=False, index=True)  # Original track ID from tracker

    # Classification (AI predicted)
    ai_team = Column(Enum(TeamSide), default=TeamSide.UNKNOWN, nullable=False)
    ai_detection_class = Column(Enum(DetectionClass), default=DetectionClass.PLAYER, nullable=False)
    ai_jersey_number = Column(Integer, nullable=True)

    # Corrected values (ground truth after human review)
    corrected_team = Column(Enum(TeamSide), nullable=True)
    corrected_detection_class = Column(Enum(DetectionClass), nullable=True)
    corrected_jersey_number = Column(Integer, nullable=True)

    # Player assignment
    assigned_player_id = Column(Integer, ForeignKey("players.id"), nullable=True)

    # Track lifecycle
    first_frame = Column(Integer, nullable=False)
    last_frame = Column(Integer, nullable=False)
    total_detections = Column(Integer, default=0, nullable=False)

    # Confidence metrics
    avg_confidence = Column(Float, nullable=True)

    # Physical metrics (calculated from calibrated coordinates)
    total_distance_m = Column(Float, nullable=True)
    max_speed_ms = Column(Float, nullable=True)
    avg_speed_ms = Column(Float, nullable=True)
    sprint_count = Column(Integer, nullable=True)  # Speed > 7 m/s

    # Correction status
    is_reviewed = Column(Boolean, default=False, nullable=False)
    is_corrected = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    match = relationship("Match", back_populates="tracks")
    assigned_player = relationship("Player")
    detections = relationship("Detection", back_populates="track")

    # Composite index
    __table_args__ = (
        Index("idx_track_match_trackid", "match_id", "track_id"),
    )

    @property
    def team(self):
        """Get effective team (corrected or AI)."""
        return self.corrected_team or self.ai_team

    @property
    def detection_class(self):
        """Get effective detection class (corrected or AI)."""
        return self.corrected_detection_class or self.ai_detection_class

    @property
    def jersey_number(self):
        """Get effective jersey number (corrected or AI)."""
        return self.corrected_jersey_number or self.ai_jersey_number

    def __repr__(self):
        return f"<Track {self.track_id} in match {self.match_id}>"


class Detection(Base):
    """Single detection in a frame."""
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    frame_id = Column(Integer, ForeignKey("frames.id"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=True, index=True)

    # Bounding box (pixel coordinates)
    bbox_x1 = Column(Float, nullable=False)
    bbox_y1 = Column(Float, nullable=False)
    bbox_x2 = Column(Float, nullable=False)
    bbox_y2 = Column(Float, nullable=False)

    # Center point (pixel coordinates)
    center_x = Column(Float, nullable=False)
    center_y = Column(Float, nullable=False)

    # Foot position estimate (bottom center of bbox, pixel coordinates)
    foot_x = Column(Float, nullable=False)
    foot_y = Column(Float, nullable=False)

    # Calibrated pitch coordinates (meters from center, null if not calibrated)
    pitch_x = Column(Float, nullable=True)  # Meters from center line
    pitch_y = Column(Float, nullable=True)  # Meters from halfway line

    # Detection confidence
    confidence = Column(Float, nullable=False)

    # AI predictions for this detection
    ai_detection_class = Column(Enum(DetectionClass), default=DetectionClass.PLAYER, nullable=False)
    ai_team = Column(Enum(TeamSide), default=TeamSide.UNKNOWN, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    frame = relationship("Frame", back_populates="detections")
    track = relationship("Track", back_populates="detections")

    # Composite index for efficient queries
    __table_args__ = (
        Index("idx_detection_frame_track", "frame_id", "track_id"),
    )

    def __repr__(self):
        return f"<Detection in frame {self.frame_id}>"


class BallPosition(Base):
    """Ball position in a frame."""
    __tablename__ = "ball_positions"

    id = Column(Integer, primary_key=True, index=True)
    frame_id = Column(Integer, ForeignKey("frames.id"), nullable=False, unique=True, index=True)

    # Pixel coordinates
    pixel_x = Column(Float, nullable=False)
    pixel_y = Column(Float, nullable=False)

    # Calibrated pitch coordinates (meters)
    pitch_x = Column(Float, nullable=True)
    pitch_y = Column(Float, nullable=True)

    # Detection confidence
    confidence = Column(Float, nullable=False)

    # Status
    is_visible = Column(Boolean, default=True, nullable=False)
    is_in_play = Column(Boolean, default=True, nullable=False)

    # Corrections
    is_corrected = Column(Boolean, default=False, nullable=False)
    corrected_x = Column(Float, nullable=True)
    corrected_y = Column(Float, nullable=True)

    # Relationships
    frame = relationship("Frame", back_populates="ball_position")

    def __repr__(self):
        return f"<BallPosition in frame {self.frame_id}>"
