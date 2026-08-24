/**
 * liveLocationSharing.ts
 *
 * OpenStreetMap + 4.5s Throttled GPS Live Location Sharing Module.
 * Pushes location updates every 4.5 seconds via setInterval independent of OS GPS fix frequency.
 */

import * as Location from "expo-location";
import { getPublicTrackingUrl } from "../utils/trackingUrl";

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
 * Starts watching GPS position and pushes location updates every 4.5 seconds.
 * Returns the shareable tracking link.
 */
export async function startLiveLocationSharing(
  sessionId: string,
  userName: string = "Priya Sharma"
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

  // Push final inactive status
  if (currentCoords) {
    await pushLocationUpdate(sessionId, "User", currentCoords, false);
  } else {
    await pushLocationUpdate(sessionId, "User", { lat: 12.9716, lng: 77.5946 }, false);
  }
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
  const payload = {
    lat: coords.lat,
    lng: coords.lng,
    updatedAt: Date.now(),
    userName: userName,
    batteryLevel: 88,
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
