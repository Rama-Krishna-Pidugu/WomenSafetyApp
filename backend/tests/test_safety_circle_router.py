"""Router-level tests for /api/v1/safety-circle/*. Repository/service classes used by the
router are patched at their import site in the router module, so no real Supabase call is
ever made.
"""
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import get_current_firebase_uid

client = TestClient(app)

CALLER_UID = "firebase-uid-alice"
CALLER_USER_ID = "user-alice-id"


@pytest.fixture
def auth_alice():
    app.dependency_overrides[get_current_firebase_uid] = lambda: CALLER_UID
    yield
    app.dependency_overrides.clear()


@patch("app.api.v1.safety_circle.router.UserRepository")
@patch("app.api.v1.safety_circle.router.EmergencyContactRepository")
def test_get_safety_circle_returns_callers_contacts(mock_contact_repo, mock_user_repo, auth_alice):
    mock_user_repo.return_value.get_by_firebase_uid.return_value = {"id": CALLER_USER_ID}
    mock_contact_repo.return_value.list_by_user.return_value = [
        {
            "id": "c1", "user_id": CALLER_USER_ID, "name": "Mom", "phone": "+911234567890",
            "relationship": "FAMILY", "priority": 1, "is_active": True,
            "notification_enabled": True, "live_location_enabled": True, "sms_enabled": False,
        }
    ]

    res = client.get("/api/v1/safety-circle/contacts")

    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "Mom"
    assert "email" not in data[0]
    mock_contact_repo.return_value.list_by_user.assert_called_once_with(CALLER_USER_ID)


@patch("app.api.v1.safety_circle.router.UserRepository")
@patch("app.api.v1.safety_circle.router.EmergencyContactRepository")
def test_add_trusted_contact_passes_safety_circle_fields(mock_contact_repo, mock_user_repo, auth_alice):
    mock_user_repo.return_value.get_by_firebase_uid.return_value = {"id": CALLER_USER_ID}
    mock_contact_repo.return_value.create.return_value = {
        "id": "c2", "user_id": CALLER_USER_ID, "name": "Dad", "phone": "+919876543210",
        "relationship": "FAMILY", "priority": 2, "is_active": True,
        "notification_enabled": False, "live_location_enabled": True, "sms_enabled": True,
    }

    res = client.post(
        "/api/v1/safety-circle/contacts",
        json={
            "name": "Dad", "phone": "+919876543210", "relationship": "FAMILY",
            "notification_enabled": False, "sms_enabled": True,
        },
    )

    assert res.status_code == 201
    _, kwargs = mock_contact_repo.return_value.create.call_args
    assert kwargs["notification_enabled"] is False
    assert kwargs["sms_enabled"] is True
    assert "email" not in kwargs


@patch("app.api.v1.safety_circle.router.UserRepository")
@patch("app.api.v1.safety_circle.router.EmergencyContactRepository")
def test_update_trusted_contact_404_when_not_found(mock_contact_repo, mock_user_repo, auth_alice):
    mock_user_repo.return_value.get_by_firebase_uid.return_value = {"id": CALLER_USER_ID}
    mock_contact_repo.return_value.update.return_value = None

    res = client.patch("/api/v1/safety-circle/contacts/does-not-exist", json={"sms_enabled": True})

    assert res.status_code == 404


@patch("app.api.v1.safety_circle.router.UserRepository")
@patch("app.api.v1.safety_circle.router.EmergencyContactRepository")
def test_update_preference_rejects_contact_caller_does_not_own(mock_contact_repo, mock_user_repo, auth_alice):
    mock_user_repo.return_value.get_by_firebase_uid.return_value = {"id": CALLER_USER_ID}
    mock_contact_repo.return_value.list_by_user.return_value = [{"id": "c1"}]

    res = client.patch(
        "/api/v1/safety-circle/preferences/someone-elses-contact/SOS_ACTIVATED",
        json={"enabled": False},
    )

    assert res.status_code == 403


@patch("app.api.v1.safety_circle.router.NotificationPreferenceRepository")
@patch("app.api.v1.safety_circle.router.UserRepository")
@patch("app.api.v1.safety_circle.router.EmergencyContactRepository")
def test_update_preference_succeeds_for_owned_contact(
    mock_contact_repo, mock_user_repo, mock_pref_repo, auth_alice
):
    mock_user_repo.return_value.get_by_firebase_uid.return_value = {"id": CALLER_USER_ID}
    mock_contact_repo.return_value.list_by_user.return_value = [{"id": "c1"}]
    mock_pref_repo.return_value.upsert_preference.return_value = {
        "id": "pref-1", "user_id": CALLER_USER_ID, "contact_id": "c1",
        "event_type": "SOS_ACTIVATED", "enabled": False,
    }

    res = client.patch(
        "/api/v1/safety-circle/preferences/c1/SOS_ACTIVATED", json={"enabled": False}
    )

    assert res.status_code == 200
    assert res.json()["enabled"] is False


@patch("app.api.v1.safety_circle.router.NotificationService")
@patch("app.api.v1.safety_circle.router.UserRepository")
def test_emit_safety_event_returns_completed_event(mock_user_repo, mock_notification_service, auth_alice):
    mock_user_repo.return_value.get_by_firebase_uid.return_value = {"id": CALLER_USER_ID}
    mock_notification_service.return_value.dispatch_safety_event.return_value = {
        "event_id": "evt-99", "event_type": "SAFETY_MODE_STARTED", "push": {}, "sms_stub_recipient_count": 0,
    }

    res = client.post(
        "/api/v1/safety-circle/events",
        json={"event_type": "SAFETY_MODE_STARTED", "client_event_id": "cli-1"},
    )

    assert res.status_code == 201
    body = res.json()
    assert body["id"] == "evt-99"
    assert body["status"] == "COMPLETED"
    mock_notification_service.return_value.dispatch_safety_event.assert_called_once()
