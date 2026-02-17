"""
Football Tracker - Ball Tracking with Kalman Filter
Smooths ball trajectory and fills detection gaps using Kalman filtering.
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Tuple
from filterpy.kalman import KalmanFilter


@dataclass
class BallPosition:
    """Ball position for a single frame."""
    x: float
    y: float
    confidence: float
    is_predicted: bool  # True if position came from Kalman prediction (no detection)
    is_lost: bool  # True if ball tracking has been lost (too many missed frames)
    frame_number: int
    timestamp_ms: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            'x': self.x,
            'y': self.y,
            'confidence': self.confidence,
            'is_predicted': self.is_predicted,
            'is_lost': self.is_lost,
            'frame_number': self.frame_number,
            'timestamp_ms': self.timestamp_ms
        }


@dataclass
class BallDetection:
    """Raw ball detection from RF-DETR for a single frame."""
    frame_number: int
    x: Optional[float]  # None if ball not detected
    y: Optional[float]  # None if ball not detected
    confidence: float  # 0 if not detected
    bbox: Optional[Tuple[int, int, int, int]] = None  # x1, y1, x2, y2
    timestamp_ms: Optional[int] = None

    @property
    def detected(self) -> bool:
        return self.x is not None and self.y is not None


class BallTracker:
    """
    Kalman filter-based ball tracker for football video.

    Smooths ball trajectory and fills detection gaps by predicting
    ball position when RF-DETR fails to detect it.

    State vector: [x, y, vx, vy] — position and velocity in pixel space
    Measurement: [x, y] from detector

    After MAX_MISSED_FRAMES consecutive misses, ball is marked as LOST.
    When re-detected, filter is reinitialised at new position.
    """

    MAX_MISSED_FRAMES = 15  # After this many misses, mark ball as lost
    CONFIDENCE_DECAY = 0.85  # Multiply confidence by this each predicted frame
    MIN_CONFIDENCE = 0.1  # Minimum confidence for predicted positions

    def __init__(
        self,
        process_noise: float = 100.0,
        measurement_noise: float = 10.0,
        dt: float = 0.2  # Time between frames (5 FPS = 0.2 sec)
    ):
        """
        Initialize the ball tracker.

        Args:
            process_noise: Process noise covariance (higher = more trust in measurements)
            measurement_noise: Measurement noise covariance (higher = more trust in predictions)
            dt: Time step between frames in seconds
        """
        self.process_noise = process_noise
        self.measurement_noise = measurement_noise
        self.dt = dt

        self.kf: Optional[KalmanFilter] = None
        self.consecutive_misses = 0
        self.last_confidence = 0.0
        self.is_initialised = False

    def _create_filter(self, x: float, y: float) -> KalmanFilter:
        """
        Create and initialise a new Kalman filter at the given position.

        State: [x, y, vx, vy]
        Measurement: [x, y]
        """
        kf = KalmanFilter(dim_x=4, dim_z=2)

        # State transition matrix (constant velocity model)
        # x_new = x + vx*dt
        # y_new = y + vy*dt
        # vx_new = vx
        # vy_new = vy
        kf.F = np.array([
            [1, 0, self.dt, 0],
            [0, 1, 0, self.dt],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ])

        # Measurement matrix (we only observe position, not velocity)
        kf.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ])

        # Measurement noise covariance
        kf.R = np.array([
            [self.measurement_noise, 0],
            [0, self.measurement_noise]
        ])

        # Process noise covariance
        # Using discrete white noise model for constant velocity
        q = self.process_noise
        kf.Q = np.array([
            [q * self.dt**4 / 4, 0, q * self.dt**3 / 2, 0],
            [0, q * self.dt**4 / 4, 0, q * self.dt**3 / 2],
            [q * self.dt**3 / 2, 0, q * self.dt**2, 0],
            [0, q * self.dt**3 / 2, 0, q * self.dt**2]
        ])

        # Initial state covariance (high uncertainty in velocity)
        kf.P = np.array([
            [10, 0, 0, 0],
            [0, 10, 0, 0],
            [0, 0, 1000, 0],
            [0, 0, 0, 1000]
        ])

        # Initial state (position known, velocity unknown)
        kf.x = np.array([x, y, 0, 0])

        return kf

    def reset(self):
        """Reset the tracker state."""
        self.kf = None
        self.consecutive_misses = 0
        self.last_confidence = 0.0
        self.is_initialised = False

    def update_frame(self, detection: BallDetection) -> BallPosition:
        """
        Process a single frame's ball detection.

        Args:
            detection: Ball detection for this frame (may have x=None if not detected)

        Returns:
            BallPosition with smoothed/predicted position
        """
        # Case 1: Ball detected
        if detection.detected:
            if not self.is_initialised:
                # First detection - initialise filter
                self.kf = self._create_filter(detection.x, detection.y)
                self.is_initialised = True
                self.consecutive_misses = 0
                self.last_confidence = detection.confidence

                return BallPosition(
                    x=detection.x,
                    y=detection.y,
                    confidence=detection.confidence,
                    is_predicted=False,
                    is_lost=False,
                    frame_number=detection.frame_number,
                    timestamp_ms=detection.timestamp_ms
                )
            else:
                # Update existing filter with measurement
                self.kf.predict()
                self.kf.update(np.array([detection.x, detection.y]))
                self.consecutive_misses = 0
                self.last_confidence = detection.confidence

                # Use filtered position (smoothed)
                x, y = self.kf.x[0], self.kf.x[1]

                return BallPosition(
                    x=float(x),
                    y=float(y),
                    confidence=detection.confidence,
                    is_predicted=False,
                    is_lost=False,
                    frame_number=detection.frame_number,
                    timestamp_ms=detection.timestamp_ms
                )

        # Case 2: Ball NOT detected
        else:
            if not self.is_initialised:
                # Never seen the ball - return lost position
                return BallPosition(
                    x=0.0,
                    y=0.0,
                    confidence=0.0,
                    is_predicted=True,
                    is_lost=True,
                    frame_number=detection.frame_number,
                    timestamp_ms=detection.timestamp_ms
                )

            self.consecutive_misses += 1

            # Check if we've lost the ball
            if self.consecutive_misses > self.MAX_MISSED_FRAMES:
                # Ball is lost - reset tracker
                self.reset()

                return BallPosition(
                    x=0.0,
                    y=0.0,
                    confidence=0.0,
                    is_predicted=True,
                    is_lost=True,
                    frame_number=detection.frame_number,
                    timestamp_ms=detection.timestamp_ms
                )

            # Predict position without measurement update
            self.kf.predict()
            x, y = self.kf.x[0], self.kf.x[1]

            # Decay confidence
            self.last_confidence *= self.CONFIDENCE_DECAY
            confidence = max(self.MIN_CONFIDENCE, self.last_confidence)

            return BallPosition(
                x=float(x),
                y=float(y),
                confidence=confidence,
                is_predicted=True,
                is_lost=False,
                frame_number=detection.frame_number,
                timestamp_ms=detection.timestamp_ms
            )

    def process(self, detections: List[BallDetection]) -> List[BallPosition]:
        """
        Process a complete list of ball detections and return smoothed trajectory.

        This is the main entry point for batch processing.

        Args:
            detections: List of BallDetection objects, one per frame, in frame order

        Returns:
            List of BallPosition objects with smoothed/predicted positions
        """
        self.reset()

        positions = []
        for detection in detections:
            position = self.update_frame(detection)
            positions.append(position)

        return positions

    def get_velocity(self) -> Optional[Tuple[float, float]]:
        """
        Get current estimated ball velocity in pixels per frame.

        Returns:
            Tuple of (vx, vy) or None if not initialised
        """
        if not self.is_initialised or self.kf is None:
            return None

        return (float(self.kf.x[2]), float(self.kf.x[3]))

    def get_speed(self) -> Optional[float]:
        """
        Get current estimated ball speed in pixels per frame.

        Returns:
            Speed magnitude or None if not initialised
        """
        velocity = self.get_velocity()
        if velocity is None:
            return None

        return np.sqrt(velocity[0]**2 + velocity[1]**2)


def extract_ball_detections(
    frame_detections: List[dict],
    ball_class_name: str = 'ball'
) -> List[BallDetection]:
    """
    Extract ball detections from RF-DETR output.

    Args:
        frame_detections: List of dicts with 'frame', 'timestamp_ms', 'detections' keys
                         Each detection has 'class_name', 'x', 'y', 'confidence', 'bbox'
        ball_class_name: Class name for ball in the detection output

    Returns:
        List of BallDetection objects, one per frame
    """
    ball_detections = []

    for frame_data in frame_detections:
        frame_number = frame_data.get('frame', 0)
        timestamp_ms = frame_data.get('timestamp_ms')
        detections = frame_data.get('detections', [])

        # Find ball detection (highest confidence if multiple)
        ball_det = None
        for det in detections:
            if det.get('class_name') == ball_class_name:
                if ball_det is None or det.get('confidence', 0) > ball_det.get('confidence', 0):
                    ball_det = det

        if ball_det:
            ball_detections.append(BallDetection(
                frame_number=frame_number,
                x=ball_det.get('x'),
                y=ball_det.get('y'),
                confidence=ball_det.get('confidence', 0),
                bbox=tuple(ball_det['bbox']) if 'bbox' in ball_det else None,
                timestamp_ms=timestamp_ms
            ))
        else:
            # No ball detected in this frame
            ball_detections.append(BallDetection(
                frame_number=frame_number,
                x=None,
                y=None,
                confidence=0.0,
                bbox=None,
                timestamp_ms=timestamp_ms
            ))

    return ball_detections


def smooth_ball_trajectory(
    frame_detections: List[dict],
    process_noise: float = 100.0,
    measurement_noise: float = 10.0,
    fps: float = 5.0,
    ball_class_name: str = 'ball'
) -> List[BallPosition]:
    """
    High-level function to smooth ball trajectory from RF-DETR output.

    This is the main integration point for video_processor.py.

    Args:
        frame_detections: Output from RF-DETR processing (list of frame dicts)
        process_noise: Kalman filter process noise
        measurement_noise: Kalman filter measurement noise
        fps: Processing frame rate
        ball_class_name: Class name for ball detections

    Returns:
        List of BallPosition objects with smoothed trajectory

    Example:
        # In video_processor.py after RF-DETR detection:
        from scripts.ball_tracker import smooth_ball_trajectory

        ball_trajectory = smooth_ball_trajectory(
            frame_detections=all_detections,  # Output from RF-DETR
            fps=5.0
        )

        # Now use ball_trajectory for event classification
    """
    # Extract ball detections from full detection output
    ball_detections = extract_ball_detections(frame_detections, ball_class_name)

    # Create tracker and process
    tracker = BallTracker(
        process_noise=process_noise,
        measurement_noise=measurement_noise,
        dt=1.0 / fps
    )

    return tracker.process(ball_detections)


def compute_ball_statistics(positions: List[BallPosition]) -> dict:
    """
    Compute statistics about ball tracking quality.

    Args:
        positions: List of BallPosition objects from tracker

    Returns:
        Dictionary with tracking statistics
    """
    total_frames = len(positions)
    if total_frames == 0:
        return {
            'total_frames': 0,
            'detected_frames': 0,
            'predicted_frames': 0,
            'lost_frames': 0,
            'detection_rate': 0.0,
            'effective_tracking_rate': 0.0,
            'average_confidence': 0.0
        }

    detected = sum(1 for p in positions if not p.is_predicted and not p.is_lost)
    predicted = sum(1 for p in positions if p.is_predicted and not p.is_lost)
    lost = sum(1 for p in positions if p.is_lost)

    confidences = [p.confidence for p in positions if not p.is_lost]
    avg_confidence = np.mean(confidences) if confidences else 0.0

    return {
        'total_frames': total_frames,
        'detected_frames': detected,
        'predicted_frames': predicted,
        'lost_frames': lost,
        'detection_rate': detected / total_frames * 100,
        'effective_tracking_rate': (detected + predicted) / total_frames * 100,
        'average_confidence': float(avg_confidence)
    }


# =============================================================================
# TESTING
# =============================================================================

def test_ball_tracker():
    """Test the ball tracker with synthetic data."""
    print("="*60)
    print("TESTING BALL TRACKER")
    print("="*60)

    # Create synthetic ball detections
    # Ball moves from (100, 100) to (500, 300) with some gaps
    detections = []

    for i in range(50):
        frame = i * 5  # Frame numbers: 0, 5, 10, ...

        # Simulate detection gaps
        if i in [10, 11, 12, 25, 26, 27, 28, 29]:
            # Ball not detected
            detections.append(BallDetection(
                frame_number=frame,
                x=None,
                y=None,
                confidence=0.0,
                timestamp_ms=frame * 40  # 5 FPS = 200ms per processed frame
            ))
        else:
            # Ball detected with some noise
            true_x = 100 + i * 8  # Moving right
            true_y = 100 + i * 4  # Moving down
            noise_x = np.random.normal(0, 3)
            noise_y = np.random.normal(0, 3)

            detections.append(BallDetection(
                frame_number=frame,
                x=true_x + noise_x,
                y=true_y + noise_y,
                confidence=0.8 + np.random.uniform(-0.1, 0.1),
                timestamp_ms=frame * 40
            ))

    # Process through tracker
    tracker = BallTracker(dt=0.2)  # 5 FPS
    positions = tracker.process(detections)

    # Print results
    print(f"\nProcessed {len(detections)} frames")

    stats = compute_ball_statistics(positions)
    print(f"\nStatistics:")
    print(f"  Detection rate: {stats['detection_rate']:.1f}%")
    print(f"  Effective tracking rate: {stats['effective_tracking_rate']:.1f}%")
    print(f"  Average confidence: {stats['average_confidence']:.2f}")
    print(f"  Detected frames: {stats['detected_frames']}")
    print(f"  Predicted frames: {stats['predicted_frames']}")
    print(f"  Lost frames: {stats['lost_frames']}")

    # Show a few examples
    print(f"\nSample positions:")
    for i in [0, 5, 10, 11, 12, 13, 25, 30, 49]:
        if i < len(positions):
            p = positions[i]
            status = "LOST" if p.is_lost else ("PRED" if p.is_predicted else "DET")
            print(f"  Frame {p.frame_number:3d}: ({p.x:6.1f}, {p.y:6.1f}) conf={p.confidence:.2f} [{status}]")

    print("\nTest complete!")
    return positions


if __name__ == "__main__":
    test_ball_tracker()
