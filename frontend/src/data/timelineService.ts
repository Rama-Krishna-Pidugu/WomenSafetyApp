/**
 * Module 19 — Incident Timeline Service
 *
 * Primary source: FastAPI Backend (`/api/v1/incidents/{incidentId}/timeline`)
 * with offline queueing via IncidentSyncService, with fallback to local/mock data.
 */

import { incidentSyncService } from "../services/incidentSyncService";
import { IncidentEventPayload, IncidentEventRecord } from "./incidentEvents";
import { getMockTimelineEvents } from "./mockTimeline";

export async function fetchIncidentTimeline(incidentId: string): Promise<IncidentEventRecord[]> {
  try {
    // 1. Query FastAPI Backend Module 19 Incident Timeline
    const result = await incidentSyncService.fetchIncidentTimeline(incidentId);
    if (result.events && result.events.length > 0) {
      return result.events.map((e) => ({
        id: e.id,
        incident_id: e.incidentId,
        event_type: e.eventType,
        source: e.source,
        severity: e.severity,
        title: e.title || e.eventType,
        description: e.description || null,
        metadata: e.metadata || {},
        created_at: e.serverTimestamp || e.createdAt,
      }));
    }
  } catch (err) {
    console.warn("[timelineService] Backend query failed, falling back:", err);
  }

  // 2. Fallback to mock data for dev mode
  return getMockTimelineEvents(incidentId);
}

/**
 * Log a new timeline event (integration point for SOS, GPS, Audio, Video, AI Behavior, Wearables).
 * Fire-and-forget; never throws so caller modules are never blocked.
 */
export async function logIncidentEvent(payload: IncidentEventPayload): Promise<void> {
  try {
    await incidentSyncService.logTimelineEvent({
      incidentId: payload.incident_id,
      eventType: payload.event_type,
      source: payload.source,
      severity: payload.severity,
      title: payload.title,
      description: payload.description,
      metadata: payload.metadata,
      clientEventId: payload.client_event_id,
    });
  } catch (err) {
    console.warn("[timelineService] Best-effort timeline event log failed:", err);
  }
}
