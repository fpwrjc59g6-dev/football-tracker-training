"""Corrections router."""
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.corrections import Correction, CorrectionType
from app.models.team import Match
from app.models.user import User
from app.schemas.corrections import CorrectionCreate, CorrectionResponse, CorrectionSummary, CorrectionBatch
from app.auth import get_current_user, require_analyst

router = APIRouter(prefix="/corrections", tags=["Corrections"])


@router.get("", response_model=List[CorrectionResponse])
async def list_corrections(
    match_id: Optional[int] = Query(None, description="Filter by match ID"),
    correction_type: Optional[CorrectionType] = Query(None, description="Filter by correction type"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    used_in_training: Optional[bool] = Query(None, description="Filter by training status"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List corrections with filters."""
    query = db.query(Correction)

    if match_id:
        query = query.filter(Correction.match_id == match_id)

    if correction_type:
        query = query.filter(Correction.correction_type == correction_type)

    if user_id:
        query = query.filter(Correction.user_id == user_id)

    if used_in_training is not None:
        query = query.filter(Correction.used_in_training == used_in_training)

    corrections = query.order_by(Correction.created_at.desc()).offset(skip).limit(limit).all()
    return corrections


@router.get("/summary", response_model=CorrectionSummary)
async def get_correction_summary(
    match_id: Optional[int] = Query(None, description="Filter by match ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get correction summary statistics."""
    base_query = db.query(Correction)

    if match_id:
        base_query = base_query.filter(Correction.match_id == match_id)

    # Total
    total = base_query.count()

    # By type
    by_type_query = base_query.with_entities(
        Correction.correction_type, func.count(Correction.id)
    ).group_by(Correction.correction_type)

    by_type = {str(ct.value): count for ct, count in by_type_query.all()}

    # By user
    by_user_query = db.query(
        User.username, func.count(Correction.id)
    ).join(Correction).group_by(User.id)

    if match_id:
        by_user_query = by_user_query.filter(Correction.match_id == match_id)

    by_user = {username: count for username, count in by_user_query.all()}

    # Training status
    used = base_query.filter(Correction.used_in_training == True).count()
    pending = total - used

    return CorrectionSummary(
        total_corrections=total,
        by_type=by_type,
        by_user=by_user,
        used_in_training=used,
        pending_training=pending,
    )


@router.post("", response_model=CorrectionResponse)
async def create_correction(
    correction_data: CorrectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Create a new correction."""
    # Verify match exists
    match = db.query(Match).filter(Match.id == correction_data.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    correction = Correction(
        user_id=current_user.id,
        **correction_data.model_dump()
    )

    db.add(correction)
    db.commit()
    db.refresh(correction)

    return correction


@router.post("/batch", response_model=List[CorrectionResponse])
async def create_corrections_batch(
    batch_data: CorrectionBatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Create multiple corrections at once."""
    corrections = []

    for correction_data in batch_data.corrections:
        correction = Correction(
            user_id=current_user.id,
            **correction_data.model_dump()
        )
        db.add(correction)
        corrections.append(correction)

    db.commit()

    for correction in corrections:
        db.refresh(correction)

    return corrections


@router.get("/{correction_id}", response_model=CorrectionResponse)
async def get_correction(
    correction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a correction by ID."""
    correction = db.query(Correction).filter(Correction.id == correction_id).first()

    if not correction:
        raise HTTPException(status_code=404, detail="Correction not found")

    return correction


@router.delete("/{correction_id}")
async def delete_correction(
    correction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """Delete a correction."""
    correction = db.query(Correction).filter(Correction.id == correction_id).first()

    if not correction:
        raise HTTPException(status_code=404, detail="Correction not found")

    # Only allow deleting if not used in training
    if correction.used_in_training:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete correction that has been used in training"
        )

    db.delete(correction)
    db.commit()

    return {"message": "Correction deleted"}
