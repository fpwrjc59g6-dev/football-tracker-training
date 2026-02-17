"""
Football Tracker - Video Processing Router
Handles video processing, status updates, and job management.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from app.database import get_db
from app.models.team import Match
from app.models.user import User
from app.auth import get_current_user, require_analyst

router = APIRouter(prefix="/processing", tags=["Processing"])


class ProcessingStatusResponse(BaseModel):
    """Response model for processing status."""
    match_id: int
    video_filename: Optional[str]
    is_processed: bool
    processing_status: str
    progress_percent: Optional[float] = None
    frames_processed: Optional[int] = None
    total_frames: Optional[int] = None
    detections_count: Optional[int] = None
    events_count: Optional[int] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class StartProcessingRequest(BaseModel):
    """Request model for starting processing."""
    start_frame: Optional[int] = 0
    end_frame: Optional[int] = None
    process_fps: Optional[int] = 5
    reprocess: bool = False


@router.get("/status/{match_id}", response_model=ProcessingStatusResponse)
async def get_processing_status(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed processing status for a match.

    Returns current state including:
    - Processing status (pending, queued, processing, completed, error)
    - Progress percentage
    - Frame counts
    - Detection/event counts
    - Error messages if any
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Get counts from database
    detections_count = 0
    events_count = 0
    frames_count = 0

    try:
        # Count frames
        result = db.execute(text(
            "SELECT COUNT(*) FROM frames WHERE match_id = :match_id"
        ), {"match_id": match_id})
        frames_count = result.scalar() or 0

        # Count detections through frames
        result = db.execute(text("""
            SELECT COUNT(*) FROM detections d
            JOIN frames f ON d.frame_id = f.id
            WHERE f.match_id = :match_id
        """), {"match_id": match_id})
        detections_count = result.scalar() or 0

        # Count events
        result = db.execute(text(
            "SELECT COUNT(*) FROM events WHERE match_id = :match_id AND is_deleted = false"
        ), {"match_id": match_id})
        events_count = result.scalar() or 0
    except Exception as e:
        print(f"Error getting counts: {e}")

    # Calculate progress
    progress = None
    if match.total_frames and match.total_frames > 0 and frames_count > 0:
        progress = min(100.0, (frames_count / match.total_frames) * 100)

    return ProcessingStatusResponse(
        match_id=match_id,
        video_filename=match.video_filename,
        is_processed=match.is_processed,
        processing_status=match.processing_status or "pending",
        progress_percent=progress,
        frames_processed=frames_count,
        total_frames=match.total_frames,
        detections_count=detections_count,
        events_count=events_count,
        error_message=None,  # Could add error tracking field to Match model
        started_at=None,  # Could add started_at field to Match model
        completed_at=match.processed_at,
    )


@router.post("/start/{match_id}")
async def start_processing(
    match_id: int,
    request: StartProcessingRequest = StartProcessingRequest(),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """
    Start or restart video processing for a match.

    Processing runs in the background and updates status as it progresses.
    Use the /status endpoint to monitor progress.

    Options:
    - start_frame: Frame to start processing from (default: 0)
    - end_frame: Frame to stop at (default: all frames)
    - process_fps: Target frames per second to process (default: 5)
    - reprocess: If true, clears existing data and reprocesses
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if not match.video_filename:
        raise HTTPException(
            status_code=400,
            detail="No video file associated with this match. Please set video_filename first."
        )

    # Check if already processing
    if match.processing_status == "processing" and not request.reprocess:
        raise HTTPException(
            status_code=400,
            detail="Match is already being processed. Use reprocess=true to restart."
        )

    # If reprocessing, optionally clear existing data
    if request.reprocess and match.is_processed:
        # Mark as reprocessing
        match.processing_status = "reprocessing"
        db.commit()

    # Update status to queued
    match.processing_status = "queued"
    db.commit()

    # Note: Actual processing would be triggered here via background task or queue
    # For now, we just update the status. The actual processing happens via:
    # 1. Local script (scripts/local_inference.py)
    # 2. Or by calling the video_processor service

    return {
        "message": "Processing queued",
        "match_id": match_id,
        "status": "queued",
        "video_filename": match.video_filename,
        "instructions": "Run the local processing script or wait for background processing to start."
    }


@router.post("/update-status/{match_id}")
async def update_processing_status(
    match_id: int,
    status: str = Query(..., description="New status: pending, queued, processing, completed, error"),
    progress: Optional[float] = Query(None, description="Progress percentage 0-100"),
    error_message: Optional[str] = Query(None, description="Error message if status is error"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """
    Update processing status for a match.

    Used by processing scripts to report progress back to the system.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    valid_statuses = ["pending", "queued", "processing", "completed", "error"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    match.processing_status = status

    if status == "completed":
        match.is_processed = True
        match.processed_at = datetime.utcnow()
    elif status == "error":
        match.is_processed = False

    db.commit()

    return {
        "message": "Status updated",
        "match_id": match_id,
        "status": status,
        "is_processed": match.is_processed
    }


@router.post("/complete/{match_id}")
async def mark_processing_complete(
    match_id: int,
    frames_processed: Optional[int] = Query(None),
    total_detections: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """
    Mark a match as fully processed.

    Called when processing completes successfully.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    match.is_processed = True
    match.processing_status = "completed"
    match.processed_at = datetime.utcnow()

    if frames_processed:
        match.total_frames = frames_processed

    db.commit()

    return {
        "message": "Processing marked complete",
        "match_id": match_id,
        "is_processed": True,
        "processed_at": match.processed_at.isoformat()
    }


@router.post("/cancel/{match_id}")
async def cancel_processing(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst)
):
    """
    Cancel ongoing processing for a match.

    Resets status back to pending.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.processing_status not in ["queued", "processing"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel - match is not being processed (status: {match.processing_status})"
        )

    match.processing_status = "cancelled"
    db.commit()

    return {
        "message": "Processing cancelled",
        "match_id": match_id,
        "status": "cancelled"
    }


@router.get("/queue")
async def get_processing_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of matches in the processing queue.

    Returns matches that are queued or currently processing.
    """
    matches = db.query(Match).filter(
        Match.processing_status.in_(["queued", "processing"])
    ).order_by(Match.created_at).all()

    return {
        "queue_length": len(matches),
        "matches": [
            {
                "id": m.id,
                "name": f"{m.home_team_name} vs {m.away_team_name}" if hasattr(m, 'home_team_name') else f"Match {m.id}",
                "video_filename": m.video_filename,
                "status": m.processing_status,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in matches
        ]
    }


@router.get("/stats")
async def get_processing_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get overall processing statistics.
    """
    total_matches = db.query(Match).count()
    processed_matches = db.query(Match).filter(Match.is_processed == True).count()
    pending_matches = db.query(Match).filter(Match.is_processed == False).count()

    # Status breakdown
    queued = db.query(Match).filter(Match.processing_status == "queued").count()
    processing = db.query(Match).filter(Match.processing_status == "processing").count()
    completed = db.query(Match).filter(Match.processing_status == "completed").count()
    error = db.query(Match).filter(Match.processing_status == "error").count()

    return {
        "total_matches": total_matches,
        "processed_matches": processed_matches,
        "pending_matches": pending_matches,
        "status_breakdown": {
            "queued": queued,
            "processing": processing,
            "completed": completed,
            "error": error
        }
    }
