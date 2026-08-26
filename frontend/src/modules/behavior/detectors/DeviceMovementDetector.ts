/**
 * DeviceMovementDetector.ts
 *
 * Module 18 — Device Movement & Fall/Drop Detection
 *
 * Evaluates accelerometer and gyroscope signals for high g-force impact spikes
 * followed by stillness, indicative of a possible fall or device drop.
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

export class DeviceMovementDetector implements IBehaviorDetector {
  public readonly name = "DeviceMovementDetector";
  private spikeTimestampMs: number | null = null;
  private lastTriggeredTimeMs = 0;

  public evaluate(
    currentLocation: LocationSample | null,
    _locationHistory: LocationSample[],
    _activity: ActivityType,
    motionHistory: MotionSample[],
    gyroHistory: GyroSample[]
  ): DetectedBehaviorEvent | null {
    const now = currentLocation?.timestampMs || Date.now();

    if (now - this.lastTriggeredTimeMs < BEHAVIOR_CONFIG.DEVICE_DROP_COOLDOWN_MS) {
      return null;
    }

    if (motionHistory.length < 2) {
      return null;
    }

    // Check for high acceleration spike in motion history
    const spikeSample = motionHistory.find(
      (m) => m.magnitude >= BEHAVIOR_CONFIG.DEVICE_DROP_MAGNITUDE_G
    );
    const gyroSpike = gyroHistory.find(
      (g) => Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) >= BEHAVIOR_CONFIG.DEVICE_DROP_ROTATION_RATE
    );

    if ((spikeSample || gyroSpike) && !this.spikeTimestampMs) {
      this.spikeTimestampMs = spikeSample?.timestampMs || gyroSpike?.timestampMs || now;
    }

    if (this.spikeTimestampMs) {
      const elapsedSinceSpike = now - this.spikeTimestampMs;
      // If 2-6 seconds have elapsed after the spike, verify if movement is now still
      if (elapsedSinceSpike >= 2000 && elapsedSinceSpike <= 6000) {
        const postSpikeSamples = motionHistory.filter(
          (m) => m.timestampMs > this.spikeTimestampMs!
        );
        const targetSamples = postSpikeSamples.length > 0 ? postSpikeSamples : motionHistory.slice(-3);
        const avgPostMotion =
          targetSamples.reduce((acc, m) => acc + Math.abs(m.magnitude - 1.0), 0) / targetSamples.length;

        if (avgPostMotion < 0.35) {
          this.lastTriggeredTimeMs = now;
          this.spikeTimestampMs = null;

          return {
            id: `drop-${now}`,
            type: "POSSIBLE_DEVICE_DROP_OR_FALL",
            title: "Possible Fall or Unusual Movement",
            description: "Possible fall or unusual movement detected.",
            severity: "high",
            riskScoreDelta: BEHAVIOR_CONFIG.DEVICE_DROP_RISK_WEIGHT,
            timestampMs: now,
            confidence: 0.86,
            metadata: {
              maxAccelG: (spikeSample?.magnitude || 2.8).toFixed(2),
            },
          };
        }
      } else if (elapsedSinceSpike > 6000) {
        this.spikeTimestampMs = null;
      }
    }

    return null;
  }

  public reset(): void {
    this.spikeTimestampMs = null;
    this.lastTriggeredTimeMs = 0;
  }
}
