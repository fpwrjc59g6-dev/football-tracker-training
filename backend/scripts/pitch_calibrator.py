"""
Football Tracker - Pitch Calibration
Converts pixel coordinates to real-world pitch positions (metres) using homography.
"""

import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any
import json


@dataclass
class PitchConfig:
    """
    Standard football pitch configuration with known keypoint positions.

    Pitch dimensions: 105m x 68m (FIFA standard)
    Origin (0, 0) is at the bottom-left corner when facing the pitch.
    X-axis runs along the length (0 to 105m)
    Y-axis runs along the width (0 to 68m)
    """

    # Pitch dimensions in metres
    length: float = 105.0
    width: float = 68.0

    # Goal dimensions
    goal_width: float = 7.32
    goal_area_length: float = 5.5
    goal_area_width: float = 18.32

    # Penalty area dimensions
    penalty_area_length: float = 16.5
    penalty_area_width: float = 40.32
    penalty_spot_distance: float = 11.0

    # Centre circle
    centre_circle_radius: float = 9.15

    # Corner arc
    corner_arc_radius: float = 1.0

    @property
    def centre_x(self) -> float:
        return self.length / 2  # 52.5m

    @property
    def centre_y(self) -> float:
        return self.width / 2  # 34m

    @property
    def keypoints(self) -> Dict[str, Tuple[float, float]]:
        """
        Return all standard pitch keypoints with their real-world coordinates.
        These are the points that can be matched to pixel positions for calibration.

        Returns dict mapping keypoint name to (x, y) in metres.
        """
        cx = self.centre_x  # 52.5
        cy = self.centre_y  # 34.0

        # Penalty area calculations
        pa_y_min = cy - self.penalty_area_width / 2  # 34 - 20.16 = 13.84
        pa_y_max = cy + self.penalty_area_width / 2  # 34 + 20.16 = 54.16

        # Goal area calculations
        ga_y_min = cy - self.goal_area_width / 2  # 34 - 9.16 = 24.84
        ga_y_max = cy + self.goal_area_width / 2  # 34 + 9.16 = 43.16

        return {
            # Corner points
            'corner_bottom_left': (0.0, 0.0),
            'corner_bottom_right': (self.length, 0.0),
            'corner_top_left': (0.0, self.width),
            'corner_top_right': (self.length, self.width),

            # Centre circle / halfway line intersections
            'centre_spot': (cx, cy),
            'halfway_bottom': (cx, 0.0),
            'halfway_top': (cx, self.width),
            'centre_circle_left': (cx - self.centre_circle_radius, cy),
            'centre_circle_right': (cx + self.centre_circle_radius, cy),

            # Left penalty area (x = 0 side)
            'left_penalty_area_top_left': (0.0, pa_y_max),
            'left_penalty_area_top_right': (self.penalty_area_length, pa_y_max),
            'left_penalty_area_bottom_left': (0.0, pa_y_min),
            'left_penalty_area_bottom_right': (self.penalty_area_length, pa_y_min),
            'left_penalty_spot': (self.penalty_spot_distance, cy),

            # Left goal area
            'left_goal_area_top_left': (0.0, ga_y_max),
            'left_goal_area_top_right': (self.goal_area_length, ga_y_max),
            'left_goal_area_bottom_left': (0.0, ga_y_min),
            'left_goal_area_bottom_right': (self.goal_area_length, ga_y_min),

            # Right penalty area (x = 105 side)
            'right_penalty_area_top_left': (self.length - self.penalty_area_length, pa_y_max),
            'right_penalty_area_top_right': (self.length, pa_y_max),
            'right_penalty_area_bottom_left': (self.length - self.penalty_area_length, pa_y_min),
            'right_penalty_area_bottom_right': (self.length, pa_y_min),
            'right_penalty_spot': (self.length - self.penalty_spot_distance, cy),

            # Right goal area
            'right_goal_area_top_left': (self.length - self.goal_area_length, ga_y_max),
            'right_goal_area_top_right': (self.length, ga_y_max),
            'right_goal_area_bottom_left': (self.length - self.goal_area_length, ga_y_min),
            'right_goal_area_bottom_right': (self.length, ga_y_min),

            # Penalty arc intersections (where arc meets penalty area line)
            # These are at distance 9.15m from penalty spot, on the penalty area line
            'left_penalty_arc_left': (self.penalty_area_length, cy - 7.3),  # Approximate
            'left_penalty_arc_right': (self.penalty_area_length, cy + 7.3),
            'right_penalty_arc_left': (self.length - self.penalty_area_length, cy - 7.3),
            'right_penalty_arc_right': (self.length - self.penalty_area_length, cy + 7.3),
        }

    def get_keypoint_position(self, name: str) -> Optional[Tuple[float, float]]:
        """Get position of a named keypoint."""
        return self.keypoints.get(name)

    def list_keypoint_names(self) -> List[str]:
        """List all available keypoint names."""
        return list(self.keypoints.keys())


@dataclass
class CalibrationResult:
    """Result of pitch calibration."""
    success: bool
    homography_matrix: Optional[np.ndarray]
    keypoints_used: List[str]
    reprojection_error: float
    num_inliers: int
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        return {
            'success': self.success,
            'matrix': self.homography_matrix.tolist() if self.homography_matrix is not None else None,
            'keypoints_used': self.keypoints_used,
            'reprojection_error': self.reprojection_error,
            'num_inliers': self.num_inliers,
            'error_message': self.error_message
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CalibrationResult':
        """Create from dict."""
        matrix = np.array(data['matrix']) if data.get('matrix') is not None else None
        return cls(
            success=data['success'],
            homography_matrix=matrix,
            keypoints_used=data.get('keypoints_used', []),
            reprojection_error=data.get('reprojection_error', 0.0),
            num_inliers=data.get('num_inliers', 0),
            error_message=data.get('error_message')
        )


class PitchCalibrator:
    """
    Converts pixel coordinates to real-world pitch positions using homography.

    Two calibration modes:
    1. Manual: Coach clicks known points on frame, provides pixel-to-pitch mappings
    2. Auto: Keypoint detection model provides point matches automatically

    Usage:
        calibrator = PitchCalibrator()

        # Manual calibration
        point_pairs = [
            (pixel_x1, pixel_y1, pitch_x1, pitch_y1),
            (pixel_x2, pixel_y2, pitch_x2, pitch_y2),
            ...  # minimum 4 points
        ]
        result = calibrator.calibrate_from_points(point_pairs)

        # Transform player positions
        pitch_x, pitch_y = calibrator.transform_point(pixel_x, pixel_y)
    """

    # Margin in metres for valid position check (players can be slightly off-pitch)
    POSITION_MARGIN = 5.0

    def __init__(self, config: Optional[PitchConfig] = None):
        """
        Initialize the pitch calibrator.

        Args:
            config: Pitch configuration (uses FIFA standard if not provided)
        """
        self.config = config or PitchConfig()
        self.homography_matrix: Optional[np.ndarray] = None
        self.inverse_matrix: Optional[np.ndarray] = None
        self.keypoints_used: List[str] = []
        self.reprojection_error: float = 0.0
        self.is_calibrated: bool = False

    def calibrate_from_points(
        self,
        point_pairs: List[Tuple[float, float, float, float]],
        keypoint_names: Optional[List[str]] = None
    ) -> CalibrationResult:
        """
        Calibrate from manual point pairs.

        Args:
            point_pairs: List of (pixel_x, pixel_y, pitch_x, pitch_y) tuples
                        Minimum 4 points required for homography
            keypoint_names: Optional names of the keypoints used (for logging)

        Returns:
            CalibrationResult with success status and homography matrix
        """
        if len(point_pairs) < 4:
            return CalibrationResult(
                success=False,
                homography_matrix=None,
                keypoints_used=keypoint_names or [],
                reprojection_error=0.0,
                num_inliers=0,
                error_message=f"Need at least 4 point pairs, got {len(point_pairs)}"
            )

        # Separate pixel and pitch coordinates
        pixel_points = np.array([[p[0], p[1]] for p in point_pairs], dtype=np.float32)
        pitch_points = np.array([[p[2], p[3]] for p in point_pairs], dtype=np.float32)

        try:
            # Compute homography with RANSAC for robustness
            H, mask = cv2.findHomography(
                pixel_points,
                pitch_points,
                method=cv2.RANSAC,
                ransacReprojThreshold=3.0
            )

            if H is None:
                return CalibrationResult(
                    success=False,
                    homography_matrix=None,
                    keypoints_used=keypoint_names or [],
                    reprojection_error=0.0,
                    num_inliers=0,
                    error_message="Homography computation failed"
                )

            # Count inliers
            num_inliers = int(np.sum(mask)) if mask is not None else len(point_pairs)

            # Calculate reprojection error
            reprojection_error = self._calculate_reprojection_error(
                pixel_points, pitch_points, H
            )

            # Store the homography
            self.homography_matrix = H
            self.inverse_matrix = np.linalg.inv(H)
            self.keypoints_used = keypoint_names or [f"point_{i}" for i in range(len(point_pairs))]
            self.reprojection_error = reprojection_error
            self.is_calibrated = True

            return CalibrationResult(
                success=True,
                homography_matrix=H,
                keypoints_used=self.keypoints_used,
                reprojection_error=reprojection_error,
                num_inliers=num_inliers
            )

        except Exception as e:
            return CalibrationResult(
                success=False,
                homography_matrix=None,
                keypoints_used=keypoint_names or [],
                reprojection_error=0.0,
                num_inliers=0,
                error_message=str(e)
            )

    def calibrate_from_keypoint_detections(
        self,
        detections: List[Dict[str, Any]],
        confidence_threshold: float = 0.5
    ) -> CalibrationResult:
        """
        Calibrate from automatic keypoint detections.

        Args:
            detections: List of keypoint detections with format:
                       {'name': str, 'pixel_x': float, 'pixel_y': float, 'confidence': float}
            confidence_threshold: Minimum confidence for including a keypoint

        Returns:
            CalibrationResult with success status and homography matrix
        """
        # Filter by confidence
        valid_detections = [
            d for d in detections
            if d.get('confidence', 0) >= confidence_threshold
        ]

        if len(valid_detections) < 4:
            return CalibrationResult(
                success=False,
                homography_matrix=None,
                keypoints_used=[],
                reprojection_error=0.0,
                num_inliers=0,
                error_message=f"Need at least 4 confident keypoints, got {len(valid_detections)}"
            )

        # Build point pairs from detected keypoints
        point_pairs = []
        keypoint_names = []

        for det in valid_detections:
            name = det.get('name', '')
            pitch_pos = self.config.get_keypoint_position(name)

            if pitch_pos is not None:
                point_pairs.append((
                    det['pixel_x'],
                    det['pixel_y'],
                    pitch_pos[0],
                    pitch_pos[1]
                ))
                keypoint_names.append(name)

        if len(point_pairs) < 4:
            return CalibrationResult(
                success=False,
                homography_matrix=None,
                keypoints_used=[],
                reprojection_error=0.0,
                num_inliers=0,
                error_message=f"Only {len(point_pairs)} keypoints matched to known positions"
            )

        return self.calibrate_from_points(point_pairs, keypoint_names)

    def transform_point(self, pixel_x: float, pixel_y: float) -> Optional[Tuple[float, float]]:
        """
        Transform a single pixel coordinate to pitch coordinates.

        Args:
            pixel_x: X coordinate in pixels
            pixel_y: Y coordinate in pixels

        Returns:
            Tuple of (pitch_x, pitch_y) in metres, or None if not calibrated
        """
        if not self.is_calibrated or self.homography_matrix is None:
            return None

        # Create point array for perspective transform
        point = np.array([[[pixel_x, pixel_y]]], dtype=np.float32)

        # Transform using homography
        transformed = cv2.perspectiveTransform(point, self.homography_matrix)

        pitch_x = float(transformed[0, 0, 0])
        pitch_y = float(transformed[0, 0, 1])

        return (pitch_x, pitch_y)

    def transform_points(self, pixel_coords: np.ndarray) -> Optional[np.ndarray]:
        """
        Transform multiple pixel coordinates to pitch coordinates.

        Args:
            pixel_coords: Nx2 array of pixel coordinates [[x1, y1], [x2, y2], ...]

        Returns:
            Nx2 array of pitch coordinates in metres, or None if not calibrated
        """
        if not self.is_calibrated or self.homography_matrix is None:
            return None

        if len(pixel_coords) == 0:
            return np.array([])

        # Reshape for perspectiveTransform: needs Nx1x2
        points = pixel_coords.reshape(-1, 1, 2).astype(np.float32)

        # Transform using homography
        transformed = cv2.perspectiveTransform(points, self.homography_matrix)

        # Reshape back to Nx2
        return transformed.reshape(-1, 2)

    def inverse_transform_point(self, pitch_x: float, pitch_y: float) -> Optional[Tuple[float, float]]:
        """
        Transform pitch coordinates back to pixel coordinates.
        Useful for drawing on frames.

        Args:
            pitch_x: X coordinate in metres
            pitch_y: Y coordinate in metres

        Returns:
            Tuple of (pixel_x, pixel_y), or None if not calibrated
        """
        if not self.is_calibrated or self.inverse_matrix is None:
            return None

        point = np.array([[[pitch_x, pitch_y]]], dtype=np.float32)
        transformed = cv2.perspectiveTransform(point, self.inverse_matrix)

        pixel_x = float(transformed[0, 0, 0])
        pixel_y = float(transformed[0, 0, 1])

        return (pixel_x, pixel_y)

    def is_valid_position(self, pitch_x: float, pitch_y: float) -> bool:
        """
        Check if a pitch position is within valid bounds.

        Allows a small margin for players who may be slightly off the pitch
        (e.g., taking throw-ins, behind the goal line).

        Args:
            pitch_x: X coordinate in metres
            pitch_y: Y coordinate in metres

        Returns:
            True if position is within valid bounds
        """
        margin = self.POSITION_MARGIN

        x_valid = -margin <= pitch_x <= self.config.length + margin
        y_valid = -margin <= pitch_y <= self.config.width + margin

        return x_valid and y_valid

    def get_homography_matrix(self) -> Optional[np.ndarray]:
        """Return the raw 3x3 homography matrix."""
        return self.homography_matrix

    def load_homography(self, matrix: np.ndarray, keypoints_used: Optional[List[str]] = None):
        """
        Load a previously computed homography matrix.

        Args:
            matrix: 3x3 homography matrix
            keypoints_used: Optional list of keypoint names used
        """
        self.homography_matrix = np.array(matrix, dtype=np.float64)
        self.inverse_matrix = np.linalg.inv(self.homography_matrix)
        self.keypoints_used = keypoints_used or []
        self.is_calibrated = True

    def save_calibration(self) -> Dict[str, Any]:
        """
        Save calibration to a JSON-serializable dict.

        Returns:
            Dict with matrix and metadata
        """
        return {
            'matrix': self.homography_matrix.tolist() if self.homography_matrix is not None else None,
            'keypoints_used': self.keypoints_used,
            'reprojection_error': self.reprojection_error,
            'is_calibrated': self.is_calibrated,
            'pitch_config': {
                'length': self.config.length,
                'width': self.config.width
            }
        }

    def load_calibration(self, data: Dict[str, Any]):
        """
        Load calibration from a saved dict.

        Args:
            data: Dict from save_calibration()
        """
        if data.get('matrix') is not None:
            self.load_homography(
                np.array(data['matrix']),
                data.get('keypoints_used', [])
            )
            self.reprojection_error = data.get('reprojection_error', 0.0)

    def _calculate_reprojection_error(
        self,
        pixel_points: np.ndarray,
        pitch_points: np.ndarray,
        H: np.ndarray
    ) -> float:
        """Calculate mean reprojection error in metres."""
        # Transform pixel points to pitch coordinates
        pixel_reshaped = pixel_points.reshape(-1, 1, 2)
        projected = cv2.perspectiveTransform(pixel_reshaped, H)
        projected = projected.reshape(-1, 2)

        # Calculate Euclidean distance errors
        errors = np.sqrt(np.sum((projected - pitch_points) ** 2, axis=1))

        return float(np.mean(errors))


def calibrate_from_frame(
    frame: np.ndarray,
    point_mappings: List[Tuple[float, float, float, float]],
    keypoint_names: Optional[List[str]] = None
) -> PitchCalibrator:
    """
    Helper function to create a calibrated PitchCalibrator from manual point selection.

    Args:
        frame: The video frame image (for reference, not directly used)
        point_mappings: List of (pixel_x, pixel_y, pitch_x, pitch_y) tuples
        keypoint_names: Optional names of keypoints

    Returns:
        Calibrated PitchCalibrator instance

    Example:
        # Points clicked by coach on the frame
        point_mappings = [
            (320, 240, 52.5, 34.0),   # Centre spot
            (100, 50, 0.0, 68.0),      # Top-left corner
            (540, 50, 105.0, 68.0),    # Top-right corner
            (100, 430, 0.0, 0.0),      # Bottom-left corner
        ]

        calibrator = calibrate_from_frame(frame, point_mappings)
        pitch_pos = calibrator.transform_point(player_pixel_x, player_pixel_y)
    """
    calibrator = PitchCalibrator()
    result = calibrator.calibrate_from_points(point_mappings, keypoint_names)

    if not result.success:
        print(f"Calibration failed: {result.error_message}")

    return calibrator


def get_player_foot_position(bbox: Tuple[float, float, float, float]) -> Tuple[float, float]:
    """
    Get the foot position (bottom-centre) of a player bounding box.

    This is the anchor point used for pitch position calculation.

    Args:
        bbox: Bounding box as (x1, y1, x2, y2)

    Returns:
        Tuple of (x, y) pixel coordinates at bottom-centre of box
    """
    x1, y1, x2, y2 = bbox
    foot_x = (x1 + x2) / 2  # Centre x
    foot_y = y2  # Bottom y (feet are at bottom of box)
    return (foot_x, foot_y)


def transform_player_positions(
    calibrator: PitchCalibrator,
    detections: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Transform all player detections to include pitch coordinates.

    This is the integration function for video_processor.py.

    Args:
        calibrator: Calibrated PitchCalibrator
        detections: List of detection dicts with 'bbox' key

    Returns:
        Same detections with added 'pitch_x', 'pitch_y' keys

    Example:
        # In video_processor.py after tracking:
        from scripts.pitch_calibrator import PitchCalibrator, transform_player_positions

        calibrator = PitchCalibrator()
        calibrator.load_calibration(saved_calibration)

        for frame_data in all_detections:
            frame_data['detections'] = transform_player_positions(
                calibrator,
                frame_data['detections']
            )
    """
    if not calibrator.is_calibrated:
        return detections

    transformed = []
    for det in detections:
        det_copy = det.copy()

        if 'bbox' in det:
            foot_x, foot_y = get_player_foot_position(det['bbox'])
            pitch_pos = calibrator.transform_point(foot_x, foot_y)

            if pitch_pos is not None:
                det_copy['pitch_x'] = pitch_pos[0]
                det_copy['pitch_y'] = pitch_pos[1]
                det_copy['is_valid_position'] = calibrator.is_valid_position(*pitch_pos)

        transformed.append(det_copy)

    return transformed


# =============================================================================
# TESTING
# =============================================================================

def test_pitch_calibrator():
    """Test the pitch calibrator with synthetic data."""
    print("="*60)
    print("TESTING PITCH CALIBRATOR")
    print("="*60)

    # Create calibrator
    calibrator = PitchCalibrator()
    config = calibrator.config

    # Print available keypoints
    print(f"\nPitch dimensions: {config.length}m x {config.width}m")
    print(f"\nAvailable keypoints ({len(config.keypoints)}):")
    for name, pos in list(config.keypoints.items())[:10]:
        print(f"  {name}: ({pos[0]:.1f}, {pos[1]:.1f})")
    print("  ...")

    # Simulate a simple homography
    # Assume frame is 1280x720, pitch fills most of the frame
    # Create synthetic point pairs
    point_pairs = [
        # (pixel_x, pixel_y, pitch_x, pitch_y)
        (100, 650, 0.0, 0.0),         # Bottom-left corner
        (1180, 650, 105.0, 0.0),      # Bottom-right corner
        (200, 100, 0.0, 68.0),        # Top-left corner
        (1080, 100, 105.0, 68.0),     # Top-right corner
        (640, 360, 52.5, 34.0),       # Centre spot
        (640, 650, 52.5, 0.0),        # Halfway line at bottom
    ]

    keypoint_names = [
        'corner_bottom_left',
        'corner_bottom_right',
        'corner_top_left',
        'corner_top_right',
        'centre_spot',
        'halfway_bottom'
    ]

    # Calibrate
    print("\nCalibrating with 6 points...")
    result = calibrator.calibrate_from_points(point_pairs, keypoint_names)

    print(f"Success: {result.success}")
    print(f"Inliers: {result.num_inliers}")
    print(f"Reprojection error: {result.reprojection_error:.3f}m")

    if not result.success:
        print(f"Error: {result.error_message}")
        return

    # Test transformations
    print("\nTesting point transformations:")
    test_pixels = [
        (640, 360),   # Should be centre
        (100, 650),   # Should be bottom-left
        (370, 360),   # Should be left penalty spot area
    ]

    for px, py in test_pixels:
        pitch_pos = calibrator.transform_point(px, py)
        if pitch_pos:
            valid = calibrator.is_valid_position(*pitch_pos)
            print(f"  Pixel ({px}, {py}) -> Pitch ({pitch_pos[0]:.1f}m, {pitch_pos[1]:.1f}m) valid={valid}")

    # Test batch transformation
    print("\nTesting batch transformation:")
    pixel_coords = np.array([[640, 360], [100, 650], [1180, 100]], dtype=np.float32)
    pitch_coords = calibrator.transform_points(pixel_coords)

    if pitch_coords is not None:
        for i in range(len(pixel_coords)):
            print(f"  ({pixel_coords[i, 0]:.0f}, {pixel_coords[i, 1]:.0f}) -> "
                  f"({pitch_coords[i, 0]:.1f}m, {pitch_coords[i, 1]:.1f}m)")

    # Test save/load
    print("\nTesting save/load:")
    saved = calibrator.save_calibration()
    print(f"  Saved calibration with {len(saved['keypoints_used'])} keypoints")

    new_calibrator = PitchCalibrator()
    new_calibrator.load_calibration(saved)
    print(f"  Loaded calibration: is_calibrated={new_calibrator.is_calibrated}")

    # Verify loaded calibrator works
    pitch_pos = new_calibrator.transform_point(640, 360)
    print(f"  Centre point test: ({pitch_pos[0]:.1f}m, {pitch_pos[1]:.1f}m)")

    # Test inverse transform
    print("\nTesting inverse transformation:")
    inverse_pixel = calibrator.inverse_transform_point(52.5, 34.0)
    if inverse_pixel:
        print(f"  Centre (52.5m, 34.0m) -> Pixel ({inverse_pixel[0]:.0f}, {inverse_pixel[1]:.0f})")

    print("\nTest complete!")


if __name__ == "__main__":
    test_pitch_calibrator()
