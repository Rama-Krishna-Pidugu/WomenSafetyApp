/**
 * tracking.types.ts
 *
 * Module 4 — Journey Monitoring & Live Location Tracking Types
 */

export type LocationTrackingState =
  | "GPS_ACQUIRING"
  | "ACTIVE"
  | "UPDATING"
  | "WEAK_SIGNAL"
  | "UNAVAILABLE"
  | "OFFLINE"
  | "ROUTE_DEVIATION"
  | "SHARING_ACTIVE"
  | "SHARING_STOPPED"
  | "JOURNEY_COMPLETED";

export type AISafetyStatus = "NORMAL" | "ATTENTION" | "HIGH_RISK";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface JourneyMetrics {
  distanceKm: number;
  etaMinutes: number;
  progressPercent: number; // 0 - 100
  accuracyMeters: number;
  batteryLevel: number;
  lastUpdatedTimestamp: number;
  speedKmh?: number;
  headingDegrees?: number;
}

export interface LiveSharingInfo {
  isSharing: boolean;
  sessionId?: string;
  shareUrl?: string;
  durationMinutes?: number; // 15, 30, 60, or -1 for end of journey
  startedAt?: number;
  activeViewersCount: number;
  selectedContactIds: string[];
}

export interface LocationStateConfig {
  label: string;
  description: string;
  tone: "neutral" | "success" | "warning" | "emergency" | "primary";
}

export const LOCATION_STATE_META: Record<LocationTrackingState, LocationStateConfig> = {
  GPS_ACQUIRING: {
    label: "Connecting GPS...",
    description: "Finding your location with satellite fix.",
    tone: "neutral",
  },
  ACTIVE: {
    label: "Live Location Active",
    description: "You're on your planned route.",
    tone: "success",
  },
  UPDATING: {
    label: "Updating Location...",
    description: "Syncing latest coordinates with satellite feed.",
    tone: "primary",
  },
  WEAK_SIGNAL: {
    label: "GPS Signal is Weak",
    description: "We'll keep trying to update your location.",
    tone: "warning",
  },
  UNAVAILABLE: {
    label: "Location Temporarily Unavailable",
    description: "Waiting for satellite signal to re-establish.",
    tone: "warning",
  },
  OFFLINE: {
    label: "Tracking Paused (Offline)",
    description: "Reconnecting to device GPS sensors...",
    tone: "neutral",
  },
  ROUTE_DEVIATION: {
    label: "Route Deviation Detected",
    description: "You're moving away from your planned route.",
    tone: "warning",
  },
  SHARING_ACTIVE: {
    label: "Live Sharing Active",
    description: "Trusted contacts can follow your journey live.",
    tone: "primary",
  },
  SHARING_STOPPED: {
    label: "Live Sharing Stopped",
    description: "Live broadcast to contacts has ended.",
    tone: "neutral",
  },
  JOURNEY_COMPLETED: {
    label: "Journey Completed",
    description: "You have arrived safely at your destination.",
    tone: "success",
  },
};
