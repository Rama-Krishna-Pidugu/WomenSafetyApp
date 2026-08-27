from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from app.db.database import get_supabase
from app.core.logging import logger

TABLE = "emergency_contacts"


class EmergencyContactRepository:
    """Emergency contacts are stored exclusively in Supabase (public.emergency_contacts),
    same pattern as devices/users - there is no local/SQLite fallback for this feature.
    Requires SUPABASE_URL and SUPABASE_KEY (service_role) to be configured.
    """

    def _client(self):
        client = get_supabase()
        if client is None:
            raise RuntimeError(
                "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY (service_role) in .env."
            )
        return client

    def list_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        client = self._client()
        result = (
            client.table(TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("priority", desc=False)
            .execute()
        )
        return result.data or []

    def create(
        self,
        user_id: str,
        name: str,
        phone: str,
        relationship: str,
        priority: Optional[int] = None,
        is_active: Optional[bool] = True,
        notification_enabled: Optional[bool] = True,
        live_location_enabled: Optional[bool] = True,
        sms_enabled: Optional[bool] = False,
    ) -> Dict[str, Any]:
        client = self._client()

        if priority is None:
            existing = client.table(TABLE).select("id").eq("user_id", user_id).execute()
            priority = len(existing.data or []) + 1

        insert_fields = {
            "user_id": user_id,
            "name": name,
            "phone": phone,
            "relationship": relationship,
            "priority": priority,
            "is_active": is_active if is_active is not None else True,
            "notification_enabled": notification_enabled if notification_enabled is not None else True,
            "live_location_enabled": live_location_enabled if live_location_enabled is not None else True,
            "sms_enabled": sms_enabled if sms_enabled is not None else False,
        }
        result = client.table(TABLE).insert(insert_fields).execute()
        logger.info(f"Emergency contact created for user_id={user_id}")
        return result.data[0] if result.data else insert_fields

    def update(
        self,
        contact_id: str,
        user_id: str,
        *,
        name: Optional[str] = None,
        phone: Optional[str] = None,
        relationship: Optional[str] = None,
        priority: Optional[int] = None,
        is_active: Optional[bool] = None,
        notification_enabled: Optional[bool] = None,
        live_location_enabled: Optional[bool] = None,
        sms_enabled: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        client = self._client()
        updates = {
            key: value
            for key, value in {
                "name": name,
                "phone": phone,
                "relationship": relationship,
                "priority": priority,
                "is_active": is_active,
                "notification_enabled": notification_enabled,
                "live_location_enabled": live_location_enabled,
                "sms_enabled": sms_enabled,
            }.items()
            if value is not None
        }
        if updates:
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        if not updates:
            existing = (
                client.table(TABLE)
                .select("*")
                .eq("id", contact_id)
                .eq("user_id", user_id)
                .execute()
            )
            return existing.data[0] if existing.data else None

        result = (
            client.table(TABLE)
            .update(updates)
            .eq("id", contact_id)
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            logger.info(f"Emergency contact updated: {contact_id}")
            return result.data[0]
        return None

    def get_active_contacts(self, user_id: str) -> List[Dict[str, Any]]:
        """Contacts eligible to be notified at all: active and notifications not muted.
        Per-event-type filtering on top of this list is handled by
        NotificationPreferenceRepository.
        """
        client = self._client()
        result = (
            client.table(TABLE)
            .select("*")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .eq("notification_enabled", True)
            .order("priority", desc=False)
            .execute()
        )
        return result.data or []

    def delete(self, contact_id: str, user_id: str) -> bool:
        client = self._client()
        # Filter by user_id too, in the same query, so a contact can only ever be
        # deleted by the user who owns it - not just anyone who knows its id.
        result = client.table(TABLE).delete().eq("id", contact_id).eq("user_id", user_id).execute()
        deleted = bool(result.data)
        if deleted:
            logger.info(f"Emergency contact deleted: {contact_id}")
        return deleted
