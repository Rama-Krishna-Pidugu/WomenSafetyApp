/**
 * SuddenStopDetector.ts
 *
 * Module 18 — Sudden Stop Detection
 *
 * Detects rapid deceleration from walking/running to near-zero speed persisting
 * for a stationary window, taking destination proximity into account.
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

export class SuddenStopDetector implements IBehaviorDetector {
  public readonly name = "SuddenStopDetector";
  private stopDetectedTimeMs: number | null = null;
  private lastTriggeredTimeMs = 0;

  public evaluate(
    currentLocation: LocationSample | null,
    locationHistory: LocationSample[],
    activity: ActivityType,
    _motionHistory: MotionSample[],
    _gyroHistory: GyroSample[],
    context?: { isAtDestination?: boolean }
  ): DetectedBehaviorEvent | null {
    const now = currentLocation?.timestampMs || Date.now();

    // Ignore if already at destination or in cooldown
    if (context?.isAtDestination || now - this.lastTriggeredTimeMs < BEHAVIOR_CONFIG.SUDDEN_STOP_COOLDOWN_MS) {
      return null;
    }

    if (locationHistory.length < 3) {
      return null;
    }

    // Examine last 3-5 location samples for sudden speed drop
    const recent = locationHistory.slice(-4);
    const prevSamples = recent.slice(0, recent.length - 1);
    const maxPrevSpeed = Math.max(...prevSamples.map((s) => s.speedMps), 0);
    const currentSpeed = currentLocation?.speedMps ?? recent[recent.length - 1].speedMps;

    const hadMeaningfulMovement =
      maxPrevSpeed >= BEHAVIOR_CONFIG.SUDDEN_STOP_PREV_SPEED_MIN_MPS;
    const isNowStationary =
      currentSpeed <= BEHAVIOR_CONFIG.SPEED_STATIONARY_MAX_MPS || activity === "STILL";

    if (hadMeaningfulMovement && isNowStationary) {
      if (!this.stopDetectedTimeMs) {
        this.stopDetectedTimeMs = now;
      }

      const stillDuration = now - this.stopDetectedTimeMs;
      if (stillDuration >= BEHAVIOR_CONFIG.SUDDEN_STOP_STILL_DURATION_MS) {
        this.lastTriggeredTimeMs = now;
        this.stopDetectedTimeMs = null;

        const prevKmh = (maxPrevSpeed * 3.6).toFixed(1);
        return {
          id: `stop-${now}`,
          type: "SUDDEN_STOP",
          title: "Possible Sudden Stop",
          description: `Movement dropped rapidly from ${prevKmh} km/h and remained stopped.`,
          severity: "medium",
          riskScoreDelta: BEHAVIOR_CONFIG.SUDDEN_STOP_RISK_WEIGHT,
          timestampMs: now,
          confidence: 0.85,
          metadata: { maxPrevSpeedKmh: prevKmh, stillDurationMs: stillDuration },
        };
      }
    } else {
      this.stopDetectedTimeMs = null;
    }

    return null;
  }

  public reset(): void {
    this.stopDetectedTimeMs = null;
    this.lastTriggeredTimeMs = 0;
  }
}
