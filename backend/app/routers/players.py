"""Players router."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.team import Player, Team
from app.models.user import User
from app.schemas.team import PlayerCreate, PlayerUpdate, PlayerResponse
from app.auth import get_current_user, require_analyst

router = APIRouter(prefix="/players", tags=["Players"])


@router.get("", response_model=List[PlayerResponse])
async def list_players(
    team_id: Optional[int] = Query(None, description="Filter by team ID"),
    search: Optional[str] = Query(None, description="Search by name"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List players with optional filters."""
    query = db.query(Player)

    if team_id:
        query = query.filter(Player.team_id == team_id)

    if search:
        query = query.filter(Player.name.ilike(f"%{search}%"))

    players = query.order_by(Player.jersey_number).offset(skip).limit(limit).all()
    return players


@router.post("", response_model=PlayerResponse)
async def create_player(
    player_data: PlayerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Create a new player."""
    # Verify team exists
    team = db.query(Team).filter(Team.id == player_data.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    player = Player(**player_data.model_dump())
    db.add(player)
    db.commit()
    db.refresh(player)
    return player


@router.post("/bulk", response_model=List[PlayerResponse])
async def create_players_bulk(
    players_data: List[PlayerCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Create multiple players at once."""
    players = []
    for player_data in players_data:
        player = Player(**player_data.model_dump())
        db.add(player)
        players.append(player)

    db.commit()
    for player in players:
        db.refresh(player)

    return players


@router.get("/{player_id}", response_model=PlayerResponse)
async def get_player(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a player by ID."""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@router.put("/{player_id}", response_model=PlayerResponse)
async def update_player(
    player_id: int,
    player_data: PlayerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Update a player."""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    for key, value in player_data.model_dump(exclude_unset=True).items():
        setattr(player, key, value)

    db.commit()
    db.refresh(player)
    return player


@router.delete("/{player_id}")
async def delete_player(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Delete a player."""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    db.delete(player)
    db.commit()
    return {"message": "Player deleted"}
