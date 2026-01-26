"""Pitch calibration models for pixel-to-meter conversion."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Enum, JSON
)
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class CalibrationPointType(str, enum.Enum):
    """Standard pitch reference points for calibration."""
    # Corners
    CORNER_TOP_LEFT = "corner_top_left"
    CORNER_TOP_RIGHT = "corner_top_right"
    CORNER_BOTTOM_LEFT = "corner_bottom_left"
    CORNER_BOTTOM_RIGHT = "corner_bottom_right"

    # Center
    CENTER_SPOT = "center_spot"
    CENTER_CIRCLE_TOP = "center_circle_top"
    CENTER_CIRCLE_BOTTOM = "center_circle_bottom"

    # Penalty areas - Left side
    PENALTY_AREA_TOP_LEFT = "penalty_area_top_left"
    PENALTY_AREA_BOTTOM_LEFT = "penalty_area_bottom_left"
    PENALTY_SPOT_LEFT = "penalty_spot_left"
    GOAL_AREA_TOP_LEFT = "goal_area_top_left"
    GOAL_AREA_BOTTOM_LEFT = "goal_area_bottom_left"

    # Penalty areas - Right side
    PENALTY_AREA_TOP_RIGHT = "penalty_area_top_right"
    PENALTY_AREA_BOTTOM_RIGHT = "penalty_area_bottom_right"
    PENALTY_SPOT_RIGHT = "penalty_spot_right"
    GOAL_AREA_TOP_RIGHT = "goal_area_top_right"
    GOAL_AREA_BOTTOM_RIGHT = "goal_area_bottom_right"

    # Goal posts
    GOAL_POST_TOP_LEFT = "goal_post_top_left"
    GOAL_POST_BOTTOM_LEFT = "goal_post_bottom_left"
    GOAL_POST_TOP_RIGHT = "goal_post_top_right"
    GOAL_POST_BOTTOM_RIGHT = "goal_post_bottom_right"

    # Halfway line intersections
    HALFWAY_TOP = "halfway_top"
    HALFWAY_BOTTOM = "halfway_bottom"

    # Custom point
    CUSTOM = "custom"


# Standard pitch dimensions (FIFA regulations in meters)
# Full pitch: 105m x 68m (can vary 100-110 x 64-75)
PITCH_DIMENSIONS = {
    "length": 105.0,
    "width": 68.0,
    "penalty_area_length": 16.5,
    "penalty_area_width": 40.3,
    "goal_area_length": 5.5,
    "goal_area_width": 18.3,
    "penalty_spot_distance": 11.0,
    "center_circle_radius": 9.15,
    "corner_arc_radius": 1.0,
    "goal_width": 7.32,
}

# Standard coordinates for calibration points (origin at center of pitch)
# X: -52.5 to 52.5 (left to right)
# Y: -34 to 34 (bottom to top)
STANDARD_PITCH_COORDINATES = {
    CalibrationPointType.CORNER_TOP_LEFT: (-52.5, 34.0),
    CalibrationPointType.CORNER_TOP_RIGHT: (52.5, 34.0),
    CalibrationPointType.CORNER_BOTTOM_LEFT: (-52.5, -34.0),
    CalibrationPointType.CORNER_BOTTOM_RIGHT: (52.5, -34.0),

    CalibrationPointType.CENTER_SPOT: (0.0, 0.0),
    CalibrationPointType.CENTER_CIRCLE_TOP: (0.0, 9.15),
    CalibrationPointType.CENTER_CIRCLE_BOTTOM: (0.0, -9.15),

    CalibrationPointType.PENALTY_AREA_TOP_LEFT: (-52.5 + 16.5, 20.15),
    CalibrationPointType.PENALTY_AREA_BOTTOM_LEFT: (-52.5 + 16.5, -20.15),
    CalibrationPointType.PENALTY_SPOT_LEFT: (-52.5 + 11.0, 0.0),
    CalibrationPointType.GOAL_AREA_TOP_LEFT: (-52.5 + 5.5, 9.15),
    CalibrationPointType.GOAL_AREA_BOTTOM_LEFT: (-52.5 + 5.5, -9.15),

    CalibrationPointType.PENALTY_AREA_TOP_RIGHT: (52.5 - 16.5, 20.15),
    CalibrationPointType.PENALTY_AREA_BOTTOM_RIGHT: (52.5 - 16.5, -20.15),
    CalibrationPointType.PENALTY_SPOT_RIGHT: (52.5 - 11.0, 0.0),
    CalibrationPointType.GOAL_AREA_TOP_RIGHT: (52.5 - 5.5, 9.15),
    CalibrationPointType.GOAL_AREA_BOTTOM_RIGHT: (52.5 - 5.5, -9.15),

    CalibrationPointType.GOAL_POST_TOP_LEFT: (-52.5, 3.66),
    CalibrationPointType.GOAL_POST_BOTTOM_LEFT: (-52.5, -3.66),
    CalibrationPointType.GOAL_POST_TOP_RIGHT: (52.5, 3.66),
    CalibrationPointType.GOAL_POST_BOTTOM_RIGHT: (52.5, -3.66),

    CalibrationPointType.HALFWAY_TOP: (0.0, 34.0),
    CalibrationPointType.HALFWAY_BOTTOM: (0.0, -34.0),
}


class PitchCalibration(Base):
    """Pitch calibration data for a match."""
    __tablename__ = "pitch_calibrations"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, unique=True, index=True)

    # Pitch dimensions (can override defaults)
    pitch_length = Column(Float, default=105.0, nullable=False)
    pitch_width = Column(Float, default=68.0, nullable=False)

    # Homography matrix (3x3 flattened to 9 values)
    # Transforms pixel coordinates to pitch coordinates
    homography_matrix = Column(JSON, nullable=True)

    # Inverse homography (pitch to pixel)
    inverse_homography_matrix = Column(JSON, nullable=True)

    # Calibration quality metrics
    reprojection_error = Column(Float, nullable=True)  # Average error in meters
    is_valid = Column(Boolean, default=False, nullable=False)

    # Frame used for calibration
    calibration_frame = Column(Integer, nullable=True)

    # Status
    calibrated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    match = relationship("Match", back_populates="calibration")
    calibrated_by = relationship("User")
    points = relationship("CalibrationPoint", back_populates="calibration", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<PitchCalibration for match {self.match_id}>"


class CalibrationPoint(Base):
    """Individual calibration point mapping pixel to pitch coordinates."""
    __tablename__ = "calibration_points"

    id = Column(Integer, primary_key=True, index=True)
    calibration_id = Column(Integer, ForeignKey("pitch_calibrations.id"), nullable=False, index=True)

    # Point type
    point_type = Column(Enum(CalibrationPointType), nullable=False)

    # Pixel coordinates (from video frame)
    pixel_x = Column(Float, nullable=False)
    pixel_y = Column(Float, nullable=False)

    # Pitch coordinates (in meters, relative to center)
    pitch_x = Column(Float, nullable=False)
    pitch_y = Column(Float, nullable=False)

    # For custom points, optional label
    custom_label = Column(String(100), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    calibration = relationship("PitchCalibration", back_populates="points")

    def __repr__(self):
        return f"<CalibrationPoint {self.point_type.value}>"
