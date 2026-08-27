import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime
from app.db.base import Base

class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    relationship = Column(String(50), default="FRIEND")
    priority = Column(Integer, default=1)
    is_active = Column(Boolean, default=True, nullable=False)
    notification_enabled = Column(Boolean, default=True, nullable=False)
    live_location_enabled = Column(Boolean, default=True, nullable=False)
    sms_enabled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
