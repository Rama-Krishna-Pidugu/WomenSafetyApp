/**
 * Module 19 — Standalone Mock Timeline Data
 *
 * Enables independent testing of Module 19 (Incident Timeline UI & rendering)
 * when offline or before other modules (Modules 3, 4, 6, 7, 18) are built.
 */

import { IncidentEventRecord } from "./incidentEvents";

export const MOCK_INCIDENT_TIMELINES: Record<string, IncidentEventRecord[]> = {
  "mock-sos-001": [
    {
      id: "evt-001",
      incident_id: "mock-sos-001",
      event_type: "SOS_ACTIVATED",
      title: "SOS Activated",
      description: "Triggered via emergency physical button press",
      metadata: { trigger_source: "BUTTON", battery_level: 82 },
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: "evt-002",
      incident_id: "mock-sos-001",
      event_type: "LOCATION_UPDATED",
      title: "GPS Location Acquired",
      description: "Accurate fix obtained (accuracy: 5m)",
      metadata: { latitude: 12.9716, longitude: 77.5946, speed: 1.2 },
      created_at: new Date(Date.now() - 1000 * 60 * 14.8).toISOString(),
    },
    {
      id: "evt-003",
      incident_id: "mock-sos-001",
      event_type: "EMERGENCY_CONTACT_NOTIFIED",
      title: "Emergency Contacts Notified",
      description: "SMS dispatched to 3 primary contacts",
      metadata: { contacts_count: 3, numbers: ["+91 98450 11234", "+91 99012 44871", "+91 98860 77210"] },
      created_at: new Date(Date.now() - 1000 * 60 * 14.5).toISOString(),
    },
    {
      id: "evt-004",
      incident_id: "mock-sos-001",
      event_type: "EMERGENCY_CALL_INITIATED",
      title: "Call Initiated",
      description: "Silent emergency call placed to primary contact",
      metadata: { recipient: "Amma (+91 98450 11234)" },
      created_at: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    },
    {
      id: "evt-005",
      incident_id: "mock-sos-001",
      event_type: "AUDIO_STARTED",
      title: "Audio Recording Started",
      description: "Background ambient sound capture initialized",
      metadata: { sample_rate: 44100 },
      created_at: new Date(Date.now() - 1000 * 60 * 13.5).toISOString(),
    },
    {
      id: "evt-006",
      incident_id: "mock-sos-001",
      event_type: "VIDEO_STARTED",
      title: "Video Recording Started",
      description: "Front & rear camera stream capture initialized",
      metadata: { resolution: "1080p", camera: "REAR" },
      created_at: new Date(Date.now() - 1000 * 60 * 13).toISOString(),
    },
    {
      id: "evt-007",
      incident_id: "mock-sos-001",
      event_type: "HIGH_RISK_DETECTED",
      title: "AI Threat Detected",
      description: "Abnormal movement & acoustic distress sound detected",
      metadata: { confidence: 88, danger_score: 75, model_version: "v2.1" },
      created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
    {
      id: "evt-008",
      incident_id: "mock-sos-001",
      event_type: "EMERGENCY_CONTACT_ACKNOWLEDGED",
      title: "Contact Acknowledged Alert",
      description: "Primary contact opened tracking link",
      metadata: { contact: "Sirisha Reddy" },
      created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      id: "evt-009",
      incident_id: "mock-sos-001",
      event_type: "INCIDENT_RESOLVED",
      title: "Incident Resolved",
      description: "User confirmed safety with PIN code",
      metadata: { resolved_by: "USER", status: "resolved" },
      created_at: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
    },
  ],
};

/** Get mock timeline for an incident ID or return default mock timeline */
export function getMockTimelineEvents(incidentId?: string): IncidentEventRecord[] {
  if (incidentId && MOCK_INCIDENT_TIMELINES[incidentId]) {
    return MOCK_INCIDENT_TIMELINES[incidentId];
  }
  return MOCK_INCIDENT_TIMELINES["mock-sos-001"];
}
