/**
 * behavior.types.ts
 *
 * Module 18 — AI Behavior Analysis Type Definitions
 */

export type ActivityType =
  | "WALKING"
  | "RUNNING"
  | "STILL"
  | "CYCLING"
  | "IN_VEHICLE"
  | "UNKNOWN";

export type BehaviorEventType =
  | "RUNNING_DETECTED"
  | "SUDDEN_STOP"
  | "DIRECTION_CHANGE_PATTERN"
  | "UNUSUAL_INACTIVITY"
  | "POSSIBLE_DEVICE_DROP_OR_FALL"
  | "UNUSUAL_MOVEMENT_PATTERN";

export type RiskLevel = "NORMAL" | "ATTENTION" | "HIGH";

export interface MotionSample {
  x: number;
  y: number;
  z: number;
  magnitude: number;
  timestampMs: number;
}

export interface GyroSample {
  x: number;
  y: number;
  z: number;
  timestampMs: number;
}

export interface LocationSample {
  latitude: number;
  longitude: number;
  speedMps: number;
  headingDegrees: number;
  accuracyMeters: number;
  timestampMs: number;
}

export interface DetectedBehaviorEvent {
  id: string;
  type: BehaviorEventType;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  riskScoreDelta: number;
  timestampMs: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface BehaviorReport {
  currentActivity: ActivityType;
  activityConfidence: number;
  currentSpeedKmh: number;
  currentHeadingDegrees: number;
  riskScore: number; // 0 to 100
  riskLevel: RiskLevel;
  primaryReason: string;
  reasons: string[];
  activeEvents: DetectedBehaviorEvent[];
  lastEvaluatedTimestampMs: number;
}

export interface IBehaviorDetector {
  name: string;
  evaluate(
    currentLocation: LocationSample | null,
    locationHistory: LocationSample[],
    activity: ActivityType,
    motionHistory: MotionSample[],
    gyroHistory: GyroSample[],
    context?: { isAtDestination?: boolean; destinationLat?: number; destinationLng?: number }
  ): DetectedBehaviorEvent | null;
  reset(): void;
}
