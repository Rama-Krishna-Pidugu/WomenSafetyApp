from fastapi import APIRouter, Depends, status, HTTPException
from typing import List
from sqlalchemy.orm import Session

from app.schemas.safety_circle import (
    TrustedContactCreate,
    TrustedContactUpdate,
    TrustedContactResponse,
    NotificationPreferenceUpdate,
    NotificationPreferenceResponse,
    SafetyEventCreate,
    SafetyEventResponse,
)
from app.repositories.emergency_contact_repository import EmergencyContactRepository
from app.repositories.notification_preference_repository import NotificationPreferenceRepository
from app.repositories.user_repository import UserRepository
from app.services.notification.notification_service import NotificationService
from app.core.security import get_current_firebase_uid
from app.db.session import get_db
from app.core.logging import logger

# Additive alongside /emergency/contacts (app/api/v1/emergency/router.py) - same underlying
# table (public.emergency_contacts), same ownership rules, new name/shape for the Safety
# Circle feature. The old routes are untouched so SosScreen/SafeRouteScreen/
# useEmergencyContacts keep working unmodified.
router = APIRouter(prefix="/safety-circle", tags=["Safety Circle"])


def _resolve_caller_user_id(current_uid: str) -> str:
    caller = UserRepository().get_by_firebase_uid(current_uid)
    if not caller:
        raise HTTPException(status_code=400, detail="Complete your profile before managing your Safety Circle")
    return caller["id"]


@router.get("/contacts", response_model=List[TrustedContactResponse])
async def get_safety_circle(current_uid: str = Depends(get_current_firebase_uid)):
    user_id = _resolve_caller_user_id(current_uid)
    try:
        return EmergencyContactRepository().list_by_user(user_id)
    except Exception as err:
        logger.error(f"Error fetching Safety Circle for user {user_id}: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch Safety Circle: {str(err)}")


@router.post("/contacts", response_model=TrustedContactResponse, status_code=status.HTTP_201_CREATED)
async def add_trusted_contact(payload: TrustedContactCreate, current_uid: str = Depends(get_current_firebase_uid)):
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
        return contact
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Error adding trusted contact: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to add trusted contact: {str(err)}")


@router.patch("/contacts/{contact_id}", response_model=TrustedContactResponse)
async def update_trusted_contact(
    contact_id: str, payload: TrustedContactUpdate, current_uid: str = Depends(get_current_firebase_uid)
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
        logger.error(f"Error updating trusted contact {contact_id}: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to update trusted contact: {str(err)}")


@router.delete("/contacts/{contact_id}")
async def remove_trusted_contact(contact_id: str, current_uid: str = Depends(get_current_firebase_uid)):
    user_id = _resolve_caller_user_id(current_uid)
    try:
        deleted = EmergencyContactRepository().delete(contact_id, user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Contact not found")
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Error removing trusted contact {contact_id}: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to remove trusted contact: {str(err)}")


@router.get("/preferences", response_model=List[NotificationPreferenceResponse])
async def get_notification_preferences(current_uid: str = Depends(get_current_firebase_uid)):
    user_id = _resolve_caller_user_id(current_uid)
    try:
        return NotificationPreferenceRepository().get_preferences(user_id)
    except Exception as err:
        logger.error(f"Error fetching notification preferences for user {user_id}: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch notification preferences: {str(err)}")


@router.patch("/preferences/{contact_id}/{event_type}", response_model=NotificationPreferenceResponse)
async def update_notification_preference(
    contact_id: str,
    event_type: str,
    payload: NotificationPreferenceUpdate,
    current_uid: str = Depends(get_current_firebase_uid),
):
    user_id = _resolve_caller_user_id(current_uid)
    # Ownership check: the contact must belong to the caller before their preference can be changed.
    contacts = EmergencyContactRepository().list_by_user(user_id)
    if not any(c["id"] == contact_id for c in contacts):
        raise HTTPException(status_code=403, detail="Cannot set preferences for a contact you do not own")
    try:
        return NotificationPreferenceRepository().upsert_preference(
            user_id=user_id, contact_id=contact_id, event_type=event_type, enabled=payload.enabled
        )
    except Exception as err:
        logger.error(f"Error updating notification preference for contact {contact_id}: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to update notification preference: {str(err)}")


@router.post("/events", response_model=SafetyEventResponse, status_code=status.HTTP_201_CREATED)
async def emit_safety_event(
    payload: SafetyEventCreate,
    db: Session = Depends(get_db),
    current_uid: str = Depends(get_current_firebase_uid),
):
    user_id = _resolve_caller_user_id(current_uid)
    try:
        result = NotificationService(db).dispatch_safety_event(
            user_id=user_id,
            event_type=payload.event_type,
            title=payload.event_type.replace("_", " ").title(),
            body=f"Safety event: {payload.event_type}",
            data=payload.metadata,
            incident_id=payload.incident_id,
            client_event_id=payload.client_event_id,
            severity=payload.severity or "INFO",
        )
        event_id = result.get("event_id")
        return SafetyEventResponse(
            id=event_id or "",
            client_event_id=payload.client_event_id,
            user_id=user_id,
            incident_id=payload.incident_id,
            event_type=payload.event_type,
            severity=payload.severity or "INFO",
            status="COMPLETED",
            metadata=payload.metadata,
        )
    except Exception as err:
        logger.error(f"Error emitting safety event {payload.event_type}: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to emit safety event: {str(err)}")
