"""Unit tests for SafetyCircleService - all sub-repositories are mocked."""
from unittest.mock import MagicMock, patch

from app.services.safety_circle.safety_circle_service import SafetyCircleService


def _service_with_mocks():
    service = SafetyCircleService()
    service.contact_repo = MagicMock()
    service.preference_repo = MagicMock()
    service.user_repo = MagicMock()
    service.device_repo = MagicMock()
    return service


def test_resolve_fcm_tokens_matches_registered_user():
    service = _service_with_mocks()
    contact = {"id": "c1", "phone": "+911234567890"}
    service.contact_repo.get_active_contacts.return_value = [contact]
    service.preference_repo.get_enabled_contacts_for_event.return_value = [contact]
    service.user_repo.get_by_identifier.return_value = {"id": "matched-user-id"}
    service.device_repo.get_tokens_by_user_ids.return_value = ["token-abc"]

    tokens = service.resolve_fcm_tokens_for_event("u1", "SOS_ACTIVATED")

    assert tokens == ["token-abc"]
    service.device_repo.get_tokens_by_user_ids.assert_called_once_with(["matched-user-id"])


def test_resolve_fcm_tokens_skips_contact_with_no_registered_user():
    service = _service_with_mocks()
    contact = {"id": "c1", "phone": "+919999999999"}
    service.contact_repo.get_active_contacts.return_value = [contact]
    service.preference_repo.get_enabled_contacts_for_event.return_value = [contact]
    service.user_repo.get_by_identifier.return_value = None

    tokens = service.resolve_fcm_tokens_for_event("u1", "SOS_ACTIVATED")

    assert tokens == []
    service.device_repo.get_tokens_by_user_ids.assert_not_called()


def test_resolve_sms_recipients_returns_only_sms_enabled_contacts():
    service = _service_with_mocks()
    contacts = [
        {"id": "c1", "phone": "+911111111111", "sms_enabled": True},
        {"id": "c2", "phone": "+912222222222", "sms_enabled": False},
    ]
    service.contact_repo.get_active_contacts.return_value = contacts
    service.preference_repo.get_enabled_contacts_for_event.return_value = contacts

    recipients = service.resolve_sms_recipients_for_event("u1", "SOS_ACTIVATED")

    assert recipients == ["+911111111111"]
