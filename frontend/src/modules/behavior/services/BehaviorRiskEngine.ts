/**
 * BehaviorRiskEngine.ts
 *
 * Module 18 — Explainable Local Risk Scoring Engine
 *
 * Computes an explainable 0–100 risk score based on active detected behavior events,
 * applies continuous score decay, and maps to NORMAL, ATTENTION, or HIGH risk levels.
 */

import {
  BehaviorReport,
  DetectedBehaviorEvent,
  RiskLevel,
  ActivityType,
} from "../types/behavior.types";
import { BEHAVIOR_CONFIG } from "../config/behaviorConfig";

export class BehaviorRiskEngine {
  private currentScore = 0;
  private lastEvaluatedMs = Date.now();
  private activeEvents: DetectedBehaviorEvent[] = [];

  /**
   * Evaluates newly fired events and applies time-based decay.
   */
  public evaluate(
    newEvents: DetectedBehaviorEvent[],
    currentActivity: ActivityType,
    currentSpeedKmh: number,
    currentHeadingDegrees: number,
    activityConfidence: number = 0.85
  ): BehaviorReport {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - this.lastEvaluatedMs) / 1000);
    this.lastEvaluatedMs = now;

    // Apply score decay
    const decayAmount = elapsedSeconds * BEHAVIOR_CONFIG.RISK_DECAY_RATE_PER_SEC;
    this.currentScore = Math.max(0, this.currentScore - decayAmount);

    // Add score delta from newly detected events
    for (const evt of newEvents) {
      this.currentScore = Math.min(
        BEHAVIOR_CONFIG.RISK_SCORE_MAX,
        this.currentScore + evt.riskScoreDelta
      );
      this.activeEvents.unshift(evt);
    }

    // Keep only events from the last 2 minutes
    this.activeEvents = this.activeEvents.filter(
      (e) => now - e.timestampMs <= 120000
    );

    // Derive Risk Level
    let riskLevel: RiskLevel = "NORMAL";
    if (this.currentScore > BEHAVIOR_CONFIG.RISK_SCORE_ATTENTION_MAX) {
      riskLevel = "HIGH";
    } else if (this.currentScore > BEHAVIOR_CONFIG.RISK_SCORE_NORMAL_MAX) {
      riskLevel = "ATTENTION";
    }

    // Generate explainable reasons
    const reasons: string[] = [];
    if (this.activeEvents.length > 0) {
      for (const e of this.activeEvents.slice(0, 3)) {
        reasons.push(e.description);
      }
    } else {
      reasons.push("Smooth, expected movement along your journey.");
    }

    let primaryReason = "Safety status: Normal";
    if (riskLevel === "HIGH") {
      primaryReason = "Your movement pattern appears unusual.";
    } else if (riskLevel === "ATTENTION") {
      primaryReason = "Unusual movement detected.";
    }

    return {
      currentActivity,
      activityConfidence,
      currentSpeedKmh,
      currentHeadingDegrees,
      riskScore: Math.round(this.currentScore),
      riskLevel,
      primaryReason,
      reasons,
      activeEvents: [...this.activeEvents],
      lastEvaluatedTimestampMs: now,
    };
  }

  /**
   * Manually dismisses active risk/attention warnings (e.g. user clicked "I'm Safe").
   */
  public dismissWarning(): void {
    this.currentScore = 0;
    this.activeEvents = [];
  }

  /**
   * Resets the risk engine to clean state.
   */
  public reset(): void {
    this.currentScore = 0;
    this.activeEvents = [];
    this.lastEvaluatedMs = Date.now();
  }
}
