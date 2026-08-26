from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict

class IncidentCreate(BaseModel):
    clientIncidentId: Optional[str] = Field(None, description="Client-generated unique incident ID")
    triggerSource: str = Field("MANUAL_BUTTON", description="Source: MANUAL_BUTTON, SHAKE, VOICE, WEARABLE, AUTOMATIC_THREAT_DETECTION")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    destinationName: Optional[str] = None
    notes: Optional[str] = None
    dangerScore: Optional[int] = Field(0, ge=0, le=100)

class IncidentStatusUpdate(BaseModel):
    status: str = Field(..., description="Status: CREATED, ACTIVE, RESOLVED, CLOSED")
    notes: Optional[str] = None

class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    clientIncidentId: Optional[str] = None
    userId: str
    triggerSource: str
    status: str
    dangerScore: int = 0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    destinationName: Optional[str] = None
    notes: Optional[str] = None
    startedAt: Optional[datetime] = None
    endedAt: Optional[datetime] = None
    createdAt: datetime

class TimelineEventCreate(BaseModel):
    clientEventId: Optional[str] = Field(None, description="Client idempotency key to prevent duplicate entries")
    eventType: str = Field(..., description="E.g. SOS_ACTIVATED, LOCATION_UPDATED, PHOTO_CAPTURED, etc.")
    source: str = Field("SOS", description="Module: SOS, LOCATION, BEHAVIOR_ANALYSIS, THREAT_DETECTION, EVIDENCE, JOURNEY, WEARABLE, etc.")
    severity: str = Field("INFO", description="INFO, LOW, MEDIUM, HIGH, CRITICAL")
    title: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    clientTimestamp: Optional[datetime] = None

class TimelineEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incidentId: str
    userId: str
    eventType: str
    source: str
    severity: str
    title: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    clientTimestamp: Optional[datetime] = None
    serverTimestamp: datetime
    createdAt: datetime

class IncidentLocationCreate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    timestamp: Optional[datetime] = None

class IncidentLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incidentId: str
    userId: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    timestamp: datetime
