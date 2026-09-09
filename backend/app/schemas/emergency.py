from pydantic import BaseModel
from typing import Optional, Any, Dict

class EmergencyContactCreate(BaseModel):
    user_id: Optional[str] = None
    name: str
    phone: str
    relationship: Optional[str] = "FRIEND"
    priority: Optional[int] = 1
    is_active: Optional[bool] = True
    notification_enabled: Optional[bool] = True
    live_location_enabled: Optional[bool] = True
    sms_enabled: Optional[bool] = False

class EmergencyContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    relationship: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    notification_enabled: Optional[bool] = None
    live_location_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None

class EmergencyContactResponse(BaseModel):
    id: str
    user_id: str
    name: str
    phone: str
    relationship: Optional[str] = None
    priority: int = 1
    is_active: bool = True
    notification_enabled: bool = True
    live_location_enabled: bool = True
    sms_enabled: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class SOSIncidentCreate(BaseModel):
    user_id: str
    trigger_type: str = "BUTTON_PRESS"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None

class SOSIncidentResponse(BaseModel):
    id: str
    user_id: str
    status: str
    trigger_type: str
    danger_score: int = 0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    started_at: Optional[str] = None

# ── Incident Sync (frontend sosOrchestratorService) ──────────────────────────

class IncidentLocationData(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    timestamp: Optional[int] = None
    accurate: Optional[bool] = None

class IncidentSyncPayload(BaseModel):
    """Matches the payload shape sent by the frontend incidentSyncService."""
    clientIncidentId: str
    firebaseUid: str
    source: str                         # e.g. "BUTTON", "VOICE", "SHAKE"
    status: str                         # e.g. "active", "resolved"
    startedAt: int                      # epoch ms
    location: Optional[IncidentLocationData] = None
    step: str                           # e.g. "SOS_TRIGGERED", "LOCATION_ACQUIRED"
    stepData: Optional[Dict[str, Any]] = None
    occurredAt: int                     # epoch ms

class IncidentSyncResponse(BaseModel):
    success: bool
    data: Dict[str, Any]

class IncidentHistoryItem(BaseModel):
    id: str
    clientIncidentId: str
    source: str
    status: str
    startedAt: str
    firebaseUid: Optional[str] = None
