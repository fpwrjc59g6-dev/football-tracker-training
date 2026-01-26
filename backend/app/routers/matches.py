"""Matches router."""
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.team import Match, Team, MatchPlayer, Player
from app.models.user import User
from app.schemas.team import (
    MatchCreate, MatchUpdate, MatchResponse, MatchListResponse,
    MatchPlayerCreate, MatchPlayerUpdate, MatchPlayerResponse
)
from app.auth import get_current_user, require_analyst

router = APIRouter(prefix="/matches", tags=["Matches"])


@router.get("", response_model=List[MatchListResponse])
async def list_matches(
    team_id: Optional[int] = Query(None, description="Filter by team ID"),
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    is_processed: Optional[bool] = Query(None, description="Filter by processed status"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List matches with filters."""
    query = db.query(Match).options(
        joinedload(Match.home_team),
        joinedload(Match.away_team)
    )

    if team_id:
        query = query.filter(
            (Match.home_team_id == team_id) | (Match.away_team_id == team_id)
        )

    if start_date:
        query = query.filter(Match.match_date >= start_date)

    if end_date:
        query = query.filter(Match.match_date <= end_date)

    if is_processed is not None:
        query = query.filter(Match.is_processed == is_processed)

    matches = query.order_by(Match.match_date.desc()).offset(skip).limit(limit).all()
    return matches


@router.post("", response_model=MatchResponse)
async def create_match(
    match_data: MatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Create a new match."""
    # Verify teams exist
    home_team = db.query(Team).filter(Team.id == match_data.home_team_id).first()
    if not home_team:
        raise HTTPException(status_code=404, detail="Home team not found")

    away_team = db.query(Team).filter(Team.id == match_data.away_team_id).first()
    if not away_team:
        raise HTTPException(status_code=404, detail="Away team not found")

    match = Match(**match_data.model_dump())
    db.add(match)
    db.commit()
    db.refresh(match)

    # Reload with relationships
    match = db.query(Match).options(
        joinedload(Match.home_team),
        joinedload(Match.away_team)
    ).filter(Match.id == match.id).first()

    return match


@router.get("/{match_id}", response_model=MatchResponse)
async def get_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a match by ID."""
    match = db.query(Match).options(
        joinedload(Match.home_team),
        joinedload(Match.away_team)
    ).filter(Match.id == match_id).first()

    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    return match


@router.put("/{match_id}", response_model=MatchResponse)
async def update_match(
    match_id: int,
    match_data: MatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Update a match."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    for key, value in match_data.model_dump(exclude_unset=True).items():
        setattr(match, key, value)

    db.commit()
    db.refresh(match)

    # Reload with relationships
    match = db.query(Match).options(
        joinedload(Match.home_team),
        joinedload(Match.away_team)
    ).filter(Match.id == match.id).first()

    return match


@router.delete("/{match_id}")
async def delete_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Delete a match and all related data."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    db.delete(match)
    db.commit()
    return {"message": "Match deleted"}


# ============================================================================
# MATCH PLAYERS (LINEUP)
# ============================================================================

@router.get("/{match_id}/players", response_model=List[MatchPlayerResponse])
async def list_match_players(
    match_id: int,
    is_home_team: Optional[bool] = Query(None, description="Filter by team side"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List players in a match lineup."""
    query = db.query(MatchPlayer).options(
        joinedload(MatchPlayer.player)
    ).filter(MatchPlayer.match_id == match_id)

    if is_home_team is not None:
        query = query.filter(MatchPlayer.is_home_team == is_home_team)

    match_players = query.order_by(MatchPlayer.jersey_number).all()
    return match_players


@router.post("/{match_id}/players", response_model=MatchPlayerResponse)
async def add_match_player(
    match_id: int,
    player_data: MatchPlayerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Add a player to match lineup."""
    # Verify match exists
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Verify player exists
    player = db.query(Player).filter(Player.id == player_data.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Check if player already in match
    existing = db.query(MatchPlayer).filter(
        MatchPlayer.match_id == match_id,
        MatchPlayer.player_id == player_data.player_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Player already in match lineup")

    match_player = MatchPlayer(match_id=match_id, **player_data.model_dump())
    db.add(match_player)
    db.commit()
    db.refresh(match_player)

    # Reload with player relationship
    match_player = db.query(MatchPlayer).options(
        joinedload(MatchPlayer.player)
    ).filter(MatchPlayer.id == match_player.id).first()

    return match_player


@router.put("/{match_id}/players/{match_player_id}", response_model=MatchPlayerResponse)
async def update_match_player(
    match_id: int,
    match_player_id: int,
    player_data: MatchPlayerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Update a match player."""
    match_player = db.query(MatchPlayer).filter(
        MatchPlayer.id == match_player_id,
        MatchPlayer.match_id == match_id
    ).first()

    if not match_player:
        raise HTTPException(status_code=404, detail="Match player not found")

    for key, value in player_data.model_dump(exclude_unset=True).items():
        setattr(match_player, key, value)

    db.commit()
    db.refresh(match_player)

    # Reload with player relationship
    match_player = db.query(MatchPlayer).options(
        joinedload(MatchPlayer.player)
    ).filter(MatchPlayer.id == match_player.id).first()

    return match_player


@router.delete("/{match_id}/players/{match_player_id}")
async def remove_match_player(
    match_id: int,
    match_player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Remove a player from match lineup."""
    match_player = db.query(MatchPlayer).filter(
        MatchPlayer.id == match_player_id,
        MatchPlayer.match_id == match_id
    ).first()

    if not match_player:
        raise HTTPException(status_code=404, detail="Match player not found")

    db.delete(match_player)
    db.commit()
    return {"message": "Player removed from match"}
