from typing import Optional, Dict, Any
from datetime import datetime, timezone

from app.db.database import get_supabase
from app.core.logging import logger

TABLE = "live_location_sessions"


class LiveLocationSessionRepository:
    """Session *metadata* registry only (start/expire/revoke, share_token) - stored in
    Supabase (public.live_location_sessions) so it's visible across devices/users, unlike
    a local SQLite table would be. The actual live position stream stays in Firebase RTDB
    (see frontend/src/services/liveLocationSharing.ts) - this table does not duplicate it.
    """

    def _client(self):
        client = get_supabase()
        if client is None:
            raise RuntimeError(
                "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY (service_role) in .env."
            )
        return client

    def create_session(
        self, user_id: str, incident_id: Optional[str] = None, expires_at: Optional[str] = None
    ) -> Dict[str, Any]:
        client = self._client()
        insert_fields = {
            "user_id": user_id,
            "incident_id": incident_id,
            "expires_at": expires_at,
            "status": "ACTIVE",
        }
        result = client.table(TABLE).insert(insert_fields).execute()
        logger.info(f"Live location session created for user_id={user_id}")
        return result.data[0] if result.data else insert_fields

    def get_by_token(self, share_token: str) -> Optional[Dict[str, Any]]:
        client = self._client()
        result = client.table(TABLE).select("*").eq("share_token", share_token).limit(1).execute()
        return result.data[0] if result.data else None

    def revoke(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        client = self._client()
        result = (
            client.table(TABLE)
            .update({"status": "REVOKED"})
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        return result.data[0] if result.data else None
