from pydantic import BaseModel, Field
from typing import Optional

class GeofenceCheckRequest(BaseModel):
    current_lat: float
    current_lng: float
    center_lat: float
    center_lng: float
    radius_meters: float = 500.0

class GeofenceCheckResponse(BaseModel):
    is_inside: bool
    distance_meters: float
    zone_name: Optional[str] = "Safe Zone"
