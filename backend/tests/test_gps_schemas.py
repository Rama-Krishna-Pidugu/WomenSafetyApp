import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas import gps


def test_geofence_schemas_still_present():
    assert hasattr(gps, "GeofenceCheckRequest")
    assert hasattr(gps, "GeofenceCheckResponse")


def test_orphaned_tracking_schemas_removed():
    # These described /api/v1/gps/ping and /api/v1/gps/session/* endpoints that were
    # never implemented (see docs/superpowers/specs/2026-08-23-live-location-wiring-design.md,
    # Decision 1) - the frontend now talks to Firebase RTDB directly instead.
    for name in (
        "LocationPingRequest",
        "LocationPingResponse",
        "TrackingSessionCreateRequest",
        "TrackingSessionResponse",
        "FamilyLiveTrackingData",
    ):
        assert not hasattr(gps, name), f"{name} should have been removed"
