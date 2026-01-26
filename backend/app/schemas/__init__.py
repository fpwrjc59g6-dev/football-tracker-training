"""Pydantic schemas for API request/response validation."""
from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse, UserLogin, Token, TokenData
)
from app.schemas.team import (
    TeamCreate, TeamUpdate, TeamResponse,
    PlayerCreate, PlayerUpdate, PlayerResponse,
    MatchCreate, MatchUpdate, MatchResponse, MatchListResponse,
    MatchPlayerCreate, MatchPlayerUpdate, MatchPlayerResponse
)
from app.schemas.tracking import (
    FrameResponse, DetectionResponse, TrackResponse, TrackUpdate,
    BallPositionResponse, BallPositionUpdate
)
from app.schemas.events import (
    EventCreate, EventUpdate, EventResponse, EventListResponse
)
from app.schemas.calibration import (
    CalibrationPointCreate, CalibrationResponse, CalibrationCreate
)
from app.schemas.corrections import (
    CorrectionCreate, CorrectionResponse
)
from app.schemas.training import (
    TrainingExportCreate, TrainingExportResponse,
    AccuracyMetricResponse, AccuracyDashboard
)

__all__ = [
    # User
    "UserCreate", "UserUpdate", "UserResponse", "UserLogin", "Token", "TokenData",
    # Team
    "TeamCreate", "TeamUpdate", "TeamResponse",
    "PlayerCreate", "PlayerUpdate", "PlayerResponse",
    "MatchCreate", "MatchUpdate", "MatchResponse", "MatchListResponse",
    "MatchPlayerCreate", "MatchPlayerUpdate", "MatchPlayerResponse",
    # Tracking
    "FrameResponse", "DetectionResponse", "TrackResponse", "TrackUpdate",
    "BallPositionResponse", "BallPositionUpdate",
    # Events
    "EventCreate", "EventUpdate", "EventResponse", "EventListResponse",
    # Calibration
    "CalibrationPointCreate", "CalibrationResponse", "CalibrationCreate",
    # Corrections
    "CorrectionCreate", "CorrectionResponse",
    # Training
    "TrainingExportCreate", "TrainingExportResponse",
    "AccuracyMetricResponse", "AccuracyDashboard",
]
