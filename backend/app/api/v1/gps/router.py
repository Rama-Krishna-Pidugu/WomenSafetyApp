import math

from fastapi import APIRouter

from app.schemas.gps import GeofenceCheckRequest, GeofenceCheckResponse

router = APIRouter()


def calculate_haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_m = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * earth_radius_m * math.asin(math.sqrt(a))


@router.post("/geofence/check", response_model=GeofenceCheckResponse)
async def check_geofence(payload: GeofenceCheckRequest):
    dist = calculate_haversine_meters(
        payload.current_lat, payload.current_lng,
        payload.center_lat, payload.center_lng
    )
    is_inside = dist <= payload.radius_meters
    return GeofenceCheckResponse(
        is_inside=is_inside,
        distance_meters=round(dist, 1),
        zone_name="Safe Corridor Zone"
    )
