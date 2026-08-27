from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from app.db.database import get_supabase
from app.core.logging import logger

TABLE = "safety_events"


class SafetyEventRepository:
    """Canonical safety-event log. Stored exclusively in Supabase (public.safety_events),
    same pattern as emergency_contacts/devices - there is no local/SQLite fallback.
    """

    def _client(self):
        client = get_supabase()
        if client is None:
            raise RuntimeError(
                "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY (service_role) in .env."
            )
        return client

    def create_event(
        self,
        user_id: str,
        event_type: str,
        client_event_id: Optional[str] = None,
        incident_id: Optional[str] = None,
        severity: str = "INFO",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Idempotent on client_event_id: if an event with the same client_event_id already
        exists, returns that row instead of inserting a duplicate. Caller (dispatch_safety_event)
        uses this to make sure the same SOS trigger, retried by a flaky client, only ever
        notifies the Safety Circle once.
        """
        client = self._client()

        if client_event_id:
            existing = (
                client.table(TABLE).select("*").eq("client_event_id", client_event_id).limit(1).execute()
            )
            if existing.data:
                logger.info(f"Safety event with client_event_id={client_event_id} already exists; skipping insert")
                return existing.data[0]

        insert_fields = {
            "user_id": user_id,
            "event_type": event_type,
            "client_event_id": client_event_id,
            "incident_id": incident_id,
            "severity": severity,
            "status": "PENDING",
            "metadata": metadata or {},
        }
        result = client.table(TABLE).insert(insert_fields).execute()
        logger.info(f"Safety event created: user_id={user_id} event_type={event_type}")
        return result.data[0] if result.data else insert_fields

    def get_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        client = self._client()
        result = client.table(TABLE).select("*").eq("id", event_id).limit(1).execute()
        return result.data[0] if result.data else None

    def mark_processed(self, event_id: str, status: str = "COMPLETED") -> Optional[Dict[str, Any]]:
        client = self._client()
        result = (
            client.table(TABLE)
            .update({"status": status, "processed_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", event_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def list_by_user(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        client = self._client()
        result = (
            client.table(TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
