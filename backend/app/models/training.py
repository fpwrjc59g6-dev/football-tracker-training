"""Training and accuracy tracking models."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Enum, Text, JSON
)
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class ExportFormat(str, enum.Enum):
    """Training data export formats."""
    PYTORCH = "pytorch"  # PyTorch dataset format
    TENSORFLOW = "tensorflow"  # TensorFlow format
    YOLO = "yolo"  # YOLO annotation format
    COCO = "coco"  # COCO format
    CSV = "csv"  # Generic CSV
    JSON = "json"  # Generic JSON


class ExportType(str, enum.Enum):
    """What type of training data to export."""
    DETECTION = "detection"  # Player/ball detection training
    TRACKING = "tracking"  # Re-ID and tracking training
    TEAM_CLASSIFICATION = "team_classification"  # Team assignment training
    JERSEY_RECOGNITION = "jersey_recognition"  # Jersey number OCR training
    EVENT_DETECTION = "event_detection"  # Event classification training
    ALL = "all"  # Everything


class TrainingExport(Base):
    """Record of a training data export."""
    __tablename__ = "training_exports"

    id = Column(Integer, primary_key=True, index=True)

    # Export configuration
    export_type = Column(Enum(ExportType), nullable=False)
    export_format = Column(Enum(ExportFormat), nullable=False)

    # What was included
    match_ids = Column(JSON, nullable=True)  # List of match IDs included
    correction_count = Column(Integer, default=0, nullable=False)
    frame_count = Column(Integer, default=0, nullable=False)
    event_count = Column(Integer, default=0, nullable=False)

    # Date range of data
    data_start_date = Column(DateTime, nullable=True)
    data_end_date = Column(DateTime, nullable=True)

    # Export file info
    file_path = Column(String(500), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)

    # Export metadata
    export_config = Column(JSON, nullable=True)  # Full config used
    notes = Column(Text, nullable=True)

    # User who created export
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    created_by = relationship("User")
    corrections = relationship("Correction", back_populates="training_export")

    def __repr__(self):
        return f"<TrainingExport {self.export_type.value} at {self.created_at}>"


class MetricCategory(str, enum.Enum):
    """Categories of accuracy metrics."""
    DETECTION = "detection"  # Player/ball detection
    TRACKING = "tracking"  # Track continuity
    TEAM_ASSIGNMENT = "team_assignment"  # Team classification
    JERSEY_RECOGNITION = "jersey_recognition"  # Jersey OCR
    EVENT_DETECTION = "event_detection"  # Event recognition
    EVENT_CLASSIFICATION = "event_classification"  # Event type
    EVENT_PLAYERS = "event_players"  # Player assignment in events
    OVERALL = "overall"  # Combined score


class AccuracyMetric(Base):
    """Accuracy metrics comparing AI predictions to ground truth."""
    __tablename__ = "accuracy_metrics"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)

    # Metric category
    category = Column(Enum(MetricCategory), nullable=False, index=True)

    # Accuracy scores (0-100)
    accuracy = Column(Float, nullable=False)  # Overall accuracy
    precision = Column(Float, nullable=True)  # Precision score
    recall = Column(Float, nullable=True)  # Recall score
    f1_score = Column(Float, nullable=True)  # F1 score

    # Counts
    total_predictions = Column(Integer, default=0, nullable=False)
    correct_predictions = Column(Integer, default=0, nullable=False)
    false_positives = Column(Integer, default=0, nullable=False)
    false_negatives = Column(Integer, default=0, nullable=False)

    # Breakdown by sub-category (JSON for flexibility)
    # e.g., for events: {"pass": 0.85, "shot": 0.72, "tackle": 0.68}
    breakdown = Column(JSON, nullable=True)

    # Comparison info
    compared_to_corrections = Column(Boolean, default=True, nullable=False)
    corrections_count = Column(Integer, default=0, nullable=False)

    # Timestamps
    calculated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    match = relationship("Match", back_populates="accuracy_metrics")

    def __repr__(self):
        return f"<AccuracyMetric {self.category.value}: {self.accuracy:.1f}%>"


class AccuracyHistory(Base):
    """Historical accuracy tracking across all matches over time."""
    __tablename__ = "accuracy_history"

    id = Column(Integer, primary_key=True, index=True)

    # Time period
    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False)

    # Metric category
    category = Column(Enum(MetricCategory), nullable=False, index=True)

    # Aggregated accuracy
    accuracy = Column(Float, nullable=False)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)

    # Counts
    matches_count = Column(Integer, default=0, nullable=False)
    total_predictions = Column(Integer, default=0, nullable=False)
    total_corrections = Column(Integer, default=0, nullable=False)

    # Breakdown
    breakdown = Column(JSON, nullable=True)

    # Model version (if tracked)
    model_version = Column(String(100), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<AccuracyHistory {self.category.value}: {self.accuracy:.1f}% ({self.period_start.date()})>"
