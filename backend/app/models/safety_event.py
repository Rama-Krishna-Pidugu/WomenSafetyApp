import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, JSON
from app.db.base import Base


class SafetyEvent(Base):
    """Canonical log of every safety event emitted by any module.
    Provides idempotency (client_event_id) and a single source of truth
    for the NotificationService to act on.
    """
    __tablename__ = "safety_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Client-supplied idempotency key (e.g. incidentId + eventType + timestamp hash)
    client_event_id = Column(String(255), unique=True, nullable=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    incident_id = Column(String(36), nullable=True, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    severity = Column(String(32), nullable=False, default="INFO")
    # PENDING → PROCESSING → COMPLETED | FAILED
    status = Column(String(32), nullable=False, default="PENDING")
    event_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
