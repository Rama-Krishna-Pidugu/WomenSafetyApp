"""Repository-level unit tests for the Safety Circle feature. All Supabase access is
mocked - these tests never touch the network or a real database, since the new
columns/tables from database/schema/0007_safety_circle.sql have not necessarily been
applied to any given Supabase project yet.
"""
from unittest.mock import MagicMock, patch

from app.repositories.emergency_contact_repository import EmergencyContactRepository
from app.repositories.notification_preference_repository import NotificationPreferenceRepository
from app.repositories.safety_event_repository import SafetyEventRepository


class ChainMock:
    """Absorbs an arbitrary Supabase query-builder chain (table().select().eq()...) and
    returns a canned result from .execute(), regardless of exact chain shape/length.
    """

    def __init__(self, data):
        self._data = data

    def __getattr__(self, name):
        if name == "execute":
            return lambda: MagicMock(data=self._data)
        return lambda *args, **kwargs: self


def _client_returning(data):
    client = MagicMock()
    client.table.return_value = ChainMock(data)
    return client


@patch("app.repositories.emergency_contact_repository.get_supabase")
def test_create_persists_safety_circle_fields(mock_get_supabase):
    inserted = {}

    class RecordingChain(ChainMock):
        def insert(self, fields):
            inserted.update(fields)
            return self

    client = MagicMock()
    client.table.return_value = RecordingChain([{"id": "c1", **{
        "user_id": "u1", "name": "Mom", "phone": "+911234567890",
    }}])
    mock_get_supabase.return_value = client

    EmergencyContactRepository().create(
        user_id="u1",
        name="Mom",
        phone="+911234567890",
        relationship="FAMILY",
        priority=1,
        is_active=True,
        notification_enabled=True,
        live_location_enabled=False,
        sms_enabled=True,
    )

    assert inserted["is_active"] is True
    assert inserted["notification_enabled"] is True
    assert inserted["live_location_enabled"] is False
    assert inserted["sms_enabled"] is True
    assert "email" not in inserted


@patch("app.repositories.emergency_contact_repository.get_supabase")
def test_update_ignores_none_fields_but_stamps_updated_at(mock_get_supabase):
    captured = {}

    class RecordingChain(ChainMock):
        def update(self, fields):
            captured.update(fields)
            return self

    client = MagicMock()
    client.table.return_value = RecordingChain([{"id": "c1"}])
    mock_get_supabase.return_value = client

    EmergencyContactRepository().update("c1", "u1", sms_enabled=True)

    assert captured == {"sms_enabled": True, "updated_at": captured["updated_at"]}
    assert "name" not in captured


@patch("app.repositories.safety_event_repository.get_supabase")
def test_create_event_is_idempotent_on_client_event_id(mock_get_supabase):
    existing_event = {"id": "evt-1", "client_event_id": "dup-123", "event_type": "SOS_ACTIVATED"}

    call_count = {"n": 0}

    class LookupThenNoInsertChain(ChainMock):
        def execute(self):
            return MagicMock(data=[existing_event])

    client = MagicMock()
    client.table.return_value = LookupThenNoInsertChain(None)
    mock_get_supabase.return_value = client

    result = SafetyEventRepository().create_event(
        user_id="u1", event_type="SOS_ACTIVATED", client_event_id="dup-123"
    )

    assert result == existing_event


@patch("app.repositories.safety_event_repository.get_supabase")
def test_create_event_inserts_when_no_existing_client_event_id(mock_get_supabase):
    lookup_chain = ChainMock([])  # no existing row
    insert_chain = ChainMock([{"id": "evt-2", "event_type": "JOURNEY_STARTED"}])

    client = MagicMock()
    client.table.side_effect = [lookup_chain, insert_chain]
    mock_get_supabase.return_value = client

    result = SafetyEventRepository().create_event(
        user_id="u1", event_type="JOURNEY_STARTED", client_event_id="new-456"
    )

    assert result["id"] == "evt-2"


@patch("app.repositories.notification_preference_repository.get_supabase")
def test_get_enabled_contacts_for_event_excludes_disabled(mock_get_supabase):
    active_contacts = [
        {"id": "c1", "name": "Mom"},
        {"id": "c2", "name": "Dad"},
    ]
    client = _client_returning([{"contact_id": "c2", "enabled": False}])
    mock_get_supabase.return_value = client

    result = NotificationPreferenceRepository().get_enabled_contacts_for_event(
        "u1", "SOS_ACTIVATED", active_contacts
    )

    assert [c["id"] for c in result] == ["c1"]


@patch("app.repositories.notification_preference_repository.get_supabase")
def test_get_enabled_contacts_for_event_short_circuits_on_empty_input(mock_get_supabase):
    result = NotificationPreferenceRepository().get_enabled_contacts_for_event("u1", "SOS_ACTIVATED", [])
    assert result == []
    mock_get_supabase.assert_not_called()
