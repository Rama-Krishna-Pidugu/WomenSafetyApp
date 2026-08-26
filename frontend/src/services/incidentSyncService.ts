/**
 * Module 19: Incident Timeline & Complete Incident History
 *
 * Central persistent event history system connecting to FastAPI backend
 * (/api/v1/incidents) with offline AsyncStorage queueing & idempotency.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "../api/apiClient";
import { API_ENDPOINTS } from "../api/apiEndpoints";
import { IncidentEventType, EventSource, IncidentEventRecord } from "../data/incidentEvents";

const STORAGE_PENDING_EVENTS_KEY = "aegis_pending_timeline_events";
const STORAGE_INCIDENTS_CACHE_KEY = "aegis_incidents_cache";

export interface IncidentDto {
  id: string;
  clientIncidentId?: string;
  userId: string;
  triggerSource: string;
  status: "CREATED" | "ACTIVE" | "RESOLVED" | "CLOSED" | string;
  dangerScore: number;
  latitude?: number | null;
  longitude?: number | null;
  destinationName?: string | null;
  notes?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
}

export interface TimelineEventDto {
  id: string;
  incidentId: string;
  userId: string;
  eventType: IncidentEventType;
  source: EventSource | string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  clientTimestamp?: string;
  serverTimestamp: string;
  createdAt: string;
}

export interface PendingTimelineEvent {
  clientEventId: string;
  incidentId: string;
  eventType: IncidentEventType;
  source: string;
  severity?: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  clientTimestamp: number;
}

class IncidentSyncService {
  /**
   * Create or register an incident on the backend
   */
  async createIncident(payload: {
    clientIncidentId: string;
    triggerSource: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
    dangerScore?: number;
  }): Promise<IncidentDto | null> {
    try {
      const res = await apiClient.post<IncidentDto>(API_ENDPOINTS.INCIDENTS, payload);
      return res.data;
    } catch (err) {
      console.warn("[IncidentSyncService] Failed to create incident on server (offline mode):", err);
      return null;
    }
  }

  /**
   * Fetch all historical incidents for the current authenticated user
   */
  async fetchUserIncidents(): Promise<{ incidents: IncidentDto[]; isOffline: boolean }> {
    try {
      const res = await apiClient.get<IncidentDto[]>(API_ENDPOINTS.INCIDENTS);
      if (Array.isArray(res.data)) {
        await AsyncStorage.setItem(STORAGE_INCIDENTS_CACHE_KEY, JSON.stringify(res.data));
        return { incidents: res.data, isOffline: false };
      }
    } catch (err) {
      console.warn("[IncidentSyncService] Error fetching incidents from server, using local cache:", err);
    }

    // Fallback to local cached incidents
    try {
      const raw = await AsyncStorage.getItem(STORAGE_INCIDENTS_CACHE_KEY);
      if (raw) {
        return { incidents: JSON.parse(raw), isOffline: true };
      }
    } catch {}

    return { incidents: [], isOffline: true };
  }

  /**
   * Fetch full authoritative chronological timeline for an incident
   */
  async fetchIncidentTimeline(incidentId: string): Promise<{ events: TimelineEventDto[]; isOffline: boolean }> {
    try {
      const url = `${API_ENDPOINTS.INCIDENTS}/${incidentId}/timeline`;
      const res = await apiClient.get<TimelineEventDto[]>(url);
      if (Array.isArray(res.data)) {
        return { events: res.data, isOffline: false };
      }
    } catch (err) {
      console.warn(`[IncidentSyncService] Error fetching timeline for ${incidentId}:`, err);
    }

    // Return any locally queued events for this incident if server unreachable
    const pending = await this.getPendingEvents();
    const incidentPending = pending
      .filter((p) => p.incidentId === incidentId)
      .map((p) => ({
        id: p.clientEventId,
        incidentId: p.incidentId,
        userId: "local-user",
        eventType: p.eventType,
        source: p.source,
        severity: p.severity || "INFO",
        title: p.title,
        description: p.description,
        metadata: p.metadata,
        clientTimestamp: new Date(p.clientTimestamp).toISOString(),
        serverTimestamp: new Date(p.clientTimestamp).toISOString(),
        createdAt: new Date(p.clientTimestamp).toISOString(),
      }));

    return { events: incidentPending, isOffline: true };
  }

  /**
   * Log a new timeline event with idempotency and offline queueing
   */
  async logTimelineEvent(payload: {
    incidentId: string;
    eventType: IncidentEventType;
    source?: string;
    severity?: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
    clientEventId?: string;
  }): Promise<void> {
    const clientEventId = payload.clientEventId || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const eventBody = {
      clientEventId,
      eventType: payload.eventType,
      source: payload.source || "SOS",
      severity: payload.severity || "INFO",
      title: payload.title,
      description: payload.description,
      metadata: payload.metadata,
      clientTimestamp: new Date().toISOString(),
    };

    try {
      const url = `${API_ENDPOINTS.INCIDENTS}/${payload.incidentId}/timeline`;
      await apiClient.post(url, eventBody);
    } catch (err) {
      console.warn("[IncidentSyncService] Server unreachable, queueing timeline event for offline retry:", err);
      await this.queuePendingEvent({
        clientEventId,
        incidentId: payload.incidentId,
        eventType: payload.eventType,
        source: payload.source || "SOS",
        severity: payload.severity,
        title: payload.title,
        description: payload.description,
        metadata: payload.metadata,
        clientTimestamp: Date.now(),
      });
    }
  }

  /**
   * Offline Queue: Add event to pending storage
   */
  private async queuePendingEvent(event: PendingTimelineEvent): Promise<void> {
    try {
      const list = await this.getPendingEvents();
      list.push(event);
      await AsyncStorage.setItem(STORAGE_PENDING_EVENTS_KEY, JSON.stringify(list));
    } catch (err) {
      console.error("[IncidentSyncService] Error saving pending event:", err);
    }
  }

  /**
   * Offline Queue: Read all pending events
   */
  async getPendingEvents(): Promise<PendingTimelineEvent[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PENDING_EVENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Retry syncing pending offline events to backend
   */
  async syncPendingEvents(): Promise<number> {
    const list = await this.getPendingEvents();
    if (list.length === 0) return 0;

    const remaining: PendingTimelineEvent[] = [];
    let syncedCount = 0;

    for (const item of list) {
      try {
        const url = `${API_ENDPOINTS.INCIDENTS}/${item.incidentId}/timeline`;
        await apiClient.post(url, {
          clientEventId: item.clientEventId,
          eventType: item.eventType,
          source: item.source,
          severity: item.severity || "INFO",
          title: item.title,
          description: item.description,
          metadata: item.metadata,
          clientTimestamp: new Date(item.clientTimestamp).toISOString(),
        });
        syncedCount++;
      } catch (err) {
        remaining.push(item);
      }
    }

    await AsyncStorage.setItem(STORAGE_PENDING_EVENTS_KEY, JSON.stringify(remaining));
    return syncedCount;
  }
}

export const incidentSyncService = new IncidentSyncService();

/** Backward compatible helpers */
export async function syncIncidentEvent(payload: any): Promise<void> {
  if (payload.clientIncidentId) {
    await incidentSyncService.logTimelineEvent({
      incidentId: payload.clientIncidentId,
      eventType: (payload.step as IncidentEventType) || "LOCATION_UPDATED",
      source: payload.source || "SOS",
      title: payload.step || "Safety event",
      description: payload.stepData ? JSON.stringify(payload.stepData) : undefined,
      metadata: payload.stepData,
    });
  }
}

export async function fetchIncidentHistory(firebaseUid?: string): Promise<any[]> {
  const result = await incidentSyncService.fetchUserIncidents();
  return result.incidents.map((inc) => ({
    id: inc.id,
    clientIncidentId: inc.clientIncidentId || inc.id,
    source: inc.triggerSource,
    status: inc.status.toLowerCase(),
    startedAt: inc.startedAt || inc.createdAt,
    endedAt: inc.endedAt,
    latitude: inc.latitude,
    longitude: inc.longitude,
  }));
}
