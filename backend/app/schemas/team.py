"""Team, Player, and Match schemas."""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.team import PlayerPosition


# ============================================================================
# TEAM SCHEMAS
# ============================================================================

class TeamCreate(BaseModel):
    """Schema for creating a team."""
    name: str = Field(..., min_length=1, max_length=255)
    short_name: Optional[str] = Field(None, max_length=10)
    primary_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    secondary_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    logo_url: Optional[str] = None


class TeamUpdate(BaseModel):
    """Schema for updating a team."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    short_name: Optional[str] = Field(None, max_length=10)
    primary_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    secondary_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    logo_url: Optional[str] = None


class TeamResponse(BaseModel):
    """Schema for team response."""
    id: int
    name: str
    short_name: Optional[str]
    primary_color: Optional[str]
    secondary_color: Optional[str]
    logo_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# PLAYER SCHEMAS
# ============================================================================

class PlayerCreate(BaseModel):
    """Schema for creating a player."""
    team_id: int
    name: str = Field(..., min_length=1, max_length=255)
    jersey_number: Optional[int] = Field(None, ge=1, le=99)
    position: PlayerPosition = PlayerPosition.UNKNOWN
    height_cm: Optional[int] = Field(None, ge=100, le=250)


class PlayerUpdate(BaseModel):
    """Schema for updating a player."""
    team_id: Optional[int] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    jersey_number: Optional[int] = Field(None, ge=1, le=99)
    position: Optional[PlayerPosition] = None
    height_cm: Optional[int] = Field(None, ge=100, le=250)
    is_active: Optional[bool] = None


class PlayerResponse(BaseModel):
    """Schema for player response."""
    id: int
    team_id: int
    name: str
    jersey_number: Optional[int]
    position: PlayerPosition
    height_cm: Optional[int]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# MATCH PLAYER SCHEMAS
# ============================================================================

class MatchPlayerCreate(BaseModel):
    """Schema for adding a player to a match."""
    player_id: int
    is_home_team: bool
    jersey_number: Optional[int] = Field(None, ge=1, le=99)
    position: Optional[PlayerPosition] = None
    is_starter: bool = True
    subbed_in_minute: Optional[int] = None
    subbed_out_minute: Optional[int] = None


class MatchPlayerUpdate(BaseModel):
    """Schema for updating a match player."""
    jersey_number: Optional[int] = Field(None, ge=1, le=99)
    position: Optional[PlayerPosition] = None
    is_starter: Optional[bool] = None
    subbed_in_minute: Optional[int] = None
    subbed_out_minute: Optional[int] = None
    primary_track_id: Optional[int] = None
    total_distance_m: Optional[float] = None
    max_speed_kmh: Optional[float] = None
    sprint_count: Optional[int] = None
    high_intensity_runs: Optional[int] = None


class MatchPlayerResponse(BaseModel):
    """Schema for match player response."""
    id: int
    match_id: int
    player_id: int
    player: PlayerResponse
    is_home_team: bool
    jersey_number: Optional[int]
    position: Optional[PlayerPosition]
    is_starter: bool
    subbed_in_minute: Optional[int]
    subbed_out_minute: Optional[int]
    primary_track_id: Optional[int]
    total_distance_m: Optional[float]
    max_speed_kmh: Optional[float]
    sprint_count: Optional[int]
    high_intensity_runs: Optional[int]

    class Config:
        from_attributes = True


# ============================================================================
# MATCH SCHEMAS
# ============================================================================

class MatchCreate(BaseModel):
    """Schema for creating a match."""
    home_team_id: int
    away_team_id: int
    match_date: date
    competition: Optional[str] = Field(None, max_length=255)
    venue: Optional[str] = Field(None, max_length=255)
    home_score: Optional[int] = Field(None, ge=0)
    away_score: Optional[int] = Field(None, ge=0)
    video_filename: Optional[str] = None
    fps: float = 30.0
    total_frames: Optional[int] = None
    video_width: Optional[int] = None
    video_height: Optional[int] = None


class MatchUpdate(BaseModel):
    """Schema for updating a match."""
    home_team_id: Optional[int] = None
    away_team_id: Optional[int] = None
    match_date: Optional[date] = None
    competition: Optional[str] = Field(None, max_length=255)
    venue: Optional[str] = Field(None, max_length=255)
    home_score: Optional[int] = Field(None, ge=0)
    away_score: Optional[int] = Field(None, ge=0)
    video_filename: Optional[str] = None
    fps: Optional[float] = None
    total_frames: Optional[int] = None
    video_width: Optional[int] = None
    video_height: Optional[int] = None
    is_processed: Optional[bool] = None
    is_calibrated: Optional[bool] = None
    processing_status: Optional[str] = None


class MatchResponse(BaseModel):
    """Schema for match response."""
    id: int
    home_team_id: int
    away_team_id: int
    home_team: TeamResponse
    away_team: TeamResponse
    match_date: date
    competition: Optional[str]
    venue: Optional[str]
    home_score: Optional[int]
    away_score: Optional[int]
    video_filename: Optional[str]
    fps: float
    total_frames: Optional[int]
    video_width: Optional[int]
    video_height: Optional[int]
    is_processed: bool
    is_calibrated: bool
    processing_status: str
    ai_accuracy_events: Optional[float]
    ai_accuracy_tracking: Optional[float]
    ai_accuracy_overall: Optional[float]
    created_at: datetime
    processed_at: Optional[datetime]

    class Config:
        from_attributes = True


class MatchListResponse(BaseModel):
    """Schema for listing matches."""
    id: int
    home_team: TeamResponse
    away_team: TeamResponse
    match_date: date
    competition: Optional[str]
    home_score: Optional[int]
    away_score: Optional[int]
    is_processed: bool
    is_calibrated: bool
    processing_status: str
    ai_accuracy_overall: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True
