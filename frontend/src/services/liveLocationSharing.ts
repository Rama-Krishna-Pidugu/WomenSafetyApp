/**
 * liveLocationSharing.ts
 *
 * OpenStreetMap + 4.5s Throttled GPS Live Location Sharing Module.
 * Pushes location updates every 4.5 seconds via setInterval independent of OS GPS fix frequency.
 */

import * as Location from "expo-location";
import * as Battery from "expo-battery";
import { getPublicTrackingUrl } from "../utils/trackingUrl";
import { getCachedProfile } from "./profileService";
import { safetyCircleApi } from "../api/safetyCircleApi";

export interface LiveLocationData {
  sessionId: string;
  userName: string;
  lat: number;
  lng: number;
  updatedAt: number;
  batteryLevel?: number;
  active: boolean;
}

const UPDATE_INTERVAL_MS = 4500; // 4.5 seconds tick throttle
const FIREBASE_RTDB_BASE = "https://women-safety-3d446-default-rtdb.firebaseio.com";

export function trackingSessionUrl(sessionId: string): string {
  return `${FIREBASE_RTDB_BASE}/tracking_sessions/${sessionId}.json`;
}

let watchSubscription: Location.LocationSubscription | null = null;
let updateIntervalTimer: ReturnType<typeof setInterval> | null = null;
let currentCoords: { lat: number; lng: number } | null = null;

/**
 * Reads the real device battery level (0-100), or undefined if the platform/device
 * doesn't expose one (e.g. some emulators) — never a guessed number.
 */
async function readBatteryLevel(): Promise<number | undefined> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    if (level == null || level < 0) return undefined;
    return Math.round(level * 100);
  } catch {
    return undefined;
  }
}

/**
 * Starts watching GPS position and pushes location updates every 4.5 seconds.
 * Returns the shareable tracking link.
 */
export async function startLiveLocationSharing(
  sessionId: string,
  userName: string = getCachedProfile()?.full_name || "User"
): Promise<string> {
  // Clear any existing session timers
  if (updateIntervalTimer) {
    clearInterval(updateIntervalTimer);
    updateIntervalTimer = null;
  }
  if (watchSubscription) {
    watchSubscription.remove();
    watchSubscription = null;
  }

  // Request location permissions
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === "granted") {
    // Acquire immediate position fix
    const initialPos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).catch(() => null);

    if (initialPos) {
      currentCoords = {
        lat: initialPos.coords.latitude,
        lng: initialPos.coords.longitude,
      };
      await pushLocationUpdate(sessionId, userName, currentCoords, true);
    }

    // Record that live sharing started as a real, persisted, timestamped event — visible
    // in the Safety Circle's audit trail — and notify the circle. Best-effort: a failure
    // here must never block the GPS sharing itself, which is the safety-critical path.
    safetyCircleApi
      .emitSafetyEvent(
        "LIVE_LOCATION_STARTED",
        { sessionId, lat: currentCoords?.lat, lng: currentCoords?.lng },
        `${sessionId}_start`
      )
      .catch((err) => console.warn("[liveLocationSharing] Failed to record LIVE_LOCATION_STARTED:", err));

    // Subscribe to continuous GPS updates
    watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (pos) => {
        currentCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
      }
    );
  }

  // 4.5s setInterval throttle - independent of raw GPS fix frequency
  updateIntervalTimer = setInterval(() => {
    if (currentCoords) {
      void pushLocationUpdate(sessionId, userName, currentCoords, true);
    }
  }, UPDATE_INTERVAL_MS);

  return getTrackingShareLink(sessionId);
}

/**
 * Stops GPS watching and update timer, marking the session active: false.
 * Only patches the `active`/`updatedAt` fields — never overwrites lat/lng, so a session
 * with no GPS fix yet never gets a fabricated coordinate written to it.
 */
export async function stopLiveLocationSharing(sessionId: string): Promise<void> {
  if (updateIntervalTimer) {
    clearInterval(updateIntervalTimer);
    updateIntervalTimer = null;
  }
  if (watchSubscription) {
    watchSubscription.remove();
    watchSubscription = null;
  }
  currentCoords = null;

  try {
    await fetch(trackingSessionUrl(sessionId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false, updatedAt: Date.now() }),
    });
  } catch (err) {
    console.warn("[liveLocationSharing] Failed to mark session inactive:", err);
  }

  safetyCircleApi
    .emitSafetyEvent("LIVE_LOCATION_STOPPED", { sessionId }, `${sessionId}_stop`)
    .catch((err) => console.warn("[liveLocationSharing] Failed to record LIVE_LOCATION_STOPPED:", err));
}

/**
 * Returns the shareable tracking link.
 */
export function getTrackingShareLink(sessionId: string): string {
  return getPublicTrackingUrl(sessionId);
}

/**
 * Pushes location payload to Firebase Realtime Database — the single source of truth for
 * live position, read by both FamilyLiveTrackingScreen and web/track.html.
 */
export async function pushLocationUpdate(
  sessionId: string,
  userName: string,
  coords: { lat: number; lng: number },
  active: boolean
): Promise<void> {
  const batteryLevel = await readBatteryLevel();

  const payload = {
    lat: coords.lat,
    lng: coords.lng,
    updatedAt: Date.now(),
    userName: userName,
    ...(batteryLevel !== undefined ? { batteryLevel } : {}),
    active: active,
  };

  fetch(trackingSessionUrl(sessionId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => console.warn("[liveLocationSharing] Firebase RTDB sync error:", err));
}

/**
 * Fetches the current live-location snapshot for a session from Firebase RTDB.
 * Returns null on any failure or if the session has no data yet — callers must handle
 * null explicitly rather than falling back to fabricated coordinates.
 */
export async function getLiveLocation(sessionId: string): Promise<LiveLocationData | null> {
  try {
    const response = await fetch(trackingSessionUrl(sessionId));
    if (!response.ok) return null;

    const data = await response.json();
    if (!data) return null;

    return {
      sessionId,
      userName: data.userName ?? "User",
      lat: data.lat,
      lng: data.lng,
      updatedAt: data.updatedAt,
      batteryLevel: data.batteryLevel,
      active: data.active ?? false,
    };
  } catch (err) {
    console.warn("[liveLocationSharing] getLiveLocation error:", err);
    return null;
  }
}
