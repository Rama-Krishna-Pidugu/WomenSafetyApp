/**
 * Module 19 — Incident Timeline Event Contract & Types
 *
 * Central definition of incident event types and data contract across all modules
 * (Module 3 SOS, Module 4 GPS, Module 6 Audio, Module 7 Photo/Video, Module 18 AI Behavior, etc.).
 */

export type IncidentEventType =
  | "AUTHENTICATION"
  | "PROFILE_UPDATED"
  | "SAFETY_MODE_STARTED"
  | "SAFETY_MODE_STOPPED"
  | "JOURNEY_STARTED"
  | "JOURNEY_COMPLETED"
  | "ROUTE_SELECTED"
  | "ROUTE_DEVIATION"
  | "LOCATION_UPDATED"
  | "LOCATION_SIGNAL_WEAK"
  | "LOCATION_LOST"
  | "ACTIVITY_CHANGED"
  | "RUNNING_DETECTED"
  | "SUDDEN_STOP"
  | "DIRECTION_CHANGE"
  | "UNUSUAL_INACTIVITY"
  | "POSSIBLE_DEVICE_FALL"
  | "THREAT_DETECTED"
  | "RISK_LEVEL_CHANGED"
  | "HIGH_RISK_DETECTED"
  | "SOS_ACTIVATED"
  | "SOS_CANCELLED"
  | "SOS_ESCALATED"
  | "EMERGENCY_CONTACT_NOTIFIED"
  | "EMERGENCY_CONTACT_ACKNOWLEDGED"
  | "EMERGENCY_CALL_INITIATED"
  | "EMERGENCY_SMS_SENT"
  | "PUSH_NOTIFICATION_SENT"
  | "LIVE_LOCATION_STARTED"
  | "LIVE_LOCATION_STOPPED"
  | "PHOTO_CAPTURED"
  | "VIDEO_STARTED"
  | "VIDEO_STOPPED"
  | "VIDEO_UPLOADED"
  | "AUDIO_STARTED"
  | "AUDIO_STOPPED"
  | "AUDIO_UPLOADED"
  | "EVIDENCE_SAVED"
  | "EVIDENCE_UPLOADED"
  | "EVIDENCE_UPLOAD_FAILED"
  | "EMERGENCY_SERVICE_CONTACTED"
  | "INCIDENT_CREATED"
  | "INCIDENT_RESOLVED"
  | "INCIDENT_CLOSED";

export type EventSource =
  | "SOS"
  | "LOCATION"
  | "BEHAVIOR_ANALYSIS"
  | "THREAT_DETECTION"
  | "EVIDENCE"
  | "JOURNEY"
  | "EMERGENCY_CONTACT"
  | "LIVE_LOCATION"
  | "WEARABLE"
  | "CHATBOT";

export interface IncidentEventPayload {
  incident_id: string;
  event_type: IncidentEventType;
  source?: EventSource | string;
  severity?: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description?: string;
  timestamp?: string; // ISO 8601 string
  metadata?: Record<string, unknown>;
  client_event_id?: string;
}

export interface IncidentEventRecord {
  id: string;
  incident_id: string;
  event_type: IncidentEventType;
  source?: string;
  severity?: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** UI display metadata per event type */
export interface EventDisplayConfig {
  title: string;
  tone: "emergency" | "warning" | "brand" | "success" | "neutral";
  iconName: string;
}

export const EVENT_DISPLAY_CONFIG: Record<string, EventDisplayConfig> = {
  SOS_ACTIVATED: { title: "SOS Activated", tone: "emergency", iconName: "Siren" },
  SOS_CANCELLED: { title: "SOS Cancelled", tone: "neutral", iconName: "XCircle" },
  SOS_ESCALATED: { title: "SOS Escalated", tone: "emergency", iconName: "AlertTriangle" },
  INCIDENT_CREATED: { title: "Incident Created", tone: "warning", iconName: "AlertTriangle" },
  SAFETY_MODE_STARTED: { title: "Safety Mode Activated", tone: "brand", iconName: "Shield" },
  SAFETY_MODE_STOPPED: { title: "Safety Mode Deactivated", tone: "neutral", iconName: "ShieldOff" },
  JOURNEY_STARTED: { title: "Journey Started", tone: "brand", iconName: "Navigation" },
  JOURNEY_COMPLETED: { title: "Journey Completed Safely", tone: "success", iconName: "CheckCircle" },
  ROUTE_DEVIATION: { title: "Route Deviation Detected", tone: "warning", iconName: "CornerUpRight" },
  LOCATION_UPDATED: { title: "Location Updated", tone: "brand", iconName: "MapPin" },
  LOCATION_SIGNAL_WEAK: { title: "Weak GPS Signal", tone: "warning", iconName: "WifiOff" },
  LOCATION_LOST: { title: "Location Signal Lost", tone: "warning", iconName: "MapPinOff" },
  RUNNING_DETECTED: { title: "Running Pattern Detected", tone: "warning", iconName: "Activity" },
  SUDDEN_STOP: { title: "Sudden Stop Detected", tone: "warning", iconName: "PauseCircle" },
  DIRECTION_CHANGE: { title: "Sudden Direction Shift", tone: "warning", iconName: "RotateCcw" },
  UNUSUAL_INACTIVITY: { title: "Unusual Inactivity Detected", tone: "warning", iconName: "Clock" },
  POSSIBLE_DEVICE_FALL: { title: "Possible Device Fall", tone: "warning", iconName: "Smartphone" },
  THREAT_DETECTED: { title: "Threat Anomaly Detected", tone: "warning", iconName: "ShieldAlert" },
  HIGH_RISK_DETECTED: { title: "High Risk Danger Flag", tone: "emergency", iconName: "AlertOctagon" },
  AUDIO_STARTED: { title: "Audio Recording Started", tone: "brand", iconName: "Mic" },
  AUDIO_STOPPED: { title: "Audio Recording Saved", tone: "success", iconName: "MicOff" },
  AUDIO_UPLOADED: { title: "Audio Evidence Uploaded", tone: "success", iconName: "UploadCloud" },
  PHOTO_CAPTURED: { title: "Photo Evidence Captured", tone: "brand", iconName: "Camera" },
  VIDEO_STARTED: { title: "Video Recording Started", tone: "brand", iconName: "Video" },
  VIDEO_STOPPED: { title: "Video Recording Saved", tone: "success", iconName: "VideoOff" },
  VIDEO_UPLOADED: { title: "Video Evidence Uploaded", tone: "success", iconName: "UploadCloud" },
  EVIDENCE_SAVED: { title: "Evidence Saved Locally", tone: "brand", iconName: "HardDrive" },
  EVIDENCE_UPLOADED: { title: "Evidence Uploaded to Cloud", tone: "success", iconName: "UploadCloud" },
  EVIDENCE_UPLOAD_FAILED: { title: "Evidence Upload Pending", tone: "warning", iconName: "AlertCircle" },
  EMERGENCY_CONTACT_NOTIFIED: { title: "Emergency Contacts Notified", tone: "brand", iconName: "Send" },
  EMERGENCY_CONTACT_ACKNOWLEDGED: { title: "Contact Acknowledged", tone: "success", iconName: "CheckCircle" },
  EMERGENCY_CALL_INITIATED: { title: "Emergency Call Initiated", tone: "brand", iconName: "PhoneCall" },
  EMERGENCY_SMS_SENT: { title: "Emergency SMS Sent", tone: "brand", iconName: "MessageSquare" },
  PUSH_NOTIFICATION_SENT: { title: "Push Alert Broadcast", tone: "brand", iconName: "Bell" },
  LIVE_LOCATION_STARTED: { title: "Live Location Tracking Active", tone: "brand", iconName: "Radio" },
  LIVE_LOCATION_STOPPED: { title: "Live Location Ended", tone: "neutral", iconName: "Radio" },
  EMERGENCY_SERVICE_CONTACTED: { title: "Helpline Contacted", tone: "emergency", iconName: "Phone" },
  INCIDENT_RESOLVED: { title: "Incident Resolved", tone: "success", iconName: "CheckCircle2" },
  INCIDENT_CLOSED: { title: "Incident Closed", tone: "neutral", iconName: "Archive" },
};
