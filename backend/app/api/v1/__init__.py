from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.emergency import router as emergency_router
from app.api.v1.safety_circle import router as safety_circle_router
from app.api.v1.gps import router as gps_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.ai import router as ai_router
from app.api.v1.guardians import router as guardians_router
from app.api.v1.evidence import router as evidence_router
from app.api.v1.incidents import router as incidents_router
from app.api.v1.devices import router as devices_router
from app.api.v1.health import router as health_router
from app.api.v1.reports import router as reports_router
from app.api.v1.face.router import router as face_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(emergency_router)
api_v1_router.include_router(safety_circle_router)
api_v1_router.include_router(gps_router)
api_v1_router.include_router(notifications_router)
api_v1_router.include_router(ai_router)
api_v1_router.include_router(guardians_router)
api_v1_router.include_router(evidence_router)
api_v1_router.include_router(incidents_router)
api_v1_router.include_router(devices_router)
api_v1_router.include_router(health_router)
api_v1_router.include_router(reports_router)
api_v1_router.include_router(face_router)

__all__ = ["api_v1_router"]
