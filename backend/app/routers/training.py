"""Training export router."""
import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import io

from app.database import get_db
from app.models.training import TrainingExport, ExportType, ExportFormat
from app.models.corrections import Correction
from app.models.events import Event
from app.models.tracking import Track, Detection, Frame
from app.models.team import Match
from app.models.user import User, UserRole
from app.schemas.training import TrainingExportCreate, TrainingExportResponse
from app.auth import get_current_user, require_admin

router = APIRouter(prefix="/training", tags=["Training"])


@router.get("/exports", response_model=List[TrainingExportResponse])
async def list_exports(
    export_type: Optional[ExportType] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List training exports."""
    query = db.query(TrainingExport)

    if export_type:
        query = query.filter(TrainingExport.export_type == export_type)

    exports = query.order_by(TrainingExport.created_at.desc()).offset(skip).limit(limit).all()
    return exports


@router.post("/exports", response_model=TrainingExportResponse)
async def create_export(
    export_data: TrainingExportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new training data export."""
    # Get matches to include
    if export_data.match_ids:
        matches = db.query(Match).filter(Match.id.in_(export_data.match_ids)).all()
        match_ids = [m.id for m in matches]
    else:
        matches = db.query(Match).filter(Match.is_processed == True).all()
        match_ids = [m.id for m in matches]

    if not match_ids:
        raise HTTPException(status_code=400, detail="No matches found for export")

    # Count data
    correction_count = db.query(func.count(Correction.id)).filter(
        Correction.match_id.in_(match_ids),
        Correction.used_in_training == False
    ).scalar()

    frame_count = db.query(func.count(Frame.id)).filter(
        Frame.match_id.in_(match_ids)
    ).scalar()

    event_count = db.query(func.count(Event.id)).filter(
        Event.match_id.in_(match_ids)
    ).scalar()

    # Get date range
    date_range = db.query(
        func.min(Match.match_date),
        func.max(Match.match_date)
    ).filter(Match.id.in_(match_ids)).first()

    # Create export record
    export = TrainingExport(
        export_type=export_data.export_type,
        export_format=export_data.export_format,
        match_ids=match_ids,
        correction_count=correction_count,
        frame_count=frame_count,
        event_count=event_count,
        data_start_date=datetime.combine(date_range[0], datetime.min.time()) if date_range[0] else None,
        data_end_date=datetime.combine(date_range[1], datetime.max.time()) if date_range[1] else None,
        export_config=export_data.export_config,
        notes=export_data.notes,
        created_by_user_id=current_user.id,
    )

    db.add(export)
    db.commit()
    db.refresh(export)

    # Mark corrections as used
    db.query(Correction).filter(
        Correction.match_id.in_(match_ids),
        Correction.used_in_training == False
    ).update({Correction.used_in_training: True, Correction.training_export_id: export.id})

    db.commit()

    return export


@router.get("/exports/{export_id}", response_model=TrainingExportResponse)
async def get_export(
    export_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a training export by ID."""
    export = db.query(TrainingExport).filter(TrainingExport.id == export_id).first()

    if not export:
        raise HTTPException(status_code=404, detail="Export not found")

    return export


@router.get("/exports/{export_id}/download")
async def download_export(
    export_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download training data for an export."""
    export = db.query(TrainingExport).filter(TrainingExport.id == export_id).first()

    if not export:
        raise HTTPException(status_code=404, detail="Export not found")

    # Generate export data based on type
    data = generate_export_data(db, export)

    # Format based on export format
    if export.export_format == ExportFormat.JSON:
        content = json.dumps(data, indent=2, default=str)
        media_type = "application/json"
        filename = f"training_export_{export.id}.json"
    elif export.export_format == ExportFormat.CSV:
        content = generate_csv(data)
        media_type = "text/csv"
        filename = f"training_export_{export.id}.csv"
    else:
        content = json.dumps(data, indent=2, default=str)
        media_type = "application/json"
        filename = f"training_export_{export.id}.json"

    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def generate_export_data(db: Session, export: TrainingExport) -> dict:
    """Generate export data based on export type."""
    match_ids = export.match_ids or []

    data = {
        "export_id": export.id,
        "export_type": export.export_type.value,
        "created_at": export.created_at.isoformat(),
        "matches": [],
    }

    for match_id in match_ids:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            continue

        match_data = {
            "match_id": match.id,
            "home_team_id": match.home_team_id,
            "away_team_id": match.away_team_id,
            "match_date": match.match_date.isoformat(),
            "fps": match.fps,
        }

        if export.export_type in [ExportType.EVENT_DETECTION, ExportType.ALL]:
            # Include events with corrections
            events = db.query(Event).filter(
                Event.match_id == match_id,
                Event.is_deleted == False
            ).all()

            match_data["events"] = [
                {
                    "id": e.id,
                    "frame_start": e.frame_start,
                    "frame_end": e.frame_end,
                    "event_type": e.event_type.value,
                    "event_category": e.event_category.value,
                    "player_track_id": e.player_track_id,
                    "target_track_id": e.target_track_id,
                    "opponent_track_id": e.opponent_track_id,
                    "start_x": e.start_x,
                    "start_y": e.start_y,
                    "end_x": e.end_x,
                    "end_y": e.end_y,
                    "outcome_success": e.outcome_success,
                    "body_part": e.body_part.value if e.body_part else None,
                    "under_pressure": e.under_pressure,
                    "is_ai_generated": e.is_ai_generated,
                    "is_corrected": e.is_corrected,
                    "is_manually_added": e.is_manually_added,
                }
                for e in events
            ]

        if export.export_type in [ExportType.TRACKING, ExportType.TEAM_CLASSIFICATION, ExportType.ALL]:
            # Include tracks with corrections
            tracks = db.query(Track).filter(Track.match_id == match_id).all()

            match_data["tracks"] = [
                {
                    "id": t.id,
                    "track_id": t.track_id,
                    "ai_team": t.ai_team.value,
                    "ai_detection_class": t.ai_detection_class.value,
                    "ai_jersey_number": t.ai_jersey_number,
                    "corrected_team": t.corrected_team.value if t.corrected_team else None,
                    "corrected_detection_class": t.corrected_detection_class.value if t.corrected_detection_class else None,
                    "corrected_jersey_number": t.corrected_jersey_number,
                    "assigned_player_id": t.assigned_player_id,
                    "first_frame": t.first_frame,
                    "last_frame": t.last_frame,
                    "is_corrected": t.is_corrected,
                }
                for t in tracks
            ]

        # Include corrections
        corrections = db.query(Correction).filter(
            Correction.match_id == match_id,
            Correction.training_export_id == export.id
        ).all()

        match_data["corrections"] = [
            {
                "id": c.id,
                "correction_type": c.correction_type.value,
                "track_id": c.track_id,
                "event_id": c.event_id,
                "frame_number": c.frame_number,
                "original_value": c.original_value,
                "corrected_value": c.corrected_value,
            }
            for c in corrections
        ]

        data["matches"].append(match_data)

    return data


def generate_csv(data: dict) -> str:
    """Generate CSV from export data."""
    lines = []

    # Events CSV
    if "matches" in data:
        lines.append("# Events")
        lines.append("match_id,frame_start,event_type,event_category,player_track_id,outcome_success,is_corrected")

        for match in data["matches"]:
            for event in match.get("events", []):
                lines.append(f"{match['match_id']},{event['frame_start']},{event['event_type']},{event['event_category']},{event.get('player_track_id', '')},{event.get('outcome_success', '')},{event['is_corrected']}")

        lines.append("")
        lines.append("# Tracks")
        lines.append("match_id,track_id,ai_team,corrected_team,ai_jersey,corrected_jersey,is_corrected")

        for match in data["matches"]:
            for track in match.get("tracks", []):
                lines.append(f"{match['match_id']},{track['track_id']},{track['ai_team']},{track.get('corrected_team', '')},{track.get('ai_jersey_number', '')},{track.get('corrected_jersey_number', '')},{track['is_corrected']}")

    return "\n".join(lines)
