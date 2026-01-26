"""Calibration schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.calibration import CalibrationPointType


class CalibrationPointCreate(BaseModel):
    """Schema for creating a calibration point."""
    point_type: CalibrationPointType
    pixel_x: float
    pixel_y: float
    pitch_x: float
    pitch_y: float
    custom_label: Optional[str] = None


class CalibrationPointResponse(BaseModel):
    """Schema for calibration point response."""
    id: int
    calibration_id: int
    point_type: CalibrationPointType
    pixel_x: float
    pixel_y: float
    pitch_x: float
    pitch_y: float
    custom_label: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CalibrationCreate(BaseModel):
    """Schema for creating/updating calibration."""
    match_id: int
    pitch_length: float = 105.0
    pitch_width: float = 68.0
    calibration_frame: Optional[int] = None
    points: List[CalibrationPointCreate]


class CalibrationResponse(BaseModel):
    """Schema for calibration response."""
    id: int
    match_id: int
    pitch_length: float
    pitch_width: float
    homography_matrix: Optional[List[float]]
    inverse_homography_matrix: Optional[List[float]]
    reprojection_error: Optional[float]
    is_valid: bool
    calibration_frame: Optional[int]
    calibrated_by_user_id: Optional[int]
    points: List[CalibrationPointResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CalibrationStatus(BaseModel):
    """Schema for calibration status check."""
    match_id: int
    is_calibrated: bool
    point_count: int
    is_valid: bool
    reprojection_error: Optional[float]
