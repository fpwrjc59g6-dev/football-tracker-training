"""Accuracy metrics router."""
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.training import AccuracyMetric, AccuracyHistory, MetricCategory
from app.models.corrections import Correction, CorrectionType
from app.models.events import Event, EventType
from app.models.tracking import Track
from app.models.team import Match
from app.models.user import User
from app.schemas.training import AccuracyMetricResponse, AccuracyDashboard, AccuracyTrend, AccuracyComparison
from app.auth import get_current_user

router = APIRouter(prefix="/accuracy", tags=["Accuracy"])


@router.get("/dashboard", response_model=AccuracyDashboard)
async def get_accuracy_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get full accuracy dashboard with trends."""
    # Get latest metrics across all matches
    latest_metrics = {}
    for category in MetricCategory:
        metric = db.query(AccuracyMetric).filter(
            AccuracyMetric.category == category
        ).order_by(AccuracyMetric.calculated_at.desc()).first()

        if metric:
            latest_metrics[category] = metric.accuracy

    # Calculate overall accuracy
    overall = latest_metrics.get(MetricCategory.OVERALL, 0.0)

    # Get trends (last 10 weeks)
    trends = []
    history = db.query(AccuracyHistory).filter(
        AccuracyHistory.category == MetricCategory.OVERALL
    ).order_by(AccuracyHistory.period_start.desc()).limit(10).all()

    for h in reversed(history):
        trends.append(AccuracyTrend(
            period_start=h.period_start,
            period_end=h.period_end,
            category=h.category,
            accuracy=h.accuracy,
            matches_count=h.matches_count,
            total_corrections=h.total_corrections,
            model_version=h.model_version,
        ))

    # Totals
    total_matches = db.query(func.count(Match.id)).filter(Match.is_processed == True).scalar()
    total_corrections = db.query(func.count(Correction.id)).scalar()
    total_events_reviewed = db.query(func.count(Event.id)).filter(
        (Event.is_corrected == True) | (Event.is_manually_added == True)
    ).scalar()
    total_tracks_reviewed = db.query(func.count(Track.id)).filter(
        Track.is_reviewed == True
    ).scalar()

    # Event type breakdown
    event_type_accuracy = {}
    for event_type in EventType:
        total = db.query(func.count(Event.id)).filter(
            Event.event_type == event_type,
            Event.is_ai_generated == True
        ).scalar()

        if total > 0:
            corrected = db.query(func.count(Event.id)).filter(
                Event.event_type == event_type,
                Event.is_ai_generated == True,
                Event.is_corrected == True
            ).scalar()

            deleted = db.query(func.count(Event.id)).filter(
                Event.event_type == event_type,
                Event.is_ai_generated == True,
                Event.is_deleted == True
            ).scalar()

            accuracy = ((total - corrected - deleted) / total) * 100
            event_type_accuracy[event_type.value] = round(accuracy, 1)

    # Recent matches with accuracy
    recent_matches = db.query(Match).filter(
        Match.is_processed == True
    ).order_by(Match.match_date.desc()).limit(10).all()

    recent_match_data = [
        {
            "id": m.id,
            "match_date": m.match_date.isoformat(),
            "home_team_id": m.home_team_id,
            "away_team_id": m.away_team_id,
            "ai_accuracy_overall": m.ai_accuracy_overall,
            "ai_accuracy_events": m.ai_accuracy_events,
            "ai_accuracy_tracking": m.ai_accuracy_tracking,
        }
        for m in recent_matches
    ]

    return AccuracyDashboard(
        overall_accuracy=overall,
        detection_accuracy=latest_metrics.get(MetricCategory.DETECTION),
        tracking_accuracy=latest_metrics.get(MetricCategory.TRACKING),
        team_assignment_accuracy=latest_metrics.get(MetricCategory.TEAM_ASSIGNMENT),
        jersey_recognition_accuracy=latest_metrics.get(MetricCategory.JERSEY_RECOGNITION),
        event_detection_accuracy=latest_metrics.get(MetricCategory.EVENT_DETECTION),
        trends=trends,
        total_matches_processed=total_matches,
        total_corrections_made=total_corrections,
        total_events_reviewed=total_events_reviewed,
        total_tracks_reviewed=total_tracks_reviewed,
        event_type_accuracy=event_type_accuracy,
        recent_matches=recent_match_data,
    )


@router.get("/matches/{match_id}", response_model=List[AccuracyMetricResponse])
async def get_match_accuracy(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get accuracy metrics for a specific match."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    metrics = db.query(AccuracyMetric).filter(
        AccuracyMetric.match_id == match_id
    ).order_by(AccuracyMetric.category).all()

    return metrics


@router.post("/matches/{match_id}/calculate")
async def calculate_match_accuracy(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Calculate and store accuracy metrics for a match."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Delete existing metrics
    db.query(AccuracyMetric).filter(AccuracyMetric.match_id == match_id).delete()

    metrics = []

    # === EVENT DETECTION ACCURACY ===
    total_ai_events = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_ai_generated == True
    ).scalar()

    corrected_events = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_ai_generated == True,
        Event.is_corrected == True
    ).scalar()

    deleted_events = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_ai_generated == True,
        Event.is_deleted == True
    ).scalar()

    manually_added = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_manually_added == True
    ).scalar()

    if total_ai_events > 0:
        event_accuracy = ((total_ai_events - corrected_events - deleted_events) / total_ai_events) * 100

        # Event type breakdown
        event_breakdown = {}
        for event_type in EventType:
            type_total = db.query(func.count(Event.id)).filter(
                Event.match_id == match_id,
                Event.event_type == event_type,
                Event.is_ai_generated == True
            ).scalar()

            if type_total > 0:
                type_wrong = db.query(func.count(Event.id)).filter(
                    Event.match_id == match_id,
                    Event.event_type == event_type,
                    Event.is_ai_generated == True,
                    (Event.is_corrected == True) | (Event.is_deleted == True)
                ).scalar()

                event_breakdown[event_type.value] = round(((type_total - type_wrong) / type_total) * 100, 1)

        event_metric = AccuracyMetric(
            match_id=match_id,
            category=MetricCategory.EVENT_DETECTION,
            accuracy=round(event_accuracy, 1),
            total_predictions=total_ai_events,
            correct_predictions=total_ai_events - corrected_events - deleted_events,
            false_positives=deleted_events,
            false_negatives=manually_added,
            breakdown=event_breakdown,
            corrections_count=corrected_events + deleted_events,
        )
        db.add(event_metric)
        metrics.append(event_metric)

        match.ai_accuracy_events = round(event_accuracy, 1)

    # === TRACKING ACCURACY (Team Assignment) ===
    total_tracks = db.query(func.count(Track.id)).filter(
        Track.match_id == match_id
    ).scalar()

    team_corrected = db.query(func.count(Track.id)).filter(
        Track.match_id == match_id,
        Track.corrected_team.isnot(None)
    ).scalar()

    if total_tracks > 0:
        team_accuracy = ((total_tracks - team_corrected) / total_tracks) * 100

        team_metric = AccuracyMetric(
            match_id=match_id,
            category=MetricCategory.TEAM_ASSIGNMENT,
            accuracy=round(team_accuracy, 1),
            total_predictions=total_tracks,
            correct_predictions=total_tracks - team_corrected,
            false_positives=0,
            false_negatives=0,
            corrections_count=team_corrected,
        )
        db.add(team_metric)
        metrics.append(team_metric)

        match.ai_accuracy_tracking = round(team_accuracy, 1)

    # === OVERALL ACCURACY ===
    if metrics:
        overall_accuracy = sum(m.accuracy for m in metrics) / len(metrics)

        overall_metric = AccuracyMetric(
            match_id=match_id,
            category=MetricCategory.OVERALL,
            accuracy=round(overall_accuracy, 1),
            total_predictions=sum(m.total_predictions for m in metrics),
            correct_predictions=sum(m.correct_predictions for m in metrics),
            false_positives=sum(m.false_positives for m in metrics),
            false_negatives=sum(m.false_negatives for m in metrics),
            corrections_count=sum(m.corrections_count for m in metrics),
        )
        db.add(overall_metric)

        match.ai_accuracy_overall = round(overall_accuracy, 1)

    db.commit()

    return {"message": "Accuracy calculated", "metrics_count": len(metrics) + 1}


@router.get("/comparison/{match_id}", response_model=AccuracyComparison)
async def get_accuracy_comparison(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed AI vs ground truth comparison for a match."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Event comparison
    ai_events = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_ai_generated == True
    ).scalar()

    ground_truth_events = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_deleted == False
    ).scalar()

    matched = ai_events - db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_ai_generated == True,
        (Event.is_corrected == True) | (Event.is_deleted == True)
    ).scalar()

    false_positives = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_ai_generated == True,
        Event.is_deleted == True
    ).scalar()

    false_negatives = db.query(func.count(Event.id)).filter(
        Event.match_id == match_id,
        Event.is_manually_added == True
    ).scalar()

    event_accuracy = (matched / ai_events * 100) if ai_events > 0 else 0

    # Event type breakdown
    event_type_breakdown = {}
    for event_type in EventType:
        ai_count = db.query(func.count(Event.id)).filter(
            Event.match_id == match_id,
            Event.event_type == event_type,
            Event.is_ai_generated == True
        ).scalar()

        if ai_count > 0:
            correct = ai_count - db.query(func.count(Event.id)).filter(
                Event.match_id == match_id,
                Event.event_type == event_type,
                Event.is_ai_generated == True,
                (Event.is_corrected == True) | (Event.is_deleted == True)
            ).scalar()

            event_type_breakdown[event_type.value] = {
                "ai_count": ai_count,
                "correct": correct,
                "accuracy": round((correct / ai_count * 100), 1)
            }

    # Track comparison
    ai_tracks = db.query(func.count(Track.id)).filter(
        Track.match_id == match_id
    ).scalar()

    corrected_tracks = db.query(func.count(Track.id)).filter(
        Track.match_id == match_id,
        Track.is_corrected == True
    ).scalar()

    track_accuracy = ((ai_tracks - corrected_tracks) / ai_tracks * 100) if ai_tracks > 0 else 0

    # Team assignment
    team_corrections = db.query(func.count(Track.id)).filter(
        Track.match_id == match_id,
        Track.corrected_team.isnot(None)
    ).scalar()

    team_accuracy = ((ai_tracks - team_corrections) / ai_tracks * 100) if ai_tracks > 0 else 0

    # Jersey recognition
    jersey_corrections = db.query(func.count(Track.id)).filter(
        Track.match_id == match_id,
        Track.corrected_jersey_number.isnot(None)
    ).scalar()

    tracks_with_jersey = db.query(func.count(Track.id)).filter(
        Track.match_id == match_id,
        Track.ai_jersey_number.isnot(None)
    ).scalar()

    jersey_accuracy = ((tracks_with_jersey - jersey_corrections) / tracks_with_jersey * 100) if tracks_with_jersey > 0 else 0

    return AccuracyComparison(
        match_id=match_id,
        ai_events_count=ai_events,
        ground_truth_events_count=ground_truth_events,
        matched_events=matched,
        false_positives=false_positives,
        false_negatives=false_negatives,
        event_accuracy=round(event_accuracy, 1),
        event_type_breakdown=event_type_breakdown,
        ai_tracks_count=ai_tracks,
        corrected_tracks_count=corrected_tracks,
        track_accuracy=round(track_accuracy, 1),
        team_assignment_accuracy=round(team_accuracy, 1),
        jersey_recognition_accuracy=round(jersey_accuracy, 1),
    )
