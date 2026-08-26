import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_firebase_uid
from app.db.base import Base
from app.db.session import engine

# Ensure all database tables exist
Base.metadata.create_all(bind=engine)

client = TestClient(app)

USER_ALICE = "user-alice-123"
USER_BOB = "user-bob-456"

@pytest.fixture
def auth_alice():
    app.dependency_overrides[get_current_firebase_uid] = lambda: USER_ALICE
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def auth_bob():
    app.dependency_overrides[get_current_firebase_uid] = lambda: USER_BOB
    yield
    app.dependency_overrides.clear()

def test_create_and_retrieve_incident(auth_alice):
    inc_id = f"inc-alice-{uuid.uuid4().hex[:8]}"
    payload = {
        "clientIncidentId": inc_id,
        "triggerSource": "WEARABLE",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "dangerScore": 85,
        "notes": "Emergency triggered via smart band double-tap"
    }

    # 1. Create incident
    res = client.post("/api/v1/incidents", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["id"] == inc_id
    assert data["userId"] == USER_ALICE
    assert data["triggerSource"] == "WEARABLE"
    assert data["status"] == "ACTIVE"

    # 2. Get user's incidents list
    list_res = client.get("/api/v1/incidents")
    assert list_res.status_code == 200
    incidents = list_res.json()
    assert any(i["id"] == inc_id for i in incidents)

def test_cross_user_access_prevention(auth_alice, auth_bob):
    inc_id = f"inc-alice-secret-{uuid.uuid4().hex[:8]}"

    # Alice creates an incident
    app.dependency_overrides[get_current_firebase_uid] = lambda: USER_ALICE
    client.post("/api/v1/incidents", json={
        "clientIncidentId": inc_id,
        "triggerSource": "MANUAL_BUTTON"
    })

    # Bob tries to access Alice's incident -> Expect 403 Forbidden
    app.dependency_overrides[get_current_firebase_uid] = lambda: USER_BOB
    res = client.get(f"/api/v1/incidents/{inc_id}")
    assert res.status_code == 403

    # Bob tries to get timeline of Alice's incident -> Expect 403 Forbidden
    res_tl = client.get(f"/api/v1/incidents/{inc_id}/timeline")
    assert res_tl.status_code == 403

def test_timeline_events_and_idempotency(auth_alice):
    inc_id = f"inc-alice-tl-{uuid.uuid4().hex[:8]}"
    client.post("/api/v1/incidents", json={
        "clientIncidentId": inc_id,
        "triggerSource": "VOICE"
    })

    # 1. Log photo captured event
    event_payload = {
        "clientEventId": f"evt-photo-{uuid.uuid4().hex[:8]}",
        "eventType": "PHOTO_CAPTURED",
        "source": "EVIDENCE",
        "severity": "MEDIUM",
        "title": "Photo evidence captured",
        "description": "2 surroundings photos captured",
        "metadata": {"sha256": "mock-hash-123", "count": 2}
    }
    res1 = client.post(f"/api/v1/incidents/{inc_id}/timeline", json=event_payload)
    assert res1.status_code == 201
    assert res1.json()["id"] == event_payload["clientEventId"]
    assert res1.json()["eventType"] == "PHOTO_CAPTURED"

    # 2. Idempotency test: duplicate submission with same clientEventId
    res2 = client.post(f"/api/v1/incidents/{inc_id}/timeline", json=event_payload)
    assert res2.status_code == 201
    assert res2.json()["id"] == event_payload["clientEventId"]

    # 3. Log behavior threat event
    threat_payload = {
        "clientEventId": f"evt-threat-{uuid.uuid4().hex[:8]}",
        "eventType": "HIGH_RISK_DETECTED",
        "source": "BEHAVIOR_ANALYSIS",
        "severity": "HIGH",
        "title": "High Risk Movement Detected",
        "metadata": {"riskScore": 82, "reasons": ["SUDDEN_STOP", "RUNNING_DETECTED"]}
    }
    client.post(f"/api/v1/incidents/{inc_id}/timeline", json=threat_payload)

    # 4. Fetch complete timeline and verify chronological ordering
    tl_res = client.get(f"/api/v1/incidents/{inc_id}/timeline")
    assert tl_res.status_code == 200
    events = tl_res.json()
    assert len(events) >= 3  # INCIDENT_CREATED, PHOTO_CAPTURED, HIGH_RISK_DETECTED
    event_types = [e["eventType"] for e in events]
    assert "INCIDENT_CREATED" in event_types
    assert "PHOTO_CAPTURED" in event_types
    assert "HIGH_RISK_DETECTED" in event_types

def test_incident_lifecycle_resolution(auth_alice):
    inc_id = f"inc-lifecycle-{uuid.uuid4().hex[:8]}"
    client.post("/api/v1/incidents", json={
        "clientIncidentId": inc_id,
        "triggerSource": "SHAKE"
    })

    # Update status to RESOLVED
    update_res = client.patch(f"/api/v1/incidents/{inc_id}/status", json={
        "status": "RESOLVED",
        "notes": "User safely reached destination."
    })
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "RESOLVED"
    assert update_res.json()["endedAt"] is not None

def test_incident_location_tracking(auth_alice):
    inc_id = f"inc-loc-{uuid.uuid4().hex[:8]}"
    client.post("/api/v1/incidents", json={"clientIncidentId": inc_id})

    # Add GPS breadcrumbs
    loc1 = client.post(f"/api/v1/incidents/{inc_id}/locations", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "speed": 1.4,
        "heading": 90.0
    })
    assert loc1.status_code == 201

    loc2 = client.post(f"/api/v1/incidents/{inc_id}/locations", json={
        "latitude": 12.9720,
        "longitude": 77.5950,
        "speed": 2.1,
        "heading": 92.0
    })
    assert loc2.status_code == 201

    # Fetch locations
    loc_res = client.get(f"/api/v1/incidents/{inc_id}/locations")
    assert loc_res.status_code == 200
    points = loc_res.json()
    assert len(points) == 2
    assert points[0]["latitude"] == 12.9716
    assert points[1]["latitude"] == 12.9720
