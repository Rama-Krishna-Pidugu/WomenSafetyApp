from typing import List, Dict, Any

from app.repositories.emergency_contact_repository import EmergencyContactRepository
from app.repositories.notification_preference_repository import NotificationPreferenceRepository
from app.repositories.user_repository import UserRepository
from app.repositories.device_repository import DeviceRepository
from app.core.logging import logger


class SafetyCircleService:
    """Resolves a user's Safety Circle (their emergency_contacts) down to the concrete
    delivery targets a notification actually needs: FCM tokens for contacts who are
    themselves registered app users with a device, and phone numbers for the (Phase 2)
    SMS fallback otherwise. Contacts are plain name/phone/relationship records - there is
    no `linked_user_id` column - so the FCM-token match is a best-effort lookup by phone
    number via UserRepository.get_by_identifier(), which already does exact + fuzzy-digit
    phone matching for this codebase's other phone-linking flows.
    """

    def __init__(self) -> None:
        self.contact_repo = EmergencyContactRepository()
        self.preference_repo = NotificationPreferenceRepository()
        self.user_repo = UserRepository()
        self.device_repo = DeviceRepository()

    def get_active_circle(self, user_id: str) -> List[Dict[str, Any]]:
        return self.contact_repo.get_active_contacts(user_id)

    def get_circle_for_event(self, user_id: str, event_type: str) -> List[Dict[str, Any]]:
        active_contacts = self.get_active_circle(user_id)
        return self.preference_repo.get_enabled_contacts_for_event(user_id, event_type, active_contacts)

    def resolve_fcm_tokens_for_event(self, user_id: str, event_type: str) -> List[str]:
        contacts = self.get_circle_for_event(user_id, event_type)
        matched_user_ids: List[str] = []
        for contact in contacts:
            phone = contact.get("phone")
            if not phone:
                continue
            matched_user = self.user_repo.get_by_identifier(phone)
            if matched_user:
                matched_user_ids.append(matched_user["id"])
            else:
                logger.info(f"Safety Circle contact {contact.get('id')} has no matching registered user; no FCM token available")

        if not matched_user_ids:
            return []
        return self.device_repo.get_tokens_by_user_ids(matched_user_ids)

    def resolve_sms_recipients_for_event(self, user_id: str, event_type: str) -> List[str]:
        """Returns phone numbers for contacts with sms_enabled=True. SMS sending itself is
        not implemented in this iteration (no provider configured) - see
        NotificationService.dispatch_safety_event, which logs these as a stub rather than
        sending. Kept separate from FCM resolution since a contact can want SMS without
        being a registered app user at all.
        """
        contacts = self.get_circle_for_event(user_id, event_type)
        return [c["phone"] for c in contacts if c.get("sms_enabled") and c.get("phone")]
