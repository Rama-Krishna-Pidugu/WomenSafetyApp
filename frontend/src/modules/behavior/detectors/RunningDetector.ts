/**
 * RunningDetector.ts
 *
 * Module 18 — Running Detection
 *
 * Combines physical activity recognition + GPS speed over a minimum duration threshold.
 * Applies event debouncing/cooldowns.
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

export class RunningDetector implements IBehaviorDetector {
  public readonly name = "RunningDetector";
  private runningStartTimeMs: number | null = null;
  private lastTriggeredTimeMs = 0;

  public evaluate(
    currentLocation: LocationSample | null,
    _locationHistory: LocationSample[],
    activity: ActivityType,
    _motionHistory: MotionSample[],
    _gyroHistory: GyroSample[]
  ): DetectedBehaviorEvent | null {
    const now = currentLocation?.timestampMs || Date.now();

    // Check cooldown
    if (now - this.lastTriggeredTimeMs < BEHAVIOR_CONFIG.RUNNING_COOLDOWN_MS) {
      return null;
    }

    const isRunningActivity = activity === "RUNNING";
    const isRunningSpeed =
      (currentLocation?.speedMps ?? 0) >= BEHAVIOR_CONFIG.SPEED_RUNNING_MIN_MPS;

    if (isRunningActivity || isRunningSpeed) {
      if (!this.runningStartTimeMs) {
        this.runningStartTimeMs = now;
      }

      const durationMs = now - this.runningStartTimeMs;
      if (durationMs >= BEHAVIOR_CONFIG.RUNNING_MIN_DURATION_MS) {
        this.lastTriggeredTimeMs = now;
        this.runningStartTimeMs = null;

        const speedKmh = ((currentLocation?.speedMps ?? 3.0) * 3.6).toFixed(1);
        return {
          id: `run-${now}`,
          type: "RUNNING_DETECTED",
          title: "Running Activity Detected",
          description: `Sustained running detected (${speedKmh} km/h).`,
          severity: "low",
          riskScoreDelta: BEHAVIOR_CONFIG.RUNNING_RISK_WEIGHT,
          timestampMs: now,
          confidence: 0.88,
          metadata: { speedKmh, durationMs },
        };
      }
    } else {
      this.runningStartTimeMs = null;
    }

    return null;
  }

  public reset(): void {
    this.runningStartTimeMs = null;
    this.lastTriggeredTimeMs = 0;
  }
}
