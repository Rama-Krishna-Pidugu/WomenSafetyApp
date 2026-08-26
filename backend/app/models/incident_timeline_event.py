import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, JSON, ForeignKey
from app.db.base import Base

class IncidentTimelineEvent(Base):
    __tablename__ = "incident_timeline_events"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    incident_id = Column(String(36), ForeignKey("sos_incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    source = Column(String(64), default="SOS", nullable=False)
    severity = Column(String(32), default="INFO", nullable=False)
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    event_metadata = Column(JSON, nullable=True)
    client_timestamp = Column(DateTime, nullable=True)
    server_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
