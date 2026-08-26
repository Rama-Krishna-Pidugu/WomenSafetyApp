/**
 * behaviorSimulator.ts
 *
 * Module 18 — Development & Testing Simulation Harness
 *
 * Allows developers and automated tests to simulate realistic movement patterns
 * (Walking, Running, Sudden Stop, Direction Change, Inactivity, Possible Fall)
 * without requiring physical hardware movements.
 */

import { BehaviorAnalysisService } from "../services/BehaviorAnalysisService";
import { ActivityRecognitionService } from "../services/ActivityRecognitionService";

export type SimulationScenario =
  | "WALKING"
  | "RUNNING"
  | "SUDDEN_STOP"
  | "DIRECTION_CHANGE"
  | "INACTIVITY"
  | "POSSIBLE_FALL";

export class BehaviorSimulator {
  /**
   * Simulates normal steady walking.
   */
  public static simulateWalking(): void {
    ActivityRecognitionService.setManualActivity("WALKING", 0.92);
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      BehaviorAnalysisService.addMotionSample({
        x: 0.1,
        y: 0.9,
        z: 0.2,
        magnitude: 1.15,
        timestampMs: now - (5 - i) * 500,
      });
      BehaviorAnalysisService.ingestLocation({
        latitude: 12.9716 + i * 0.0001,
        longitude: 77.5946 + i * 0.0001,
        speedMps: 1.3, // ~4.7 km/h
        headingDegrees: 45,
        accuracyMeters: 5,
        timestampMs: now - (5 - i) * 1000,
      });
    }
  }

  /**
   * Simulates sustained running.
   */
  public static simulateRunning(): void {
    ActivityRecognitionService.setManualActivity("RUNNING", 0.95);
    const now = Date.now();
    // Ingest 5 seconds of running speed
    for (let i = 0; i < 6; i++) {
      BehaviorAnalysisService.addMotionSample({
        x: 0.4,
        y: 1.5,
        z: 0.6,
        magnitude: 1.8,
        timestampMs: now - (6 - i) * 1000,
      });
      BehaviorAnalysisService.ingestLocation({
        latitude: 12.9716 + i * 0.0003,
        longitude: 77.5946 + i * 0.0003,
        speedMps: 3.6, // ~13 km/h
        headingDegrees: 90,
        accuracyMeters: 4,
        timestampMs: now - (6 - i) * 1000,
      });
    }
  }

  /**
   * Simulates moving fast and then suddenly stopping.
   */
  public static simulateSuddenStop(): void {
    const now = Date.now();
    // 1. Moving fast
    for (let i = 0; i < 4; i++) {
      BehaviorAnalysisService.ingestLocation({
        latitude: 12.9716 + i * 0.0002,
        longitude: 77.5946 + i * 0.0002,
        speedMps: 2.8,
        headingDegrees: 90,
        accuracyMeters: 5,
        timestampMs: now - 8000 + i * 1000,
      });
    }

    // 2. Sudden drop to 0 and stationary for 7s
    ActivityRecognitionService.setManualActivity("STILL", 0.9);
    BehaviorAnalysisService.ingestLocation({
      latitude: 12.9724,
      longitude: 77.5954,
      speedMps: 0.1,
      headingDegrees: 90,
      accuracyMeters: 5,
      timestampMs: now - 7000,
    });
    BehaviorAnalysisService.ingestLocation({
      latitude: 12.9724,
      longitude: 77.5954,
      speedMps: 0.0,
      headingDegrees: 90,
      accuracyMeters: 5,
      timestampMs: now,
    });
  }

  /**
   * Simulates repeated sharp direction changes.
   */
  public static simulateDirectionChange(): void {
    ActivityRecognitionService.setManualActivity("WALKING", 0.88);
    const now = Date.now();
    const headings = [0, 90, 180, 270];

    headings.forEach((heading, i) => {
      BehaviorAnalysisService.ingestLocation({
        latitude: 12.9716 + i * 0.0001,
        longitude: 77.5946 + i * 0.0001,
        speedMps: 1.4,
        headingDegrees: heading,
        accuracyMeters: 5,
        timestampMs: now - (4 - i) * 4000,
      });
    });
  }

  /**
   * Simulates unusual prolonged inactivity mid-journey.
   */
  public static simulateInactivity(): void {
    ActivityRecognitionService.setManualActivity("STILL", 0.95);
    const now = Date.now();

    BehaviorAnalysisService.ingestLocation({
      latitude: 12.9716,
      longitude: 77.5946,
      speedMps: 0.0,
      headingDegrees: 0,
      accuracyMeters: 5,
      timestampMs: now - 50000,
    });
    BehaviorAnalysisService.ingestLocation({
      latitude: 12.9716,
      longitude: 77.5946,
      speedMps: 0.0,
      headingDegrees: 0,
      accuracyMeters: 5,
      timestampMs: now,
    });
  }

  /**
   * Simulates a high-g acceleration spike followed by stillness (fall/drop).
   */
  public static simulatePossibleFall(): void {
    const now = Date.now();
    // High-g impact spike 3 seconds ago
    BehaviorAnalysisService.addMotionSample({
      x: 1.8,
      y: 2.5,
      z: 1.2,
      magnitude: 3.2, // > 2.6g
      timestampMs: now - 3000,
    });
    BehaviorAnalysisService.addGyroSample({
      x: 3.0,
      y: 4.5,
      z: 2.0,
      timestampMs: now - 3000,
    });

    // Followed by stillness
    for (let i = 0; i < 4; i++) {
      BehaviorAnalysisService.addMotionSample({
        x: 0.0,
        y: 1.0,
        z: 0.0,
        magnitude: 1.0,
        timestampMs: now - (3 - i) * 500,
      });
    }

    BehaviorAnalysisService.ingestLocation({
      latitude: 12.9716,
      longitude: 77.5946,
      speedMps: 0.0,
      headingDegrees: 0,
      accuracyMeters: 5,
      timestampMs: now,
    });
  }
}
