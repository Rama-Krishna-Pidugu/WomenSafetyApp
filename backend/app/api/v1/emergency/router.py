from fastapi import APIRouter, Depends, Query, status, HTTPException
from typing import List, Dict, Any
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.schemas.emergency import (
    EmergencyContactCreate,
    EmergencyContactUpdate,
    EmergencyContactResponse,
    SOSIncidentCreate,
    SOSIncidentResponse,
    IncidentSyncPayload,
)
from app.services.notification.notification_service import NotificationService
from app.repositories.emergency_contact_repository import EmergencyContactRepository
from app.repositories.user_repository import UserRepository
from app.core.security import get_current_firebase_uid
from app.db.session import get_db
from app.core.logging import logger

router = APIRouter(prefix="/emergency", tags=["Emergency Service & SOS"])

_incident_events: List[Dict[str, Any]] = []

def _resolve_caller_user_id(current_uid: str) -> str:
    caller = UserRepository().get_by_firebase_uid(current_uid)
    if not caller:
        raise HTTPException(status_code=400, detail="Complete your profile before managing emergency contacts")
    return caller["id"]


@router.post("/contacts", response_model=EmergencyContactResponse, status_code=status.HTTP_201_CREATED)
async def add_emergency_contact(payload: EmergencyContactCreate, current_uid: str = Depends(get_current_firebase_uid)):
    user_id = _resolve_caller_user_id(current_uid)
    try:
        contact = EmergencyContactRepository().create(
            user_id=user_id,
            name=payload.name,
            phone=payload.phone,
            relationship=payload.relationship,
            priority=payload.priority,
            is_active=payload.is_active,
            notification_enabled=payload.notification_enabled,
            live_location_enabled=payload.live_location_enabled,
            sms_enabled=payload.sms_enabled,
        )
        logger.info(f"Emergency contact added successfully for user_id={user_id}")
        return contact
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Error adding emergency contact: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to add emergency contact: {str(err)}")


@router.get("/contacts/user/{user_id}", response_model=List[EmergencyContactResponse])
async def get_user_emergency_contacts(user_id: str, current_uid: str = Depends(get_current_firebase_uid)):
    if _resolve_caller_user_id(current_uid) != user_id:
        raise HTTPException(status_code=403, detail="Cannot access another user's emergency contacts")
    try:
        return EmergencyContactRepository().list_by_user(user_id)
    except Exception as err:
        logger.error(f"Error fetching emergency contacts for user {user_id}: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch emergency contacts: {str(err)}")


@router.patch("/contacts/{contact_id}", response_model=EmergencyContactResponse)
async def update_emergency_contact(
    contact_id: str,
    payload: EmergencyContactUpdate,
    current_uid: str = Depends(get_current_firebase_uid),
):
    user_id = _resolve_caller_user_id(current_uid)
    try:
        contact = EmergencyContactRepository().update(
            contact_id,
            user_id,
            name=payload.name,
            phone=payload.phone,
            relationship=payload.relationship,
            priority=payload.priority,
            is_active=payload.is_active,
            notification_enabled=payload.notification_enabled,
            live_location_enabled=payload.live_location_enabled,
            sms_enabled=payload.sms_enabled,
        )
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        return contact
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Error updating emergency contact {contact_id}: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to update emergency contact: {str(err)}")


@router.delete("/contacts/{contact_id}")
async def delete_emergency_contact(contact_id: str, current_uid: str = Depends(get_current_firebase_uid)):
    user_id = _resolve_caller_user_id(current_uid)
    try:
        deleted = EmergencyContactRepository().delete(contact_id, user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Contact not found")
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Error deleting emergency contact {contact_id}: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to delete emergency contact: {str(err)}")

@router.post("/sos/trigger", response_model=SOSIncidentResponse, status_code=status.HTTP_201_CREATED)
async def trigger_sos_incident(
    payload: SOSIncidentCreate,
    db: Session = Depends(get_db),
    current_uid: str = Depends(get_current_firebase_uid),
):
    if _resolve_caller_user_id(current_uid) != payload.user_id:
        raise HTTPException(status_code=403, detail="Cannot trigger an SOS for another user")

    notification_service = NotificationService(db)
    # Notifies the user's own other devices (existing behavior).
    notification_service.send_sos_alert_to_user(
        user_id=payload.user_id,
        title="SOS TRIGGERED",
        body=f"Emergency SOS triggered at Lat: {payload.latitude}, Lng: {payload.longitude}"
    )
    # Notifies the user's Safety Circle (trusted contacts) - this is the new path; previously
    # nothing in this endpoint reached the Safety Circle at all.
    notification_service.dispatch_safety_event(
        user_id=payload.user_id,
        event_type="SOS_ACTIVATED",
        title="🚨 SOS Activated",
        body=f"Your trusted contact triggered an SOS at Lat: {payload.latitude}, Lng: {payload.longitude}",
        data={"latitude": payload.latitude, "longitude": payload.longitude},
        severity="CRITICAL",
    )

    return SOSIncidentResponse(
        id="sos-456",
        user_id=payload.user_id,
        status="ACTIVE",
        trigger_type=payload.trigger_type,
        danger_score=90,
        latitude=payload.latitude,
        longitude=payload.longitude
    )


@router.post("/incidents/sync", status_code=status.HTTP_200_OK)
async def sync_incident_event(payload: IncidentSyncPayload):
    event_id = str(uuid.uuid4())
    occurred_at_iso = datetime.fromtimestamp(payload.occurredAt / 1000, tz=timezone.utc).isoformat()
    started_at_iso = datetime.fromtimestamp(payload.startedAt / 1000, tz=timezone.utc).isoformat()

    logger.info(
        f"[incidents/sync] step={payload.step} clientIncidentId={payload.clientIncidentId} "
        f"uid={payload.firebaseUid} status={payload.status}"
    )

    event: Dict[str, Any] = {
        "id": event_id,
        "clientIncidentId": payload.clientIncidentId,
        "firebaseUid": payload.firebaseUid,
        "source": payload.source,
        "status": payload.status,
        "startedAt": started_at_iso,
        "step": payload.step,
        "stepData": payload.stepData,
        "location": payload.location.model_dump() if payload.location else None,
        "occurredAt": occurred_at_iso,
    }
    _incident_events.append(event)

    return {"success": True, "data": {"incidentId": event_id, "step": payload.step}}


@router.get("/incidents/history", status_code=status.HTTP_200_OK)
async def get_incident_history(
    firebaseUid: str = Query(..., description="Firebase UID of the requesting user"),
):
    events = [e for e in _incident_events if e.get("firebaseUid") == firebaseUid]
    seen: Dict[str, Any] = {}
    for ev in events:
        cid = ev["clientIncidentId"]
        seen[cid] = {
            "id": ev["id"],
            "clientIncidentId": cid,
            "source": ev.get("source"),
            "status": ev.get("status"),
            "startedAt": ev.get("startedAt"),
            "firebaseUid": ev.get("firebaseUid"),
        }

    return {"success": True, "data": list(seen.values())}
