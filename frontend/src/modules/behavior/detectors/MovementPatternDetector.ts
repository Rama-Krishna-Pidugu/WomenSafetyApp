/**
 * MovementPatternDetector.ts
 *
 * Module 18 — Walking Pattern & Activity Transition Analysis
 *
 * Analyzes activity transitions across a rolling 30–60 second window to identify
 * erratic, alternating patterns (e.g. WALKING -> RUNNING -> STOP -> RUNNING).
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

export class MovementPatternDetector implements IBehaviorDetector {
  public readonly name = "MovementPatternDetector";
  private activityHistory: Array<{ activity: ActivityType; timestampMs: number }> = [];
  private lastTriggeredTimeMs = 0;

  public evaluate(
    currentLocation: LocationSample | null,
    _locationHistory: LocationSample[],
    activity: ActivityType,
    _motionHistory: MotionSample[],
    _gyroHistory: GyroSample[]
  ): DetectedBehaviorEvent | null {
    const now = currentLocation?.timestampMs || Date.now();

    if (now - this.lastTriggeredTimeMs < BEHAVIOR_CONFIG.PATTERN_COOLDOWN_MS) {
      return null;
    }

    // Add activity if different from previous entry
    const lastEntry = this.activityHistory[this.activityHistory.length - 1];
    if (!lastEntry || lastEntry.activity !== activity) {
      this.activityHistory.push({ activity, timestampMs: now });
    }

    // Filter to window
    this.activityHistory = this.activityHistory.filter(
      (a) => now - a.timestampMs <= BEHAVIOR_CONFIG.PATTERN_WINDOW_MS
    );

    // Count transitions
    if (this.activityHistory.length >= BEHAVIOR_CONFIG.PATTERN_ERRATIC_TRANSITION_COUNT) {
      this.lastTriggeredTimeMs = now;
      const transitionCount = this.activityHistory.length;
      this.activityHistory = [];

      return {
        id: `pat-${now}`,
        type: "UNUSUAL_MOVEMENT_PATTERN",
        title: "Unusual Movement Pattern",
        description: "Rapid fluctuations between walking, running and stops detected.",
        severity: "medium",
        riskScoreDelta: BEHAVIOR_CONFIG.PATTERN_RISK_WEIGHT,
        timestampMs: now,
        confidence: 0.84,
        metadata: { transitionCount },
      };
    }

    return null;
  }

  public reset(): void {
    this.activityHistory = [];
    this.lastTriggeredTimeMs = 0;
  }
}
