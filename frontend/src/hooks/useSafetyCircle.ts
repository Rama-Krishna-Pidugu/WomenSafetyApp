import { useState, useEffect, useCallback } from "react";
import { safetyCircleApi } from "../api/safetyCircleApi";
import { contactStorageService } from "../services/contactStorageService";
import { TrustedContact, TrustedContactInput, NotificationPreference, SafetyEventType } from "../types/safetyCircle";

function withDefaults(contact: Partial<TrustedContact> & { id: string; name: string; phone: string }): TrustedContact {
  return {
    id: contact.id,
    name: contact.name,
    initials: contact.initials || contact.name.slice(0, 2).toUpperCase(),
    phone: contact.phone,
    relation: contact.relation || "OTHER",
    priority: contact.priority ?? 1,
    isActive: contact.isActive ?? true,
    notificationEnabled: contact.notificationEnabled ?? true,
    liveLocationEnabled: contact.liveLocationEnabled ?? true,
    smsEnabled: contact.smsEnabled ?? false,
  };
}

/**
 * Backend-first Safety Circle hook: fetches from /api/v1/safety-circle on mount, caches the
 * result in AsyncStorage (via contactStorageService - the offline cache, not the source of
 * truth), and falls back to that cache when the network call fails. This is a separate hook
 * from useEmergencyContacts (src/hooks/useEmergencyContacts.ts), which is left as-is: it also
 * handles native device-contact-picker permissions and a 5-contact UI limit across several
 * existing screens, and folding it into this hook was judged too high-risk for this change
 * (six call sites, no existing test coverage for most of them) - see the parent report for
 * the "corrections vs. the plan" note. Both hooks read/write the same emergency_contacts
 * table (through different endpoints) and the same AsyncStorage cache key.
 */
export function useSafetyCircle() {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromCache = useCallback(async () => {
    const cached = (await contactStorageService.getStoredEmergencyContacts()) as unknown as TrustedContact[];
    if (cached && cached.length > 0) {
      setContacts(cached.map((c) => withDefaults(c)));
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await safetyCircleApi.getSafetyCircle();
      setContacts(fetched);
      await contactStorageService.saveEmergencyContacts(fetched as unknown as any[]);
    } catch (err) {
      console.warn("[useSafetyCircle] Failed to fetch Safety Circle from backend, using cache:", err);
      setError("Couldn't reach the server - showing your last saved Safety Circle.");
      await loadFromCache();
    } finally {
      setLoading(false);
    }
  }, [loadFromCache]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (input: TrustedContactInput): Promise<boolean> => {
    try {
      const created = await safetyCircleApi.addTrustedContact(input);
      setContacts((prev) => {
        const updated = [...prev, created];
        void contactStorageService.saveEmergencyContacts(updated as unknown as any[]);
        return updated;
      });
      return true;
    } catch (err) {
      console.warn("[useSafetyCircle] Failed to add trusted contact:", err);
      setError("Couldn't save this contact online.");
      return false;
    }
  }, []);

  const update = useCallback(async (id: string, input: Partial<TrustedContactInput>): Promise<boolean> => {
    try {
      const updated = await safetyCircleApi.updateTrustedContact(id, input);
      setContacts((prev) => {
        const next = prev.map((c) => (c.id === id ? updated : c));
        void contactStorageService.saveEmergencyContacts(next as unknown as any[]);
        return next;
      });
      return true;
    } catch (err) {
      console.warn("[useSafetyCircle] Failed to update trusted contact:", err);
      setError("Couldn't update this contact online.");
      return false;
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      await safetyCircleApi.removeTrustedContact(id);
      setContacts((prev) => {
        const next = prev.filter((c) => c.id !== id);
        void contactStorageService.saveEmergencyContacts(next as unknown as any[]);
        return next;
      });
      return true;
    } catch (err) {
      console.warn("[useSafetyCircle] Failed to remove trusted contact:", err);
      setError("Couldn't remove this contact online.");
      return false;
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const fetched = await safetyCircleApi.getNotificationPreferences();
      setPreferences(fetched);
    } catch (err) {
      console.warn("[useSafetyCircle] Failed to load notification preferences:", err);
    }
  }, []);

  const updatePreference = useCallback(
    async (contactId: string, eventType: SafetyEventType, enabled: boolean): Promise<boolean> => {
      try {
        const updated = await safetyCircleApi.updateNotificationPreference(contactId, eventType, enabled);
        setPreferences((prev) => {
          const exists = prev.some((p) => p.contactId === contactId && p.eventType === eventType);
          return exists
            ? prev.map((p) => (p.contactId === contactId && p.eventType === eventType ? updated : p))
            : [...prev, updated];
        });
        return true;
      } catch (err) {
        console.warn("[useSafetyCircle] Failed to update notification preference:", err);
        setError("Couldn't update this notification preference.");
        return false;
      }
    },
    []
  );

  return {
    contacts,
    preferences,
    loading,
    error,
    refresh,
    add,
    update,
    remove,
    loadPreferences,
    updatePreference,
    isMaxReached: contacts.length >= 5,
  };
}
