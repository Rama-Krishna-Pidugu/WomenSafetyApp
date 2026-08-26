/**
 * DirectionChangeDetector.ts
 *
 * Module 18 — Sudden Direction Change Pattern Detection
 *
 * Tracks repeated sharp bearing/heading shifts over a short rolling window.
 */

import {
  ActivityType,
  DetectedBehaviorEvent,
  IBehaviorDetector,
  LocationSample,
  MotionSample,
  GyroSample,
} from "../types/behavior.types";
import { BEHAVIOR_CONFIG } from "../config/behaviorConfig";

function calculateAngleDiff(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

export class DirectionChangeDetector implements IBehaviorDetector {
  public readonly name = "DirectionChangeDetector";
  private turnHistory: Array<{ timestampMs: number; angleDiff: number }> = [];
  private lastTriggeredTimeMs = 0;

  public evaluate(
    currentLocation: LocationSample | null,
    locationHistory: LocationSample[],
    _activity: ActivityType,
    _motionHistory: MotionSample[],
    _gyroHistory: GyroSample[]
  ): DetectedBehaviorEvent | null {
    const now = currentLocation?.timestampMs || Date.now();

    if (now - this.lastTriggeredTimeMs < BEHAVIOR_CONFIG.DIRECTION_CHANGE_COOLDOWN_MS) {
      return null;
    }

    if (locationHistory.length < 2 || !currentLocation) {
      return null;
    }

    // Only assess heading changes if user is moving at walking/running speed
    if (currentLocation.speedMps < BEHAVIOR_CONFIG.SPEED_STATIONARY_MAX_MPS) {
      return null;
    }

    const prevLocation = locationHistory[locationHistory.length - 2];
    if (prevLocation && prevLocation.speedMps >= BEHAVIOR_CONFIG.SPEED_STATIONARY_MAX_MPS) {
      const angleDiff = calculateAngleDiff(
        currentLocation.headingDegrees,
        prevLocation.headingDegrees
      );

      if (angleDiff >= BEHAVIOR_CONFIG.DIRECTION_CHANGE_MIN_ANGLE_DEG) {
        this.turnHistory.push({ timestampMs: now, angleDiff });
      }
    }

    // Purge turns older than window
    this.turnHistory = this.turnHistory.filter(
      (t) => now - t.timestampMs <= BEHAVIOR_CONFIG.DIRECTION_CHANGE_WINDOW_MS
    );

    if (this.turnHistory.length >= BEHAVIOR_CONFIG.DIRECTION_CHANGE_MIN_TURNS) {
      this.lastTriggeredTimeMs = now;
      const turnCount = this.turnHistory.length;
      this.turnHistory = [];

      return {
        id: `dir-${now}`,
        type: "DIRECTION_CHANGE_PATTERN",
        title: "Unexpected Route Change Pattern",
        description: `Multiple sharp direction changes detected (${turnCount} turns in 30s).`,
        severity: "medium",
        riskScoreDelta: BEHAVIOR_CONFIG.DIRECTION_CHANGE_RISK_WEIGHT,
        timestampMs: now,
        confidence: 0.82,
        metadata: { turnCount },
      };
    }

    return null;
  }

  public reset(): void {
    this.turnHistory = [];
    this.lastTriggeredTimeMs = 0;
  }
}
