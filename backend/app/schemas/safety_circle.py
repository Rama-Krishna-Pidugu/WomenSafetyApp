from typing import Optional, Dict, Any
from pydantic import BaseModel

from app.schemas.emergency import (
    EmergencyContactCreate,
    EmergencyContactUpdate,
    EmergencyContactResponse,
)

# The Safety Circle IS emergency_contacts (see app/repositories/emergency_contact_repository.py) —
# these are the same shape under a name that matches the new /safety-circle API surface, not a
# duplicate table. No `email` field: this app sends FCM push + a stubbed SMS channel only.


class TrustedContactCreate(EmergencyContactCreate):
    pass


class TrustedContactUpdate(EmergencyContactUpdate):
    pass


class TrustedContactResponse(EmergencyContactResponse):
    pass


class NotificationPreferenceUpdate(BaseModel):
    enabled: bool


class NotificationPreferenceResponse(BaseModel):
    id: str
    user_id: str
    contact_id: str
    event_type: str
    enabled: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SafetyEventCreate(BaseModel):
    client_event_id: Optional[str] = None
    event_type: str
    incident_id: Optional[str] = None
    severity: Optional[str] = "INFO"
    metadata: Optional[Dict[str, Any]] = None


class SafetyEventResponse(BaseModel):
    id: str
    client_event_id: Optional[str] = None
    user_id: str
    incident_id: Optional[str] = None
    event_type: str
    severity: str = "INFO"
    status: str = "PENDING"
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
    processed_at: Optional[str] = None


class LiveLocationSessionResponse(BaseModel):
    id: str
    user_id: str
    incident_id: Optional[str] = None
    started_at: Optional[str] = None
    expires_at: Optional[str] = None
    status: str = "ACTIVE"
    share_token: str
    created_at: Optional[str] = None
