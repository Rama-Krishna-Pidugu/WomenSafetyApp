/**
 * sosOrchestratorService.ts
 *
 * Central SOS pipeline orchestrator. This is the single source of truth for
 * "what happens when SOS is triggered." All trigger sources (button, shake,
 * future: volume-button, widget) funnel through triggerSOS().
 *
 * Pipeline (in order, each step is best-effort — failures logged but don't abort):
 *   1. Acquire current GPS location (with last-known-location fallback)
 *   2. Load emergency contacts from contactStorageService
 *   3. Send silent SMS to all contacts  (via sosNativeService)
 *   4. Place silent call to primary contact (via sosNativeService)
 *   5. Show persistent "SOS Active" local notification (via expo-notifications)
 *   6. Persist incident to AsyncStorage (for History screen)
 *   7. Start live location watch → append location updates to incident log
 *
 * Exports:
 *   triggerSOS(source)      → Promise<string>  (returns incidentId)
 *   cancelSOS(incidentId)   → Promise<void>
 *   getIncidents()          → Promise<SOSIncident[]>
 *   getActiveIncidentId()   → string | null
 */

import { Platform, PermissionsAndroid } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { contactStorageService } from "./contactStorageService";
import { sendSilentSms, makeSilentCall } from "./sosNativeService";
import { auth } from "./firebaseConfig";
import { syncIncidentEvent } from "./incidentSyncService";
import { API_BASE_URL } from "../api/config";
import { getPublicTrackingUrl } from "../utils/trackingUrl";
import { startLiveLocationSharing, stopLiveLocationSharing } from "./liveLocationSharing";
import * as behaviorAnalysisService from "./behaviorAnalysisService";
import {
  startSosAudioRecording,
  stopSosAudioRecording,
  syncAudioEvidenceToCloud,
} from "./audioRecordingService";
import {
  startSosPhotoCapture,
  startSosVideoRecording,
  stopSosVideoRecording,
  syncPendingEvidenceQueue,
} from "./photoEvidenceService";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type SOSTriggerSource = "BUTTON" | "SHAKE";

export type SOSIncidentStatus = "active" | "resolved" | "cancelled";

export interface SOSLocation {
  lat: number;
  lon: number;
  timestamp: number;
  accurate: boolean;
}

export interface SOSLogEntry {
  step: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface SOSIncident {
  id: string;
  source: SOSTriggerSource;
  startTime: number;
  endTime?: number;
  status: SOSIncidentStatus;
  location: SOSLocation | null;
  contactsNotified: string[];
  timeline: SOSLogEntry[];
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const INCIDENTS_STORAGE_KEY = "@aegis_incidents_v2";
const LAST_LOCATION_KEY = "@aegis_last_known_location";
const MAX_STORED_INCIDENTS = 50;
const LIVE_LOCATION_INTERVAL_MS = 10_000; // 10 seconds
const LIVE_LOCATION_DISTANCE_M = 10;      // 10 metres

const SOS_NOTIFICATION_CHANNEL_ID = "sos-alerts";
const SOS_NOTIFICATION_ID_PREFIX = "sos-active-";

// ──────────────────────────────────────────────────────────────
// Module-level state (in-memory; re-initialised on app restart)
// ──────────────────────────────────────────────────────────────

let activeIncidentId: string | null = null;
let locationWatcher: Location.LocationSubscription | null = null;

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function generateIncidentId(): string {
  return `sos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function getCachedLocation(): Promise<SOSLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_LOCATION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SOSLocation;
  } catch {
    return null;
  }
}

async function cacheLocation(loc: SOSLocation): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(loc));
  } catch {
    // Non-critical — best effort
  }
}

/**
 * Acquires the current GPS position with a timeout fallback to the last
 * cached location. Always caches a successful fix for future fallbacks.
 */
async function acquireLocation(): Promise<SOSLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      // Attempt fast position retrieval via last known position first
      let pos: Location.LocationObject | null = null;
      if (typeof Location.getLastKnownPositionAsync === "function") {
        pos = await Location.getLastKnownPositionAsync({});
      }
      if (!pos && typeof Location.getCurrentPositionAsync === "function") {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      }

      if (pos) {
        const loc: SOSLocation = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          timestamp: pos.timestamp,
          accurate: true,
        };
        await cacheLocation(loc);
        return loc;
      }
    }
  } catch (err) {
    console.warn("[sosOrchestrator] Error acquiring GPS position:", err);
  }

  // GPS unavailable — use last known location as fallback
  const cached = await getCachedLocation();
  if (cached) return { ...cached, accurate: false };
  return null;
}

/**
 * Reads and parses the incident list from AsyncStorage.
 * Returns an empty array on any parse/read failure.
 */
async function readIncidents(): Promise<SOSIncident[]> {
  try {
    const raw = await AsyncStorage.getItem(INCIDENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIncidents(incidents: SOSIncident[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      INCIDENTS_STORAGE_KEY,
      JSON.stringify(incidents.slice(0, MAX_STORED_INCIDENTS))
    );
  } catch (err) {
    console.warn("[sosOrchestrator] Failed to persist incidents:", err);
  }
}

async function patchIncident(
  id: string,
  updater: (inc: SOSIncident) => SOSIncident
): Promise<SOSIncident | undefined> {
  const incidents = await readIncidents();
  const idx = incidents.findIndex((i) => i.id === id);
  if (idx === -1) return undefined;
  incidents[idx] = updater(incidents[idx]);
  await writeIncidents(incidents);
  return incidents[idx];
}

async function syncStepToBackend(inc: SOSIncident, step: string, data?: Record<string, unknown>): Promise<void> {
  const firebaseUid = auth.currentUser?.uid;
  if (!firebaseUid) return;

  try {
    await syncIncidentEvent({
      clientIncidentId: inc.id,
      firebaseUid,
      source: inc.source,
      status: inc.status,
      startedAt: inc.startTime,
      endedAt: inc.endTime,
      location: inc.location,
      step,
      stepData: data,
      occurredAt: Date.now(),
    });
  } catch (err) {
    console.warn(`[sosOrchestrator] Backend sync failed for step ${step}:`, err);
  }
}

async function appendLog(
  incidentId: string,
  step: string,
  data?: Record<string, unknown>
): Promise<void> {
  const updated = await patchIncident(incidentId, (inc) => ({
    ...inc,
    timeline: [
      ...inc.timeline,
      { step, timestamp: Date.now(), data },
    ],
  }));
  if (updated) {
    void syncStepToBackend(updated, step, data);
  }
}

async function ensureAndroidPermissions(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
    ];
    if (typeof Platform.Version === "number" && Platform.Version >= 33) {
      permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    await PermissionsAndroid.requestMultiple(permissions);
  } catch (err) {
    console.warn("[sosOrchestrator] Android permissions request error:", err);
  }
}

async function setupNotificationChannel(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(SOS_NOTIFICATION_CHANNEL_ID, {
      name: "SOS Alerts",
      importance: Notifications.AndroidImportance.HIGH,
      enableLights: true,
      lightColor: "#FF0000",
      enableVibrate: true,
    });
  } catch {
    // Channel creation may fail on iOS or older Android — non-critical
  }
}

async function showSOSActiveNotification(incidentId: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${SOS_NOTIFICATION_ID_PREFIX}${incidentId}`,
      content: {
        title: "🚨 SOS Activated",
        body: "Emergency alerts sent. Tap to open SOS screen. Shake to cancel.",
        data: { incidentId },
        sticky: true,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn("[sosOrchestrator] Could not show notification:", err);
  }
}

async function dismissSOSNotification(incidentId: string): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(
      `${SOS_NOTIFICATION_ID_PREFIX}${incidentId}`
    );
  } catch {
    // Non-critical
  }
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

/**
 * Returns the currently active SOS incident ID, or null if no SOS is active.
 */
export function getActiveIncidentId(): string | null {
  return activeIncidentId;
}

/**
 * Returns all stored SOS incidents from AsyncStorage, newest first.
 */
export async function getIncidents(): Promise<SOSIncident[]> {
  const incidents = await readIncidents();
  return incidents.sort((a, b) => b.startTime - a.startTime);
}

/**
 * Returns a single stored SOS incident by id, or undefined if not found.
 */
export async function getIncidentById(id: string): Promise<SOSIncident | undefined> {
  const incidents = await readIncidents();
  return incidents.find((i) => i.id === id);
}

/**
 * Main SOS trigger — runs the full emergency pipeline.
 *
 * @param source - 'BUTTON' (user pressed the SOS button) or 'SHAKE' (shake trigger)
 * @returns The incidentId (use to track / cancel this incident)
 */
export async function triggerSOS(source: SOSTriggerSource): Promise<string> {
  // Module 18: fresh incident, fresh behavior-analysis buffer.
  behaviorAnalysisService.reset();

  // Ensure native Android runtime permissions (SEND_SMS, CALL_PHONE, POST_NOTIFICATIONS)
  await ensureAndroidPermissions();

  const incidentId = generateIncidentId();
  activeIncidentId = incidentId;

  // ── Step 1: Create incident record immediately ──────────────
  const incident: SOSIncident = {
    id: incidentId,
    source,
    startTime: Date.now(),
    status: "active",
    location: null,
    contactsNotified: [],
    timeline: [
      { step: "SOS_TRIGGERED", timestamp: Date.now(), data: { source } },
    ],
  };

  const incidents = await readIncidents();
  incidents.unshift(incident);
  await writeIncidents(incidents);
  void syncStepToBackend(incident, "SOS_TRIGGERED", { source });

  // ── Step 2: Get location (with fallback) ────────────────────
  const location = await acquireLocation();
  await patchIncident(incidentId, (inc) => ({ ...inc, location }));
  if (location) {
    await appendLog(incidentId, "LOCATION_ACQUIRED", {
      lat: location.lat,
      lon: location.lon,
      accurate: location.accurate,
    });
  }

  // ── Step 3: Load emergency contacts ────────────────────────
  const contacts = await contactStorageService.getStoredEmergencyContacts();
  const phones = contacts
    .map((c) => (c.phone ?? "").replace(/\s+/g, ""))
    .filter(Boolean);

  // ── Step 4: Build SOS message with live location links ─────
  const mapsLink = location
    ? `https://maps.google.com/?q=${location.lat},${location.lon}`
    : "Location acquiring...";
  const trackingLink = getPublicTrackingUrl(incidentId);
  const timeStr = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  
  const message =
    `🚨 SOS EMERGENCY ALERT from Aegis Safety App\n` +
    `I need immediate help! (${timeStr})\n` +
    `Live Map: ${mapsLink}\n` +
    `Live Stream: ${trackingLink}\n` +
    `Coords: ${location ? `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}` : "Acquiring..."}\n` +
    `Please call me or dispatch emergency services immediately.`;

  // ── Step 5: Send silent SMS to all contacts ─────────────────
  if (phones.length > 0) {
    const smsSent = await sendSilentSms(phones, message);
    await appendLog(incidentId, "SMS_SENT", {
      numbers: phones,
      success: smsSent,
      message,
    });
    await patchIncident(incidentId, (inc) => ({
      ...inc,
      contactsNotified: phones,
    }));
  } else {
    await appendLog(incidentId, "SMS_SKIPPED", { reason: "No contacts configured" });
  }

  // ── Step 6: Call primary contact silently ───────────────────
  if (phones.length > 0) {
    // Short delay so SMS is dispatched before we lock the phone in a call
    await new Promise((r) => setTimeout(r, 800));
    const callPlaced = await makeSilentCall(phones[0]);
    await appendLog(incidentId, "CALL_PLACED", {
      number: phones[0],
      success: callPlaced,
    });
  }

  // ── Step 7: Show persistent notification ───────────────────
  await setupNotificationChannel();
  await showSOSActiveNotification(incidentId);

  // ── Step 7.5: Module 6 & 7 Automatic Audio, Photo & Video Evidence ───
  try {
    const audioUri = await startSosAudioRecording(incidentId);
    if (audioUri) {
      await appendLog(incidentId, "AUDIO_STARTED", {
        uri: audioUri,
        startedAt: Date.now(),
      });
    }
  } catch (audioErr) {
    console.warn("[sosOrchestrator] Audio recording init error:", audioErr);
  }

  try {
    const photos = await startSosPhotoCapture(incidentId);
    if (photos.length > 0) {
      await appendLog(incidentId, "PHOTO_CAPTURED", {
        count: photos.length,
        fileName: photos[0]?.fileName,
        frontSha256: photos[0]?.sha256,
        backSha256: photos[1]?.sha256,
        uploadStatus: "PENDING_UPLOAD",
        capturedAt: Date.now(),
      });
    }
  } catch (photoErr) {
    console.warn("[sosOrchestrator] Photo evidence capture error:", photoErr);
  }

  try {
    const videoUri = await startSosVideoRecording(incidentId);
    if (videoUri) {
      await appendLog(incidentId, "VIDEO_STARTED", {
        uri: videoUri,
        uploadStatus: "PENDING_UPLOAD",
        startedAt: Date.now(),
      });
    }
  } catch (videoErr) {
    console.warn("[sosOrchestrator] Video recording start error:", videoErr);
  }

  // ── Step 8: Start 4.5s live location watch & live SMS updates ───
  let lastSmsTimestamp = Date.now();
  void startLiveLocationSharing(incidentId);

  try {
    locationWatcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: LIVE_LOCATION_INTERVAL_MS,
        distanceInterval: LIVE_LOCATION_DISTANCE_M,
      },
      async (pos) => {
        const loc: SOSLocation = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          timestamp: pos.timestamp,
          accurate: true,
        };
        await cacheLocation(loc);
        await patchIncident(incidentId, (inc) => ({ ...inc, location: loc }));
        await appendLog(incidentId, "LOCATION_UPDATE", {
          lat: loc.lat,
          lon: loc.lon,
        });

        // Send silent SMS live location updates every ~30 seconds while SOS is ON
        const now = Date.now();
        if (phones.length > 0 && now - lastSmsTimestamp >= 30_000) {
          lastSmsTimestamp = now;
          const liveTime = new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const liveMsg =
            `🚨 SOS LIVE LOCATION UPDATE (${liveTime})\n` +
            `Current Position: https://maps.google.com/?q=${loc.lat},${loc.lon}\n` +
            `Live Stream: ${trackingLink}`;
          
          await sendSilentSms(phones, liveMsg);
          await appendLog(incidentId, "LIVE_LOCATION_SMS_SENT", {
            lat: loc.lat,
            lon: loc.lon,
          });
        }

        // Module 18: AI Behavior Analysis — best-effort, never blocks the location watcher
        behaviorAnalysisService
          .evaluate({ lat: loc.lat, lon: loc.lon, timestampMs: loc.timestamp })
          .then((alert) => {
            if (!alert) return;
            return appendLog(incidentId, alert.eventType, { detail: alert.detail });
          })
          .catch(() => {
            // Best-effort — a failed behavior check must never affect the SOS pipeline.
          });
      }
    );
    await appendLog(incidentId, "LIVE_TRACKING_STARTED", {});
  } catch (err) {
    await appendLog(incidentId, "LIVE_TRACKING_FAILED", {
      reason: String(err),
    });
  }

  return incidentId;
}

/**
 * Cancels an active SOS incident:
 *   - Stops the live location watcher
 *   - Dismisses the SOS notification
 *   - Marks the incident as resolved in AsyncStorage
 *   - Clears the active incident ID
 *
 * @param incidentId - The ID returned by triggerSOS()
 * @param status     - 'resolved' (user confirmed safe) or 'cancelled' (accidental)
 */
export async function cancelSOS(
  incidentId: string,
  status: "resolved" | "cancelled" = "resolved"
): Promise<void> {
  // Stop 4.5s live location sharing stream
  void stopLiveLocationSharing(incidentId);
  // Module 18: incident is ending, clear the behavior-analysis buffer.
  behaviorAnalysisService.reset();

  // Module 6 & 7: Stop audio/video recording & sync to cloud evidence
  try {
    const audioResult = await stopSosAudioRecording();
    if (audioResult) {
      await appendLog(incidentId, "AUDIO_STOPPED", {
        durationSeconds: audioResult.durationSeconds,
        sizeBytes: audioResult.sizeBytes,
        tamperSeal: audioResult.tamperSeal,
      });
      // Best-effort background upload
      void syncAudioEvidenceToCloud(audioResult, incidentId);
    }
  } catch (audioErr) {
    console.warn("[sosOrchestrator] Audio recording stop error:", audioErr);
  }

  try {
    const videoResult = await stopSosVideoRecording();
    if (videoResult) {
      await appendLog(incidentId, "VIDEO_STOPPED", {
        durationSeconds: videoResult.durationSeconds,
        sizeBytes: videoResult.sizeBytes,
        sha256: videoResult.sha256,
        uploadStatus: "PENDING_UPLOAD",
      });
    }
  } catch (videoErr) {
    console.warn("[sosOrchestrator] Video recording stop error:", videoErr);
  }

  // Trigger eventual sync of pending local evidence
  void syncPendingEvidenceQueue();

  // Stop live location tracking
  if (locationWatcher) {
    locationWatcher.remove();
    locationWatcher = null;
  }

  // Clear active incident
  if (activeIncidentId === incidentId) {
    activeIncidentId = null;
  }

  // Dismiss notification
  await dismissSOSNotification(incidentId);

  // Mark incident as ended in storage
  await patchIncident(incidentId, (inc) => ({
    ...inc,
    status,
    endTime: Date.now(),
  }));
  await appendLog(incidentId, "SOS_ENDED", { status });
}
