from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.services.firebase.firebase_service import FirebaseService, is_invalid_token_error
from app.repositories.notification_repository import NotificationRepository
from app.repositories.device_repository import DeviceRepository
from app.repositories.safety_event_repository import SafetyEventRepository
from app.services.safety_circle.safety_circle_service import SafetyCircleService
from app.core.logging import logger

class NotificationService:
    def __init__(self, db: Optional[Session] = None):
        self.firebase_service = FirebaseService()
        self.notification_repo = NotificationRepository(db)
        self.device_repo = DeviceRepository()
        self.safety_event_repo = SafetyEventRepository()
        self.safety_circle_service = SafetyCircleService()
        self._db = db

    def send_notification(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        notification_type: str = "SOS_ALERT",
        channel_id: str = "sos_channel",
        ttl: Optional[int] = 3600,
        priority: str = "high",
        user_id: Optional[str] = None,
        incident_id: Optional[str] = None
    ) -> Dict[str, Any]:
        data_payload = data or {}
        data_payload.setdefault("type", notification_type)

        message_id = None
        error_detail = None
        status = "SENT"

        try:
            message_id = self.firebase_service.send_fcm_message(
                token=token,
                title=title,
                body=body,
                data=data_payload,
                channel_id=channel_id,
                priority=priority,
                ttl=ttl
            )
        except Exception as e:
            status = "FAILED"
            error_detail = str(e)
            logger.error(f"Failed to dispatch notification to {token[:15]}: {e}")
            if is_invalid_token_error(e):
                self.device_repo.remove_invalid_token(token)

        log = self.notification_repo.create_log(
            title=title,
            body=body,
            notification_type=notification_type,
            user_id=user_id,
            incident_id=incident_id,
            status=status,
            message_id=message_id,
            error_detail=error_detail
        )

        return {
            "status": status,
            "message_id": message_id,
            "log_id": log.id if log else None,
            "title": title,
            "notification_type": notification_type
        }

    def send_multicast(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        notification_type: str = "SOS_ALERT",
        channel_id: str = "sos_channel",
        ttl: Optional[int] = 3600,
        priority: str = "high",
        user_id: Optional[str] = None,
        incident_id: Optional[str] = None
    ) -> Dict[str, Any]:
        if not tokens:
            return {"status": "SKIPPED", "message": "No tokens provided", "sent_count": 0}

        data_payload = data or {}
        data_payload.setdefault("type", notification_type)

        sent_ids: List[str] = []
        status = "SENT"
        error_detail = None

        try:
            result = self.firebase_service.send_multicast_message(
                tokens=tokens,
                title=title,
                body=body,
                data=data_payload,
                channel_id=channel_id,
                priority=priority,
                ttl=ttl
            )
            sent_ids = result["message_ids"]
            for invalid_token in result["invalid_tokens"]:
                self.device_repo.remove_invalid_token(invalid_token)
        except Exception as e:
            status = "FAILED"
            error_detail = str(e)

        log = self.notification_repo.create_log(
            title=title,
            body=body,
            notification_type=notification_type,
            user_id=user_id,
            incident_id=incident_id,
            status=status,
            message_id=f"multicast-{len(sent_ids)}",
            error_detail=error_detail
        )

        return {
            "status": status,
            "sent_count": len(sent_ids),
            "log_id": log.id if log else None,
            "title": title,
            "notification_type": notification_type
        }

    def send_sos_alert(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        return self.send_multicast(
            tokens=tokens,
            title=f"🚨 EMERGENCY SOS: {title}",
            body=body,
            data=data,
            notification_type="SOS_ALERT",
            channel_id="sos_channel",
            priority="high",
            ttl=86400
        )

    def send_sos_alert_to_user(
        self,
        user_id: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Looks up the user's active device tokens from the database and dispatches the SOS alert to them."""
        tokens = self.device_repo.get_active_tokens(user_id)
        if not tokens:
            logger.warning(f"No active device tokens found for user {user_id}; SOS alert not delivered via push")
        return self.send_sos_alert(tokens=tokens, title=title, body=body, data=data)

    def send_guardian_alert(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        return self.send_multicast(
            tokens=tokens,
            title=f"🛡️ GUARDIAN ALERT: {title}",
            body=body,
            data=data,
            notification_type="GUARDIAN_ALERT",
            channel_id="guardian_channel",
            priority="high",
            ttl=3600
        )

    def send_tracking_notification(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        return self.send_multicast(
            tokens=tokens,
            title=f"📍 Live Journey Update: {title}",
            body=body,
            data=data,
            notification_type="TRACKING",
            channel_id="tracking_channel",
            priority="high",
            ttl=1800
        )

    def send_ai_alert(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        return self.send_multicast(
            tokens=tokens,
            title=f"⚠️ AI Threat Warning: {title}",
            body=body,
            data=data,
            notification_type="AI_ALERT",
            channel_id="ai_alert_channel",
            priority="high",
            ttl=3600
        )

    def send_safe_arrival(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        return self.send_multicast(
            tokens=tokens,
            title=f"✅ Safe Arrival Confirmed: {title}",
            body=body,
            data=data,
            notification_type="SAFE_ARRIVAL",
            channel_id="general_channel",
            priority="high",
            ttl=3600
        )

    def send_low_battery_alert(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        return self.send_multicast(
            tokens=tokens,
            title=f"🔋 Low Battery Warning: {title}",
            body=body,
            data=data,
            notification_type="LOW_BATTERY",
            channel_id="general_channel",
            priority="high",
            ttl=1800
        )

    def send_custom_notification(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        notification_type: str = "CUSTOM",
        channel_id: str = "default_channel",
        priority: str = "high",
        ttl: Optional[int] = 3600
    ) -> Dict[str, Any]:
        return self.send_multicast(
            tokens=tokens,
            title=title,
            body=body,
            data=data,
            notification_type=notification_type,
            channel_id=channel_id,
            priority=priority,
            ttl=ttl
        )

    # ── Safety Circle dispatch ────────────────────────────────────────────────
    # Central entry point for "notify this user's trusted contacts about X". Resolves the
    # Safety Circle, respects per-event-type preferences, sends FCM to contacts who are
    # themselves registered app users, logs a stub for SMS-only contacts (no SMS provider
    # configured yet - Phase 2), and logs every recipient. Existing helpers above
    # (send_sos_alert, send_guardian_alert, etc.) are unchanged and still notify the
    # *triggering user's own devices* - they are a different concept (self-notification)
    # from this (notifying the user's trusted contacts) and are left alone.
    def dispatch_safety_event(
        self,
        user_id: str,
        event_type: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        incident_id: Optional[str] = None,
        client_event_id: Optional[str] = None,
        severity: str = "INFO",
    ) -> Dict[str, Any]:
        event = self.safety_event_repo.create_event(
            user_id=user_id,
            event_type=event_type,
            client_event_id=client_event_id,
            incident_id=incident_id,
            severity=severity,
            metadata=data,
        )
        event_id = event.get("id")

        tokens = self.safety_circle_service.resolve_fcm_tokens_for_event(user_id, event_type)
        push_result = self.send_multicast(
            tokens=tokens,
            title=title,
            body=body,
            data=data,
            notification_type=event_type,
            channel_id="safety_circle_channel",
            priority="high",
            user_id=user_id,
            incident_id=incident_id,
        )

        sms_recipients = self.safety_circle_service.resolve_sms_recipients_for_event(user_id, event_type)
        if sms_recipients:
            # Stubbed: no SMS provider configured yet (Phase 2). Logging only so the intent
            # is visible in logs/notification history rather than silently dropped.
            logger.info(
                f"[SMS STUB] {len(sms_recipients)} Safety Circle contact(s) opted into SMS for "
                f"event_type={event_type}, user_id={user_id} - no SMS provider configured, not sent."
            )

        if event_id:
            self.safety_event_repo.mark_processed(event_id)

        if incident_id:
            self._append_incident_notified_event(user_id, incident_id, event_type, push_result)

        return {
            "event_id": event_id,
            "event_type": event_type,
            "push": push_result,
            "sms_stub_recipient_count": len(sms_recipients),
        }

    def send_safety_event_to_circle(
        self,
        user_id: str,
        event_type: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        incident_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Convenience wrapper for call sites that don't need idempotency (no client_event_id)."""
        return self.dispatch_safety_event(
            user_id=user_id,
            event_type=event_type,
            title=title,
            body=body,
            data=data,
            incident_id=incident_id,
        )

    def _append_incident_notified_event(
        self, user_id: str, incident_id: str, event_type: str, push_result: Dict[str, Any]
    ) -> None:
        """Best-effort: this repo has two separate incident-id systems (the Module #19
        IncidentTimelineEvent local-DB timeline, and Supabase's sos_incidents) that are not
        currently unified, so `incident_id` may not resolve in the timeline system. Never
        let a timeline-append failure break notification dispatch.
        """
        if self._db is None:
            return
        try:
            from app.repositories.incident_repository import IncidentRepository
            from app.schemas.incident import TimelineEventCreate

            IncidentRepository(self._db).add_timeline_event(
                incident_id=incident_id,
                user_id=user_id,
                data=TimelineEventCreate(
                    eventType="EMERGENCY_CONTACT_NOTIFIED",
                    source="SAFETY_CIRCLE",
                    title="Trusted contacts notified",
                    description=f"{push_result.get('sent_count', 0)} trusted contact device(s) notified for {event_type}.",
                    metadata={"event_type": event_type, "push_result": push_result},
                ),
            )
        except Exception as err:
            logger.warning(f"Could not append EMERGENCY_CONTACT_NOTIFIED timeline event for incident {incident_id}: {err}")
