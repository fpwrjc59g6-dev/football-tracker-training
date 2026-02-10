"""Event models - full event schema with 40+ event types like BePro/Spiideo."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Enum, Text, JSON, Index
)
from sqlalchemy.orm import relationship
import enum
from app.database import Base


# ============================================================================
# EVENT TYPE DEFINITIONS - Comprehensive like BePro/Spiideo
# ============================================================================

class EventCategory(str, enum.Enum):
    """High-level event categories."""
    POSSESSION = "possession"
    PASSING = "passing"
    SHOOTING = "shooting"
    DEFENDING = "defending"
    DUEL = "duel"
    SET_PIECE = "set_piece"
    GOALKEEPER = "goalkeeper"
    FOUL = "foul"
    GAME_STATE = "game_state"


class EventType(str, enum.Enum):
    """All event types - comprehensive coverage."""

    # === POSSESSION EVENTS ===
    BALL_RECEIPT = "ball_receipt"  # Player receives the ball
    BALL_RECOVERY = "ball_recovery"  # Winning loose ball
    CARRY = "carry"  # Carrying ball (dribble without opponent)
    DRIBBLE = "dribble"  # Taking on opponent
    DISPOSSESSED = "dispossessed"  # Lost ball to opponent
    MISCONTROL = "miscontrol"  # Failed to control ball

    # === PASSING EVENTS ===
    PASS = "pass"  # Standard pass
    CROSS = "cross"  # Cross into box
    LONG_BALL = "long_ball"  # Long pass
    THROUGH_BALL = "through_ball"  # Pass behind defense
    SWITCH = "switch"  # Switch of play
    PASS_INTO_BOX = "pass_into_box"  # Pass into penalty area
    CUTBACK = "cutback"  # Pass back from byline
    ASSIST = "assist"  # Pass leading to shot
    KEY_PASS = "key_pass"  # Pass creating clear chance
    PROGRESSIVE_PASS = "progressive_pass"  # Pass advancing significantly

    # === SHOOTING EVENTS ===
    SHOT = "shot"  # Shot at goal
    SHOT_ON_TARGET = "shot_on_target"
    SHOT_OFF_TARGET = "shot_off_target"
    SHOT_BLOCKED = "shot_blocked"
    GOAL = "goal"
    OWN_GOAL = "own_goal"
    PENALTY = "penalty"
    FREE_KICK_SHOT = "free_kick_shot"
    HEADER = "header"  # Headed shot

    # === DEFENDING EVENTS ===
    TACKLE = "tackle"  # Attempting to win ball
    INTERCEPTION = "interception"  # Cutting out pass
    CLEARANCE = "clearance"  # Clearing ball from danger
    BLOCK = "block"  # Blocking shot/pass
    PRESSURE = "pressure"  # Pressing opponent
    RECOVERY_RUN = "recovery_run"  # Tracking back

    # === DUEL EVENTS ===
    AERIAL_DUEL = "aerial_duel"  # Contesting header
    GROUND_DUEL = "ground_duel"  # 50/50 challenge
    LOOSE_BALL_DUEL = "loose_ball_duel"

    # === SET PIECE EVENTS ===
    CORNER = "corner"
    FREE_KICK = "free_kick"
    THROW_IN = "throw_in"
    GOAL_KICK = "goal_kick"
    KICK_OFF = "kick_off"
    PENALTY_KICK = "penalty_kick"

    # === GOALKEEPER EVENTS ===
    SAVE = "save"
    PUNCH = "punch"
    CATCH = "catch"
    SMOTHER = "smother"
    GOAL_KICK_GK = "goal_kick_gk"
    DROP_KICK = "drop_kick"
    THROW_GK = "throw_gk"

    # === FOUL EVENTS ===
    FOUL_COMMITTED = "foul_committed"
    FOUL_WON = "foul_won"
    YELLOW_CARD = "yellow_card"
    RED_CARD = "red_card"
    SECOND_YELLOW = "second_yellow"
    HANDBALL = "handball"
    OFFSIDE = "offside"

    # === GAME STATE EVENTS ===
    HALF_START = "half_start"
    HALF_END = "half_end"
    SUBSTITUTION = "substitution"
    INJURY = "injury"
    BALL_OUT = "ball_out"
    REFEREE_STOP = "referee_stop"


# Event type metadata
EVENT_TYPES = {
    # Possession
    EventType.BALL_RECEIPT: {"category": EventCategory.POSSESSION, "requires_player": True, "requires_outcome": True},
    EventType.BALL_RECOVERY: {"category": EventCategory.POSSESSION, "requires_player": True, "requires_outcome": False},
    EventType.CARRY: {"category": EventCategory.POSSESSION, "requires_player": True, "requires_end_location": True},
    EventType.DRIBBLE: {"category": EventCategory.POSSESSION, "requires_player": True, "requires_outcome": True},
    EventType.DISPOSSESSED: {"category": EventCategory.POSSESSION, "requires_player": True, "requires_opponent": True},
    EventType.MISCONTROL: {"category": EventCategory.POSSESSION, "requires_player": True, "requires_outcome": False},

    # Passing
    EventType.PASS: {"category": EventCategory.PASSING, "requires_player": True, "requires_target": True, "requires_outcome": True},
    EventType.CROSS: {"category": EventCategory.PASSING, "requires_player": True, "requires_target": True, "requires_outcome": True},
    EventType.LONG_BALL: {"category": EventCategory.PASSING, "requires_player": True, "requires_target": True, "requires_outcome": True},
    EventType.THROUGH_BALL: {"category": EventCategory.PASSING, "requires_player": True, "requires_target": True, "requires_outcome": True},
    EventType.SWITCH: {"category": EventCategory.PASSING, "requires_player": True, "requires_target": True, "requires_outcome": True},
    EventType.PASS_INTO_BOX: {"category": EventCategory.PASSING, "requires_player": True, "requires_target": True, "requires_outcome": True},
    EventType.CUTBACK: {"category": EventCategory.PASSING, "requires_player": True, "requires_target": True, "requires_outcome": True},
    EventType.ASSIST: {"category": EventCategory.PASSING, "requires_player": True, "requires_target": True, "linked_event": True},
    EventType.KEY_PASS: {"category": EventCategory.PASSING, "requires_player": True, "requires_target": True, "requires_outcome": True},
    EventType.PROGRESSIVE_PASS: {"category": EventCategory.PASSING, "requires_player": True, "requires_target": True, "requires_outcome": True},

    # Shooting
    EventType.SHOT: {"category": EventCategory.SHOOTING, "requires_player": True, "requires_outcome": True, "requires_body_part": True},
    EventType.SHOT_ON_TARGET: {"category": EventCategory.SHOOTING, "requires_player": True, "requires_body_part": True},
    EventType.SHOT_OFF_TARGET: {"category": EventCategory.SHOOTING, "requires_player": True, "requires_body_part": True},
    EventType.SHOT_BLOCKED: {"category": EventCategory.SHOOTING, "requires_player": True, "requires_opponent": True},
    EventType.GOAL: {"category": EventCategory.SHOOTING, "requires_player": True, "requires_body_part": True},
    EventType.OWN_GOAL: {"category": EventCategory.SHOOTING, "requires_player": True},
    EventType.PENALTY: {"category": EventCategory.SHOOTING, "requires_player": True, "requires_outcome": True},
    EventType.FREE_KICK_SHOT: {"category": EventCategory.SHOOTING, "requires_player": True, "requires_outcome": True},
    EventType.HEADER: {"category": EventCategory.SHOOTING, "requires_player": True, "requires_outcome": True},

    # Defending
    EventType.TACKLE: {"category": EventCategory.DEFENDING, "requires_player": True, "requires_opponent": True, "requires_outcome": True},
    EventType.INTERCEPTION: {"category": EventCategory.DEFENDING, "requires_player": True, "requires_outcome": True},
    EventType.CLEARANCE: {"category": EventCategory.DEFENDING, "requires_player": True, "requires_body_part": True},
    EventType.BLOCK: {"category": EventCategory.DEFENDING, "requires_player": True},
    EventType.PRESSURE: {"category": EventCategory.DEFENDING, "requires_player": True, "requires_opponent": True},
    EventType.RECOVERY_RUN: {"category": EventCategory.DEFENDING, "requires_player": True},

    # Duels
    EventType.AERIAL_DUEL: {"category": EventCategory.DUEL, "requires_player": True, "requires_opponent": True, "requires_outcome": True},
    EventType.GROUND_DUEL: {"category": EventCategory.DUEL, "requires_player": True, "requires_opponent": True, "requires_outcome": True},
    EventType.LOOSE_BALL_DUEL: {"category": EventCategory.DUEL, "requires_player": True, "requires_opponent": True, "requires_outcome": True},

    # Set pieces
    EventType.CORNER: {"category": EventCategory.SET_PIECE, "requires_player": True, "requires_outcome": True},
    EventType.FREE_KICK: {"category": EventCategory.SET_PIECE, "requires_player": True, "requires_outcome": True},
    EventType.THROW_IN: {"category": EventCategory.SET_PIECE, "requires_player": True, "requires_target": True, "requires_outcome": True},
    EventType.GOAL_KICK: {"category": EventCategory.SET_PIECE, "requires_player": True, "requires_outcome": True},
    EventType.KICK_OFF: {"category": EventCategory.SET_PIECE, "requires_player": True},
    EventType.PENALTY_KICK: {"category": EventCategory.SET_PIECE, "requires_player": True, "requires_outcome": True},

    # Goalkeeper
    EventType.SAVE: {"category": EventCategory.GOALKEEPER, "requires_player": True, "requires_body_part": True},
    EventType.PUNCH: {"category": EventCategory.GOALKEEPER, "requires_player": True},
    EventType.CATCH: {"category": EventCategory.GOALKEEPER, "requires_player": True},
    EventType.SMOTHER: {"category": EventCategory.GOALKEEPER, "requires_player": True},
    EventType.GOAL_KICK_GK: {"category": EventCategory.GOALKEEPER, "requires_player": True, "requires_outcome": True},
    EventType.DROP_KICK: {"category": EventCategory.GOALKEEPER, "requires_player": True, "requires_outcome": True},
    EventType.THROW_GK: {"category": EventCategory.GOALKEEPER, "requires_player": True, "requires_target": True, "requires_outcome": True},

    # Fouls
    EventType.FOUL_COMMITTED: {"category": EventCategory.FOUL, "requires_player": True, "requires_opponent": True},
    EventType.FOUL_WON: {"category": EventCategory.FOUL, "requires_player": True, "requires_opponent": True},
    EventType.YELLOW_CARD: {"category": EventCategory.FOUL, "requires_player": True},
    EventType.RED_CARD: {"category": EventCategory.FOUL, "requires_player": True},
    EventType.SECOND_YELLOW: {"category": EventCategory.FOUL, "requires_player": True},
    EventType.HANDBALL: {"category": EventCategory.FOUL, "requires_player": True},
    EventType.OFFSIDE: {"category": EventCategory.FOUL, "requires_player": True},

    # Game state
    EventType.HALF_START: {"category": EventCategory.GAME_STATE, "requires_player": False},
    EventType.HALF_END: {"category": EventCategory.GAME_STATE, "requires_player": False},
    EventType.SUBSTITUTION: {"category": EventCategory.GAME_STATE, "requires_player": True, "requires_target": True},
    EventType.INJURY: {"category": EventCategory.GAME_STATE, "requires_player": True},
    EventType.BALL_OUT: {"category": EventCategory.GAME_STATE, "requires_player": False},
    EventType.REFEREE_STOP: {"category": EventCategory.GAME_STATE, "requires_player": False},
}


class BodyPart(str, enum.Enum):
    """Body part used for action."""
    RIGHT_FOOT = "right_foot"
    LEFT_FOOT = "left_foot"
    HEAD = "head"
    CHEST = "chest"
    OTHER = "other"


class PassHeight(str, enum.Enum):
    """Height of pass."""
    GROUND = "ground"
    LOW = "low"
    HIGH = "high"


class PitchZone(str, enum.Enum):
    """Zone of the pitch."""
    DEFENSIVE_THIRD = "defensive_third"
    MIDDLE_THIRD = "middle_third"
    ATTACKING_THIRD = "attacking_third"
    PENALTY_BOX = "penalty_box"
    SIX_YARD_BOX = "six_yard_box"


class Event(Base):
    """Football event with full context."""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)

    # Temporal info
    frame_start = Column(Integer, nullable=False, index=True)
    frame_end = Column(Integer, nullable=True)  # For duration events like carry
    timestamp_ms = Column(Integer, nullable=True)
    match_minute = Column(Integer, nullable=True)
    match_second = Column(Integer, nullable=True)
    half = Column(Integer, default=1, nullable=False)  # 1 or 2

    # Event classification
    event_type = Column(Enum(EventType), nullable=False, index=True)
    event_category = Column(Enum(EventCategory), nullable=False, index=True)

    # Primary player (who performed the action)
    player_track_id = Column(Integer, ForeignKey("tracks.id"), nullable=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=True, index=True)

    # Target player (for passes, assists, etc.)
    target_track_id = Column(Integer, ForeignKey("tracks.id"), nullable=True)
    target_player_id = Column(Integer, ForeignKey("players.id"), nullable=True)

    # Opponent player (for duels, tackles, etc.)
    opponent_track_id = Column(Integer, ForeignKey("tracks.id"), nullable=True)
    opponent_player_id = Column(Integer, ForeignKey("players.id"), nullable=True)

    # Location - pixel coordinates
    start_x = Column(Float, nullable=True)
    start_y = Column(Float, nullable=True)
    end_x = Column(Float, nullable=True)
    end_y = Column(Float, nullable=True)

    # Location - calibrated pitch coordinates (meters)
    start_pitch_x = Column(Float, nullable=True)
    start_pitch_y = Column(Float, nullable=True)
    end_pitch_x = Column(Float, nullable=True)
    end_pitch_y = Column(Float, nullable=True)

    # Calculated metrics
    distance_m = Column(Float, nullable=True)  # Distance covered/passed
    speed_ms = Column(Float, nullable=True)  # Speed at event
    angle_deg = Column(Float, nullable=True)  # Direction angle

    # Event details
    outcome_success = Column(Boolean, nullable=True)  # Did it succeed?
    body_part = Column(Enum(BodyPart), nullable=True)
    pass_height = Column(Enum(PassHeight), nullable=True)

    # Pitch zones
    start_zone = Column(Enum(PitchZone), nullable=True)
    end_zone = Column(Enum(PitchZone), nullable=True)

    # Context flags
    under_pressure = Column(Boolean, default=False, nullable=False)
    is_counter_attack = Column(Boolean, default=False, nullable=False)
    is_set_piece = Column(Boolean, default=False, nullable=False)
    is_first_touch = Column(Boolean, default=False, nullable=False)

    # Linked events (e.g., pass -> receipt, shot -> save)
    related_event_id = Column(Integer, ForeignKey("events.id"), nullable=True)

    # AI vs corrected
    is_ai_generated = Column(Boolean, default=True, nullable=False)
    ai_confidence = Column(Float, nullable=True)
    is_corrected = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)  # Soft delete for wrong AI events
    is_manually_added = Column(Boolean, default=False, nullable=False)  # Staff added this
    is_verified = Column(Boolean, default=False, nullable=False)  # Analyst verified this event
    is_correct = Column(Boolean, nullable=True)  # Was AI prediction correct? (null = not reviewed)

    # Additional data (JSON for flexibility)
    event_metadata = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    match = relationship("Match", back_populates="events")
    player_track = relationship("Track", foreign_keys=[player_track_id])
    player = relationship("Player", foreign_keys=[player_id])
    target_track = relationship("Track", foreign_keys=[target_track_id])
    target_player = relationship("Player", foreign_keys=[target_player_id])
    opponent_track = relationship("Track", foreign_keys=[opponent_track_id])
    opponent_player = relationship("Player", foreign_keys=[opponent_player_id])
    related_event = relationship("Event", remote_side=[id])

    # Composite indexes
    __table_args__ = (
        Index("idx_event_match_frame", "match_id", "frame_start"),
        Index("idx_event_match_type", "match_id", "event_type"),
        Index("idx_event_player", "match_id", "player_track_id"),
    )

    def __repr__(self):
        return f"<Event {self.event_type.value} at frame {self.frame_start}>"
