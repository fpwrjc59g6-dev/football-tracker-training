"""Calibration router."""
import numpy as np
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.calibration import PitchCalibration, CalibrationPoint, STANDARD_PITCH_COORDINATES
from app.models.team import Match
from app.models.user import User
from app.schemas.calibration import (
    CalibrationCreate, CalibrationResponse, CalibrationPointCreate,
    CalibrationPointResponse, CalibrationStatus
)
from app.auth import get_current_user, require_analyst

router = APIRouter(prefix="/matches/{match_id}/calibration", tags=["Calibration"])


def compute_homography(src_points: np.ndarray, dst_points: np.ndarray) -> np.ndarray:
    """
    Compute homography matrix from source to destination points.
    Uses DLT (Direct Linear Transform) algorithm.

    Args:
        src_points: Nx2 array of source (pixel) coordinates
        dst_points: Nx2 array of destination (pitch) coordinates

    Returns:
        3x3 homography matrix
    """
    n = src_points.shape[0]
    if n < 4:
        raise ValueError("Need at least 4 points for homography")

    # Build matrix A for DLT
    A = []
    for i in range(n):
        x, y = src_points[i]
        u, v = dst_points[i]
        A.append([-x, -y, -1, 0, 0, 0, u*x, u*y, u])
        A.append([0, 0, 0, -x, -y, -1, v*x, v*y, v])

    A = np.array(A)

    # Solve using SVD
    _, _, Vt = np.linalg.svd(A)
    H = Vt[-1].reshape(3, 3)

    # Normalize
    H = H / H[2, 2]

    return H


def compute_reprojection_error(H: np.ndarray, src_points: np.ndarray, dst_points: np.ndarray) -> float:
    """Compute average reprojection error in destination units (meters)."""
    n = src_points.shape[0]
    total_error = 0.0

    for i in range(n):
        # Transform source point
        src = np.array([src_points[i, 0], src_points[i, 1], 1.0])
        projected = H @ src
        projected = projected / projected[2]

        # Compute error
        error = np.sqrt((projected[0] - dst_points[i, 0])**2 + (projected[1] - dst_points[i, 1])**2)
        total_error += error

    return total_error / n


@router.get("", response_model=CalibrationResponse)
async def get_calibration(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get calibration for a match."""
    calibration = db.query(PitchCalibration).filter(
        PitchCalibration.match_id == match_id
    ).first()

    if not calibration:
        raise HTTPException(status_code=404, detail="Calibration not found")

    return calibration


@router.get("/status", response_model=CalibrationStatus)
async def get_calibration_status(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get calibration status for a match."""
    calibration = db.query(PitchCalibration).filter(
        PitchCalibration.match_id == match_id
    ).first()

    if not calibration:
        return CalibrationStatus(
            match_id=match_id,
            is_calibrated=False,
            point_count=0,
            is_valid=False,
            reprojection_error=None,
        )

    point_count = db.query(CalibrationPoint).filter(
        CalibrationPoint.calibration_id == calibration.id
    ).count()

    return CalibrationStatus(
        match_id=match_id,
        is_calibrated=True,
        point_count=point_count,
        is_valid=calibration.is_valid,
        reprojection_error=calibration.reprojection_error,
    )


@router.post("", response_model=CalibrationResponse)
async def create_or_update_calibration(
    match_id: int,
    calibration_data: CalibrationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Create or update calibration for a match."""
    # Verify match exists
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Need at least 4 points for homography
    if len(calibration_data.points) < 4:
        raise HTTPException(
            status_code=400,
            detail="Need at least 4 calibration points for homography"
        )

    # Get or create calibration
    calibration = db.query(PitchCalibration).filter(
        PitchCalibration.match_id == match_id
    ).first()

    if calibration:
        # Delete existing points
        db.query(CalibrationPoint).filter(
            CalibrationPoint.calibration_id == calibration.id
        ).delete()
    else:
        calibration = PitchCalibration(match_id=match_id)
        db.add(calibration)

    calibration.pitch_length = calibration_data.pitch_length
    calibration.pitch_width = calibration_data.pitch_width
    calibration.calibration_frame = calibration_data.calibration_frame
    calibration.calibrated_by_user_id = current_user.id

    db.flush()  # Get calibration ID

    # Add points
    src_points = []
    dst_points = []

    for point_data in calibration_data.points:
        point = CalibrationPoint(
            calibration_id=calibration.id,
            point_type=point_data.point_type,
            pixel_x=point_data.pixel_x,
            pixel_y=point_data.pixel_y,
            pitch_x=point_data.pitch_x,
            pitch_y=point_data.pitch_y,
            custom_label=point_data.custom_label,
        )
        db.add(point)

        src_points.append([point_data.pixel_x, point_data.pixel_y])
        dst_points.append([point_data.pitch_x, point_data.pitch_y])

    # Compute homography
    src_points = np.array(src_points)
    dst_points = np.array(dst_points)

    try:
        H = compute_homography(src_points, dst_points)
        H_inv = np.linalg.inv(H)

        # Compute reprojection error
        error = compute_reprojection_error(H, src_points, dst_points)

        calibration.homography_matrix = H.flatten().tolist()
        calibration.inverse_homography_matrix = H_inv.flatten().tolist()
        calibration.reprojection_error = error
        calibration.is_valid = error < 1.0  # Less than 1 meter error

        # Update match calibration status
        match.is_calibrated = calibration.is_valid

    except Exception as e:
        calibration.is_valid = False
        calibration.homography_matrix = None
        calibration.inverse_homography_matrix = None
        match.is_calibrated = False

    db.commit()
    db.refresh(calibration)

    return calibration


@router.delete("")
async def delete_calibration(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Delete calibration for a match."""
    calibration = db.query(PitchCalibration).filter(
        PitchCalibration.match_id == match_id
    ).first()

    if not calibration:
        raise HTTPException(status_code=404, detail="Calibration not found")

    # Update match
    match = db.query(Match).filter(Match.id == match_id).first()
    if match:
        match.is_calibrated = False

    db.delete(calibration)
    db.commit()

    return {"message": "Calibration deleted"}


@router.get("/standard-points")
async def get_standard_pitch_points(
    current_user: User = Depends(get_current_user)
):
    """Get standard pitch point coordinates for reference."""
    return {
        point_type.value: {"x": coords[0], "y": coords[1]}
        for point_type, coords in STANDARD_PITCH_COORDINATES.items()
    }
