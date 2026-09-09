/**
 * API client for /api/v1/safety-circle/* - additive alongside the existing
 * /emergency/contacts endpoints (still used by useEmergencyContacts.ts). Uses the same
 * raw-fetch + API_BASE_URL + getAuthHeader() pattern as the sibling /emergency/* calls in
 * this codebase (see src/hooks/useEmergencyContacts.ts), since that's the pattern proven
 * to reach this backend's /api/v1-prefixed routes correctly.
 */
import { API_BASE_URL } from "./config";
import { getAuthHeader } from "../services/firebaseConfig";
import { TrustedContact, TrustedContactInput, NotificationPreference, SafetyEventType } from "../types/safetyCircle";

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/);
  const raw = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || "").slice(0, 2);
  return (raw || "SC").toUpperCase();
}

function toTrustedContact(raw: any): TrustedContact {
  return {
    id: raw.id,
    name: raw.name,
    initials: initialsFor(raw.name || ""),
    phone: raw.phone,
    relation: raw.relationship || "OTHER",
    priority: raw.priority ?? 1,
    isActive: raw.is_active ?? true,
    notificationEnabled: raw.notification_enabled ?? true,
    liveLocationEnabled: raw.live_location_enabled ?? true,
    smsEnabled: raw.sms_enabled ?? false,
  };
}

function toNotificationPreference(raw: any): NotificationPreference {
  return {
    id: raw.id,
    contactId: raw.contact_id,
    eventType: raw.event_type,
    enabled: raw.enabled,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/safety-circle${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(await getAuthHeader()), ...(init?.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Safety Circle API ${init?.method || "GET"} ${path} failed (${response.status}): ${body}`);
  }
  return response.json();
}

export const safetyCircleApi = {
  async getSafetyCircle(): Promise<TrustedContact[]> {
    const data = await request<any[]>("/contacts");
    return data.map(toTrustedContact);
  },

  async addTrustedContact(input: TrustedContactInput): Promise<TrustedContact> {
    const data = await request<any>("/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        phone: input.phone,
        relationship: input.relation ?? "OTHER",
        priority: input.priority,
        is_active: input.isActive,
        notification_enabled: input.notificationEnabled,
        live_location_enabled: input.liveLocationEnabled,
        sms_enabled: input.smsEnabled,
      }),
    });
    return toTrustedContact(data);
  },

  async updateTrustedContact(id: string, input: Partial<TrustedContactInput>): Promise<TrustedContact> {
    const data = await request<any>(`/contacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: input.name,
        phone: input.phone,
        relationship: input.relation,
        priority: input.priority,
        is_active: input.isActive,
        notification_enabled: input.notificationEnabled,
        live_location_enabled: input.liveLocationEnabled,
        sms_enabled: input.smsEnabled,
      }),
    });
    return toTrustedContact(data);
  },

  async removeTrustedContact(id: string): Promise<void> {
    await request<void>(`/contacts/${id}`, { method: "DELETE" });
  },

  async getNotificationPreferences(): Promise<NotificationPreference[]> {
    const data = await request<any[]>("/preferences");
    return data.map(toNotificationPreference);
  },

  async updateNotificationPreference(
    contactId: string,
    eventType: SafetyEventType,
    enabled: boolean
  ): Promise<NotificationPreference> {
    const data = await request<any>(`/preferences/${contactId}/${eventType}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    return toNotificationPreference(data);
  },

  async emitSafetyEvent(
    eventType: SafetyEventType,
    metadata?: Record<string, unknown>,
    clientEventId?: string
  ): Promise<{ id: string; eventType: string; status: string }> {
    const data = await request<any>("/events", {
      method: "POST",
      body: JSON.stringify({
        event_type: eventType,
        metadata,
        client_event_id: clientEventId,
      }),
    });
    return { id: data.id, eventType: data.event_type, status: data.status };
  },
};
