// Canonical Safety Circle types. The Safety Circle IS emergency_contacts on the backend
// (see backend/app/repositories/emergency_contact_repository.py) - this is the same data
// under the new API/UI name, not a separate concept. No `email` field anywhere: this app
// sends FCM push + a stubbed SMS channel only, never email.

export interface TrustedContact {
  id: string;
  name: string;
  initials: string;
  phone: string;
  relation: string;
  priority: number;
  isActive: boolean;
  notificationEnabled: boolean;
  liveLocationEnabled: boolean;
  smsEnabled: boolean;
}

export interface NotificationPreference {
  id: string;
  contactId: string;
  eventType: SafetyEventType;
  enabled: boolean;
}

export type SafetyEventType =
  | "SAFETY_MODE_STARTED"
  | "SAFETY_MODE_STOPPED"
  | "JOURNEY_STARTED"
  | "JOURNEY_COMPLETED"
  | "LIVE_LOCATION_STARTED"
  | "LIVE_LOCATION_STOPPED"
  | "ROUTE_DEVIATION"
  | "HIGH_RISK_DETECTED"
  | "THREAT_DETECTED"
  | "SOS_ACTIVATED"
  | "SOS_CANCELLED"
  | "SOS_ESCALATED"
  | "INCIDENT_CREATED"
  | "INCIDENT_RESOLVED"
  | "EVIDENCE_CAPTURED"
  | "EVIDENCE_UPLOADED";

export interface TrustedContactInput {
  name: string;
  phone: string;
  relation?: string;
  priority?: number;
  isActive?: boolean;
  notificationEnabled?: boolean;
  liveLocationEnabled?: boolean;
  smsEnabled?: boolean;
}
