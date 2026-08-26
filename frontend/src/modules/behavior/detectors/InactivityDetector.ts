/**
 * InactivityDetector.ts
 *
 * Module 18 — Unusual Inactivity Detection
 *
 * Flags prolonged stationary periods mid-journey when the user is not at their destination.
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

export class InactivityDetector implements IBehaviorDetector {
  public readonly name = "InactivityDetector";
  private inactiveStartTimeMs: number | null = null;
  private lastTriggeredTimeMs = 0;

  public evaluate(
    currentLocation: LocationSample | null,
    _locationHistory: LocationSample[],
    activity: ActivityType,
    motionHistory: MotionSample[],
    _gyroHistory: GyroSample[],
    context?: { isAtDestination?: boolean }
  ): DetectedBehaviorEvent | null {
    const now = currentLocation?.timestampMs || Date.now();

    if (context?.isAtDestination || now - this.lastTriggeredTimeMs < BEHAVIOR_CONFIG.INACTIVITY_COOLDOWN_MS) {
      return null;
    }

    const isSpeedStationary =
      (currentLocation?.speedMps ?? 0) <= BEHAVIOR_CONFIG.SPEED_STATIONARY_MAX_MPS;
    const isActivityStill = activity === "STILL";

    // Average motion magnitude from recent samples
    const recentMotion = motionHistory.slice(-10);
    const avgMotion =
      recentMotion.length > 0
        ? recentMotion.reduce((acc, m) => acc + Math.abs(m.magnitude - 1.0), 0) / recentMotion.length
        : 0;

    const isPhysicallyStill = avgMotion < 0.1;

    if (isSpeedStationary && (isActivityStill || isPhysicallyStill)) {
      if (!this.inactiveStartTimeMs) {
        this.inactiveStartTimeMs = now;
      }

      const durationMs = now - this.inactiveStartTimeMs;
      if (durationMs >= BEHAVIOR_CONFIG.INACTIVITY_MIN_DURATION_MS) {
        this.lastTriggeredTimeMs = now;
        this.inactiveStartTimeMs = null;

        const durationSec = Math.round(durationMs / 1000);
        return {
          id: `inact-${now}`,
          type: "UNUSUAL_INACTIVITY",
          title: "Possible Inactivity",
          description: `No movement detected for over ${durationSec} seconds during active journey.`,
          severity: "medium",
          riskScoreDelta: BEHAVIOR_CONFIG.INACTIVITY_RISK_WEIGHT,
          timestampMs: now,
          confidence: 0.85,
          metadata: { durationSec },
        };
      }
    } else {
      this.inactiveStartTimeMs = null;
    }

    return null;
  }

  public reset(): void {
    this.inactiveStartTimeMs = null;
    this.lastTriggeredTimeMs = 0;
  }
}
