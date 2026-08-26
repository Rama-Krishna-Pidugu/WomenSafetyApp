import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.sos_incident import SOSIncident
from app.models.incident_timeline_event import IncidentTimelineEvent
from app.models.incident_location import IncidentLocation
from app.schemas.incident import (
    IncidentCreate,
    IncidentStatusUpdate,
    TimelineEventCreate,
    IncidentLocationCreate,
)

# Global in-memory fallback store for dev/testing when DB session is not active
_memory_incidents: Dict[str, Dict[str, Any]] = {}
_memory_timeline_events: Dict[str, Dict[str, Any]] = {}
_memory_locations: Dict[str, List[Dict[str, Any]]] = {}

class IncidentRepository:
    def __init__(self, db: Optional[Session] = None):
        self.db = db

    def create_incident(self, user_id: str, data: IncidentCreate) -> Dict[str, Any]:
        incident_id = data.clientIncidentId or str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        if self.db is not None:
            try:
                # Check for existing incident with this ID (idempotency)
                existing = self.db.query(SOSIncident).filter(SOSIncident.id == incident_id).first()
                if existing:
                    if existing.user_id != user_id:
                        raise PermissionError("Incident ID belongs to another user")
                    return self._to_incident_dict(existing)

                incident = SOSIncident(
                    id=incident_id,
                    user_id=user_id,
                    trigger_type=data.triggerSource,
                    status="ACTIVE",
                    danger_score=data.dangerScore or 0,
                    latitude=data.latitude,
                    longitude=data.longitude,
                    notes=data.notes,
                    started_at=now,
                    created_at=now,
                )
                self.db.add(incident)

                # Automatically append initial INCIDENT_CREATED and SOS_ACTIVATED timeline events
                init_event = IncidentTimelineEvent(
                    id=f"evt-{incident_id}-created",
                    incident_id=incident_id,
                    user_id=user_id,
                    event_type="INCIDENT_CREATED",
                    source=data.triggerSource,
                    severity="INFO",
                    title="Incident Created",
                    description=f"Safety emergency incident initiated via {data.triggerSource}.",
                    event_metadata={"triggerSource": data.triggerSource, "latitude": data.latitude, "longitude": data.longitude},
                    client_timestamp=now,
                    server_timestamp=now,
                    created_at=now,
                )
                self.db.add(init_event)
                self.db.commit()
                self.db.refresh(incident)
                return self._to_incident_dict(incident)
            except PermissionError:
                raise
            except Exception as err:
                self.db.rollback()
                print(f"[IncidentRepo] DB error creating incident, falling back to memory: {err}")

        # In-Memory Fallback
        if incident_id in _memory_incidents:
            existing = _memory_incidents[incident_id]
            if existing["userId"] != user_id:
                raise PermissionError("Incident ID belongs to another user")
            return existing

        record = {
            "id": incident_id,
            "clientIncidentId": data.clientIncidentId,
            "userId": user_id,
            "triggerSource": data.triggerSource,
            "status": "ACTIVE",
            "dangerScore": data.dangerScore or 0,
            "latitude": data.latitude,
            "longitude": data.longitude,
            "destinationName": data.destinationName,
            "notes": data.notes,
            "startedAt": now,
            "endedAt": None,
            "createdAt": now,
        }
        _memory_incidents[incident_id] = record

        # Automatically log initial timeline event
        evt_id = f"evt-{incident_id}-created"
        _memory_timeline_events[evt_id] = {
            "id": evt_id,
            "incidentId": incident_id,
            "userId": user_id,
            "eventType": "INCIDENT_CREATED",
            "source": data.triggerSource,
            "severity": "INFO",
            "title": "Incident Created",
            "description": f"Safety emergency incident initiated via {data.triggerSource}.",
            "metadata": {"triggerSource": data.triggerSource, "latitude": data.latitude, "longitude": data.longitude},
            "clientTimestamp": now,
            "serverTimestamp": now,
            "createdAt": now,
        }

        return record

    def get_user_incidents(self, user_id: str) -> List[Dict[str, Any]]:
        if self.db is not None:
            try:
                records = (
                    self.db.query(SOSIncident)
                    .filter(SOSIncident.user_id == user_id)
                    .order_by(SOSIncident.created_at.desc())
                    .all()
                )
                return [self._to_incident_dict(r) for r in records]
            except Exception as err:
                print(f"[IncidentRepo] DB error reading incidents: {err}")

        # In-Memory Fallback
        user_list = [inc for inc in _memory_incidents.values() if inc["userId"] == user_id]
        return sorted(user_list, key=lambda x: x["createdAt"], reverse=True)

    def get_incident_by_id(self, incident_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        if self.db is not None:
            try:
                record = self.db.query(SOSIncident).filter(SOSIncident.id == incident_id).first()
                if record:
                    if record.user_id != user_id:
                        raise PermissionError("Access denied to this incident")
                    return self._to_incident_dict(record)
                return None
            except PermissionError:
                raise
            except Exception as err:
                print(f"[IncidentRepo] DB error: {err}")

        # In-Memory Fallback
        if incident_id in _memory_incidents:
            record = _memory_incidents[incident_id]
            if record["userId"] != user_id:
                raise PermissionError("Access denied to this incident")
            return record
        return None

    def update_incident_status(self, incident_id: str, user_id: str, data: IncidentStatusUpdate) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        if self.db is not None:
            try:
                record = self.db.query(SOSIncident).filter(SOSIncident.id == incident_id).first()
                if not record:
                    return None
                if record.user_id != user_id:
                    raise PermissionError("Access denied to update this incident")

                record.status = data.status
                if data.status in ["RESOLVED", "CLOSED"]:
                    record.ended_at = now
                if data.notes:
                    record.notes = (record.notes or "") + f"\n{data.notes}"

                # Append timeline event for status change
                evt_type = f"INCIDENT_{data.status}"
                evt = IncidentTimelineEvent(
                    id=f"evt-{incident_id}-{data.status.lower()}-{int(now.timestamp())}",
                    incident_id=incident_id,
                    user_id=user_id,
                    event_type=evt_type,
                    source="SOS",
                    severity="INFO" if data.status != "ACTIVE" else "CRITICAL",
                    title=f"Incident {data.status.capitalize()}",
                    description=data.notes or f"Incident marked as {data.status}.",
                    event_metadata={"newStatus": data.status},
                    client_timestamp=now,
                    server_timestamp=now,
                    created_at=now,
                )
                self.db.add(evt)
                self.db.commit()
                self.db.refresh(record)
                return self._to_incident_dict(record)
            except PermissionError:
                raise
            except Exception as err:
                self.db.rollback()
                print(f"[IncidentRepo] DB error: {err}")

        # In-Memory Fallback
        if incident_id in _memory_incidents:
            record = _memory_incidents[incident_id]
            if record["userId"] != user_id:
                raise PermissionError("Access denied to update this incident")
            record["status"] = data.status
            if data.status in ["RESOLVED", "CLOSED"]:
                record["endedAt"] = now
            if data.notes:
                record["notes"] = (record.get("notes") or "") + f"\n{data.notes}"

            evt_id = f"evt-{incident_id}-{data.status.lower()}-{int(now.timestamp())}"
            _memory_timeline_events[evt_id] = {
                "id": evt_id,
                "incidentId": incident_id,
                "userId": user_id,
                "eventType": f"INCIDENT_{data.status}",
                "source": "SOS",
                "severity": "INFO" if data.status != "ACTIVE" else "CRITICAL",
                "title": f"Incident {data.status.capitalize()}",
                "description": data.notes or f"Incident marked as {data.status}.",
                "metadata": {"newStatus": data.status},
                "clientTimestamp": now,
                "serverTimestamp": now,
                "createdAt": now,
            }
            return record
        return None

    def add_timeline_event(self, incident_id: str, user_id: str, data: TimelineEventCreate) -> Dict[str, Any]:
        event_id = data.clientEventId or str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        client_time = data.clientTimestamp or now

        # Ensure incident exists and user owns it
        incident = self.get_incident_by_id(incident_id, user_id)
        if not incident:
            # Auto-create active incident if first time syncing
            self.create_incident(
                user_id=user_id,
                data=IncidentCreate(
                    clientIncidentId=incident_id,
                    triggerSource=data.source,
                ),
            )

        if self.db is not None:
            try:
                # Idempotency check: Return existing event if already logged
                existing = self.db.query(IncidentTimelineEvent).filter(IncidentTimelineEvent.id == event_id).first()
                if existing:
                    return self._to_event_dict(existing)

                evt = IncidentTimelineEvent(
                    id=event_id,
                    incident_id=incident_id,
                    user_id=user_id,
                    event_type=data.eventType,
                    source=data.source,
                    severity=data.severity or "INFO",
                    title=data.title,
                    description=data.description,
                    event_metadata=data.metadata,
                    client_timestamp=client_time,
                    server_timestamp=now,
                    created_at=now,
                )
                self.db.add(evt)
                self.db.commit()
                self.db.refresh(evt)
                return self._to_event_dict(evt)
            except Exception as err:
                self.db.rollback()
                print(f"[IncidentRepo] DB error adding timeline event: {err}")

        # In-Memory Fallback
        if event_id in _memory_timeline_events:
            return _memory_timeline_events[event_id]

        record = {
            "id": event_id,
            "incidentId": incident_id,
            "userId": user_id,
            "eventType": data.eventType,
            "source": data.source,
            "severity": data.severity or "INFO",
            "title": data.title,
            "description": data.description,
            "metadata": data.metadata,
            "clientTimestamp": client_time,
            "serverTimestamp": now,
            "createdAt": now,
        }
        _memory_timeline_events[event_id] = record
        return record

    def get_incident_timeline(self, incident_id: str, user_id: str) -> List[Dict[str, Any]]:
        # Verify ownership
        incident = self.get_incident_by_id(incident_id, user_id)
        if not incident:
            raise LookupError("Incident not found")

        if self.db is not None:
            try:
                events = (
                    self.db.query(IncidentTimelineEvent)
                    .filter(
                        IncidentTimelineEvent.incident_id == incident_id,
                        IncidentTimelineEvent.user_id == user_id,
                    )
                    .order_by(IncidentTimelineEvent.server_timestamp.asc())
                    .all()
                )
                return [self._to_event_dict(e) for e in events]
            except Exception as err:
                print(f"[IncidentRepo] DB error reading timeline: {err}")

        # In-Memory Fallback
        events = [
            e for e in _memory_timeline_events.values()
            if e["incidentId"] == incident_id and e["userId"] == user_id
        ]
        return sorted(events, key=lambda x: x["serverTimestamp"])

    def add_location_track(self, incident_id: str, user_id: str, data: IncidentLocationCreate) -> Dict[str, Any]:
        loc_id = str(uuid.uuid4())
        loc_time = data.timestamp or datetime.now(timezone.utc)

        if self.db is not None:
            try:
                loc = IncidentLocation(
                    id=loc_id,
                    incident_id=incident_id,
                    user_id=user_id,
                    latitude=data.latitude,
                    longitude=data.longitude,
                    accuracy=data.accuracy,
                    speed=data.speed,
                    heading=data.heading,
                    timestamp=loc_time,
                )
                self.db.add(loc)
                self.db.commit()
                self.db.refresh(loc)
                return {
                    "id": loc.id,
                    "incidentId": loc.incident_id,
                    "userId": loc.user_id,
                    "latitude": loc.latitude,
                    "longitude": loc.longitude,
                    "accuracy": loc.accuracy,
                    "speed": loc.speed,
                    "heading": loc.heading,
                    "timestamp": loc.timestamp,
                }
            except Exception as err:
                self.db.rollback()
                print(f"[IncidentRepo] DB error adding location: {err}")

        # In-Memory Fallback
        record = {
            "id": loc_id,
            "incidentId": incident_id,
            "userId": user_id,
            "latitude": data.latitude,
            "longitude": data.longitude,
            "accuracy": data.accuracy,
            "speed": data.speed,
            "heading": data.heading,
            "timestamp": loc_time,
        }
        if incident_id not in _memory_locations:
            _memory_locations[incident_id] = []
        _memory_locations[incident_id].append(record)
        return record

    def get_incident_locations(self, incident_id: str, user_id: str) -> List[Dict[str, Any]]:
        # Verify ownership
        incident = self.get_incident_by_id(incident_id, user_id)
        if not incident:
            raise LookupError("Incident not found")

        if self.db is not None:
            try:
                locs = (
                    self.db.query(IncidentLocation)
                    .filter(
                        IncidentLocation.incident_id == incident_id,
                        IncidentLocation.user_id == user_id,
                    )
                    .order_by(IncidentLocation.timestamp.asc())
                    .all()
                )
                return [
                    {
                        "id": l.id,
                        "incidentId": l.incident_id,
                        "userId": l.user_id,
                        "latitude": l.latitude,
                        "longitude": l.longitude,
                        "accuracy": l.accuracy,
                        "speed": l.speed,
                        "heading": l.heading,
                        "timestamp": l.timestamp,
                    }
                    for l in locs
                ]
            except Exception as err:
                print(f"[IncidentRepo] DB error reading locations: {err}")

        return _memory_locations.get(incident_id, [])

    def _to_incident_dict(self, row: SOSIncident) -> Dict[str, Any]:
        return {
            "id": row.id,
            "clientIncidentId": row.id,
            "userId": row.user_id,
            "triggerSource": row.trigger_type,
            "status": row.status,
            "dangerScore": row.danger_score or 0,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "destinationName": None,
            "notes": row.notes,
            "startedAt": row.started_at,
            "endedAt": row.ended_at,
            "createdAt": row.created_at or row.started_at,
        }

    def _to_event_dict(self, row: IncidentTimelineEvent) -> Dict[str, Any]:
        return {
            "id": row.id,
            "incidentId": row.incident_id,
            "userId": row.user_id,
            "eventType": row.event_type,
            "source": row.source,
            "severity": row.severity,
            "title": row.title,
            "description": row.description,
            "metadata": row.event_metadata,
            "clientTimestamp": row.client_timestamp,
            "serverTimestamp": row.server_timestamp,
            "createdAt": row.created_at,
        }
