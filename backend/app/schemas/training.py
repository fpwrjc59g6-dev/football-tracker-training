"""Training and accuracy schemas."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.models.training import ExportFormat, ExportType, MetricCategory


class TrainingExportCreate(BaseModel):
    """Schema for creating a training export."""
    export_type: ExportType
    export_format: ExportFormat
    match_ids: Optional[List[int]] = None  # None = all matches
    export_config: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class TrainingExportResponse(BaseModel):
    """Schema for training export response."""
    id: int
    export_type: ExportType
    export_format: ExportFormat
    match_ids: Optional[List[int]]
    correction_count: int
    frame_count: int
    event_count: int
    data_start_date: Optional[datetime]
    data_end_date: Optional[datetime]
    file_path: Optional[str]
    file_size_bytes: Optional[int]
    export_config: Optional[Dict[str, Any]]
    notes: Optional[str]
    created_by_user_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class AccuracyMetricResponse(BaseModel):
    """Schema for accuracy metric response."""
    id: int
    match_id: int
    category: MetricCategory
    accuracy: float
    precision: Optional[float]
    recall: Optional[float]
    f1_score: Optional[float]
    total_predictions: int
    correct_predictions: int
    false_positives: int
    false_negatives: int
    breakdown: Optional[Dict[str, float]]
    corrections_count: int
    calculated_at: datetime

    class Config:
        from_attributes = True


class AccuracyTrend(BaseModel):
    """Schema for accuracy trend over time."""
    period_start: datetime
    period_end: datetime
    category: MetricCategory
    accuracy: float
    matches_count: int
    total_corrections: int
    model_version: Optional[str]


class AccuracyDashboard(BaseModel):
    """Schema for full accuracy dashboard."""
    # Current overall accuracy
    overall_accuracy: float

    # By category
    detection_accuracy: Optional[float]
    tracking_accuracy: Optional[float]
    team_assignment_accuracy: Optional[float]
    jersey_recognition_accuracy: Optional[float]
    event_detection_accuracy: Optional[float]

    # Trends (last N periods)
    trends: List[AccuracyTrend]

    # Totals
    total_matches_processed: int
    total_corrections_made: int
    total_events_reviewed: int
    total_tracks_reviewed: int

    # By event type breakdown
    event_type_accuracy: Dict[str, float]

    # Recent matches
    recent_matches: List[Dict[str, Any]]


class AccuracyComparison(BaseModel):
    """Schema for comparing AI vs ground truth."""
    match_id: int

    # Event comparison
    ai_events_count: int
    ground_truth_events_count: int
    matched_events: int
    false_positives: int
    false_negatives: int
    event_accuracy: float

    # By event type
    event_type_breakdown: Dict[str, Dict[str, int]]

    # Track comparison
    ai_tracks_count: int
    corrected_tracks_count: int
    track_accuracy: float

    # Team assignment
    team_assignment_accuracy: float

    # Jersey number
    jersey_recognition_accuracy: float
