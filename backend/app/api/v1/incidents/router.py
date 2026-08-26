from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.core.security import get_current_firebase_uid
from app.repositories.incident_repository import IncidentRepository
from app.schemas.incident import (
    IncidentCreate,
    IncidentStatusUpdate,
    IncidentResponse,
    TimelineEventCreate,
    TimelineEventResponse,
    IncidentLocationCreate,
    IncidentLocationResponse,
)

router = APIRouter(prefix="/incidents", tags=["Module 19 — Incident Timeline & Complete History"])

@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def create_incident(
    payload: IncidentCreate,
    user_id: str = Depends(get_current_firebase_uid),
    db: Session = Depends(get_db),
):
    """
    Create a new safety incident for the authenticated user.
    """
    repo = IncidentRepository(db)
    try:
        record = repo.create_incident(user_id=user_id, data=payload)
        return IncidentResponse(**record)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create incident: {e}")

@router.get("", response_model=List[IncidentResponse], status_code=status.HTTP_200_OK)
async def list_user_incidents(
    user_id: str = Depends(get_current_firebase_uid),
    db: Session = Depends(get_db),
):
    """
    Retrieve all historical safety incidents belonging strictly to the authenticated user.
    """
    repo = IncidentRepository(db)
    records = repo.get_user_incidents(user_id=user_id)
    return [IncidentResponse(**r) for r in records]

@router.get("/{incident_id}", response_model=IncidentResponse, status_code=status.HTTP_200_OK)
async def get_incident(
    incident_id: str,
    user_id: str = Depends(get_current_firebase_uid),
    db: Session = Depends(get_db),
):
    """
    Retrieve single incident details. Enforces user ownership.
    """
    repo = IncidentRepository(db)
    try:
        record = repo.get_incident_by_id(incident_id=incident_id, user_id=user_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
        return IncidentResponse(**record)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this incident")

@router.patch("/{incident_id}/status", response_model=IncidentResponse, status_code=status.HTTP_200_OK)
async def update_incident_status(
    incident_id: str,
    payload: IncidentStatusUpdate,
    user_id: str = Depends(get_current_firebase_uid),
    db: Session = Depends(get_db),
):
    """
    Update incident lifecycle status (e.g. ACTIVE -> RESOLVED / CLOSED).
    """
    repo = IncidentRepository(db)
    try:
        record = repo.update_incident_status(incident_id=incident_id, user_id=user_id, data=payload)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
        return IncidentResponse(**record)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to update this incident")

@router.post("/{incident_id}/timeline", response_model=TimelineEventResponse, status_code=status.HTTP_201_CREATED)
async def add_timeline_event(
    incident_id: str,
    payload: TimelineEventCreate,
    user_id: str = Depends(get_current_firebase_uid),
    db: Session = Depends(get_db),
):
    """
    Append a chronological safety event to the incident timeline.
    Idempotent: Duplicate clientEventId submissions return existing event without duplication.
    """
    repo = IncidentRepository(db)
    try:
        event = repo.add_timeline_event(incident_id=incident_id, user_id=user_id, data=payload)
        return TimelineEventResponse(**event)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this incident")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to log event: {e}")

@router.get("/{incident_id}/timeline", response_model=List[TimelineEventResponse], status_code=status.HTTP_200_OK)
async def get_incident_timeline(
    incident_id: str,
    user_id: str = Depends(get_current_firebase_uid),
    db: Session = Depends(get_db),
):
    """
    Retrieve the complete, authoritative chronological timeline of events for an incident.
    """
    repo = IncidentRepository(db)
    try:
        events = repo.get_incident_timeline(incident_id=incident_id, user_id=user_id)
        return [TimelineEventResponse(**e) for e in events]
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this incident timeline")

@router.post("/{incident_id}/locations", response_model=IncidentLocationResponse, status_code=status.HTTP_201_CREATED)
async def add_incident_location(
    incident_id: str,
    payload: IncidentLocationCreate,
    user_id: str = Depends(get_current_firebase_uid),
    db: Session = Depends(get_db),
):
    """
    Ingest a GPS breadcrumb track point for an active incident.
    """
    repo = IncidentRepository(db)
    try:
        loc = repo.add_location_track(incident_id=incident_id, user_id=user_id, data=payload)
        return IncidentLocationResponse(**loc)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

@router.get("/{incident_id}/locations", response_model=List[IncidentLocationResponse], status_code=status.HTTP_200_OK)
async def get_incident_locations(
    incident_id: str,
    user_id: str = Depends(get_current_firebase_uid),
    db: Session = Depends(get_db),
):
    """
    Retrieve GPS tracking breadcrumbs for an incident.
    """
    repo = IncidentRepository(db)
    try:
        locs = repo.get_incident_locations(incident_id=incident_id, user_id=user_id)
        return [IncidentLocationResponse(**l) for l in locs]
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
