"""Team, Player, and Match models."""
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date,
    ForeignKey, Text, Enum, JSON
)
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class PlayerPosition(str, enum.Enum):
    """Player positions."""
    GOALKEEPER = "goalkeeper"
    DEFENDER = "defender"
    MIDFIELDER = "midfielder"
    FORWARD = "forward"
    UNKNOWN = "unknown"


class Team(Base):
    """Football team."""
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    short_name = Column(String(10), nullable=True)  # e.g., "SCH" for Schladming

    # Team colors for detection
    primary_color = Column(String(7), nullable=True)  # Hex color e.g., "#FF0000"
    secondary_color = Column(String(7), nullable=True)

    # Optional metadata
    logo_url = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    players = relationship("Player", back_populates="team")
    home_matches = relationship("Match", foreign_keys="Match.home_team_id", back_populates="home_team")
    away_matches = relationship("Match", foreign_keys="Match.away_team_id", back_populates="away_team")

    def __repr__(self):
        return f"<Team {self.name}>"


class Player(Base):
    """Player in a team."""
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)

    # Player info
    name = Column(String(255), nullable=False)
    jersey_number = Column(Integer, nullable=True)
    position = Column(Enum(PlayerPosition), default=PlayerPosition.UNKNOWN, nullable=False)

    # Physical attributes (optional, for future use)
    height_cm = Column(Integer, nullable=True)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    team = relationship("Team", back_populates="players")
    match_appearances = relationship("MatchPlayer", back_populates="player")

    def __repr__(self):
        return f"<Player {self.name} #{self.jersey_number}>"


class Match(Base):
    """Football match."""
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)

    # Teams
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)

    # Match info
    match_date = Column(Date, nullable=False, index=True)
    competition = Column(String(255), nullable=True)
    venue = Column(String(255), nullable=True)

    # Score
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)

    # Video info
    video_filename = Column(String(500), nullable=True)
    fps = Column(Float, default=30.0, nullable=False)
    total_frames = Column(Integer, nullable=True)
    video_width = Column(Integer, nullable=True)
    video_height = Column(Integer, nullable=True)

    # Processing status
    is_processed = Column(Boolean, default=False, nullable=False)
    is_calibrated = Column(Boolean, default=False, nullable=False)
    processing_status = Column(String(50), default="pending", nullable=False)  # pending, processing, completed, failed

    # AI accuracy metrics (calculated after corrections)
    ai_accuracy_events = Column(Float, nullable=True)  # 0-100%
    ai_accuracy_tracking = Column(Float, nullable=True)
    ai_accuracy_overall = Column(Float, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)

    # Relationships
    home_team = relationship("Team", foreign_keys=[home_team_id], back_populates="home_matches")
    away_team = relationship("Team", foreign_keys=[away_team_id], back_populates="away_matches")
    match_players = relationship("MatchPlayer", back_populates="match", cascade="all, delete-orphan")
    frames = relationship("Frame", back_populates="match", cascade="all, delete-orphan")
    tracks = relationship("Track", back_populates="match", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="match", cascade="all, delete-orphan")
    calibration = relationship("PitchCalibration", back_populates="match", uselist=False, cascade="all, delete-orphan")
    corrections = relationship("Correction", back_populates="match", cascade="all, delete-orphan")
    accuracy_metrics = relationship("AccuracyMetric", back_populates="match", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Match {self.home_team_id} vs {self.away_team_id} on {self.match_date}>"


class MatchPlayer(Base):
    """Player participation in a specific match (lineup)."""
    __tablename__ = "match_players"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False, index=True)

    # Match-specific info
    is_home_team = Column(Boolean, nullable=False)
    jersey_number = Column(Integer, nullable=True)  # Can differ from default
    position = Column(Enum(PlayerPosition), nullable=True)  # Position in this match
    is_starter = Column(Boolean, default=True, nullable=False)

    # Substitution info
    subbed_in_minute = Column(Integer, nullable=True)
    subbed_out_minute = Column(Integer, nullable=True)

    # Track assignment (links to tracking data)
    primary_track_id = Column(Integer, nullable=True)  # Main track ID assigned to this player

    # Physical stats from this match (calculated from tracking data)
    total_distance_m = Column(Float, nullable=True)
    max_speed_kmh = Column(Float, nullable=True)
    sprint_count = Column(Integer, nullable=True)
    high_intensity_runs = Column(Integer, nullable=True)

    # Relationships
    match = relationship("Match", back_populates="match_players")
    player = relationship("Player", back_populates="match_appearances")

    def __repr__(self):
        return f"<MatchPlayer {self.player_id} in match {self.match_id}>"
