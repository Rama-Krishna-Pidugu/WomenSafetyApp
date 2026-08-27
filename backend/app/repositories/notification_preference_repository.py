from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from app.db.database import get_supabase
from app.core.logging import logger

TABLE = "notification_preferences"


class NotificationPreferenceRepository:
    """Per-contact, per-event-type notification opt-outs. Stored exclusively in Supabase
    (public.notification_preferences), same pattern as emergency_contacts/devices - there
    is no local/SQLite fallback. Absence of a row for (contact_id, event_type) means
    "enabled" (see get_enabled_contacts_for_event) - contacts are opted in by default.
    """

    def _client(self):
        client = get_supabase()
        if client is None:
            raise RuntimeError(
                "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY (service_role) in .env."
            )
        return client

    def get_preferences(self, user_id: str, contact_id: Optional[str] = None) -> List[Dict[str, Any]]:
        client = self._client()
        query = client.table(TABLE).select("*").eq("user_id", user_id)
        if contact_id:
            query = query.eq("contact_id", contact_id)
        result = query.execute()
        return result.data or []

    def upsert_preference(
        self, user_id: str, contact_id: str, event_type: str, enabled: bool
    ) -> Dict[str, Any]:
        client = self._client()
        now = datetime.now(timezone.utc).isoformat()
        fields = {
            "user_id": user_id,
            "contact_id": contact_id,
            "event_type": event_type,
            "enabled": enabled,
            "updated_at": now,
        }
        # Supabase's upsert needs the unique constraint's columns named explicitly since the
        # table PK is `id`, not (contact_id, event_type).
        result = (
            client.table(TABLE)
            .upsert(fields, on_conflict="contact_id,event_type")
            .execute()
        )
        logger.info(f"Notification preference set: contact={contact_id} event={event_type} enabled={enabled}")
        return result.data[0] if result.data else fields

    def get_enabled_contacts_for_event(self, user_id: str, event_type: str, active_contacts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filters an already-fetched active-contacts list (see
        EmergencyContactRepository.get_active_contacts) down to those not explicitly opted
        out of this event_type. Takes the contact list as a parameter rather than
        re-querying emergency_contacts, since the caller (SafetyCircleService) already has it.
        """
        if not active_contacts:
            return []
        client = self._client()
        contact_ids = [c["id"] for c in active_contacts]
        result = (
            client.table(TABLE)
            .select("contact_id, enabled")
            .in_("contact_id", contact_ids)
            .eq("event_type", event_type)
            .execute()
        )
        disabled_ids = {row["contact_id"] for row in (result.data or []) if not row.get("enabled", True)}
        return [c for c in active_contacts if c["id"] not in disabled_ids]
