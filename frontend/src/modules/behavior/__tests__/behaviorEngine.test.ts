import { RunningDetector } from "../detectors/RunningDetector";
import { SuddenStopDetector } from "../detectors/SuddenStopDetector";
import { DirectionChangeDetector } from "../detectors/DirectionChangeDetector";
import { InactivityDetector } from "../detectors/InactivityDetector";
import { DeviceMovementDetector } from "../detectors/DeviceMovementDetector";
import { MovementPatternDetector } from "../detectors/MovementPatternDetector";
import { BehaviorRiskEngine } from "../services/BehaviorRiskEngine";
import { ActivityRecognitionService } from "../services/ActivityRecognitionService";
import { BehaviorAnalysisService } from "../services/BehaviorAnalysisService";
import { BehaviorSimulator } from "../simulation/behaviorSimulator";

describe("Module 18 — AI Behavior Analysis Engine", () => {
  describe("RunningDetector", () => {
    it("detects sustained running when speed exceeds threshold for minimum duration", () => {
      const detector = new RunningDetector();
      const now = Date.now();

      // Sample 1: Running starts
      const loc1 = {
        latitude: 12.97,
        longitude: 77.59,
        speedMps: 3.5, // > 2.5 m/s
        headingDegrees: 90,
        accuracyMeters: 5,
        timestampMs: now - 5000,
      };
      expect(detector.evaluate(loc1, [loc1], "RUNNING", [], [])).toBeNull();

      // Sample 2: 5 seconds later, still running
      const loc2 = {
        latitude: 12.971,
        longitude: 77.591,
        speedMps: 3.8,
        headingDegrees: 90,
        accuracyMeters: 5,
        timestampMs: now,
      };
      const event = detector.evaluate(loc2, [loc1, loc2], "RUNNING", [], []);
      expect(event).not.toBeNull();
      expect(event?.type).toBe("RUNNING_DETECTED");
      expect(event?.riskScoreDelta).toBe(10);
    });
  });

  describe("SuddenStopDetector", () => {
    it("detects sudden stop from moving speed to stationary", () => {
      const detector = new SuddenStopDetector();
      const now = Date.now();

      const locHistory = [
        { latitude: 12.97, longitude: 77.59, speedMps: 2.8, headingDegrees: 0, accuracyMeters: 5, timestampMs: now - 10000 },
        { latitude: 12.971, longitude: 77.59, speedMps: 2.6, headingDegrees: 0, accuracyMeters: 5, timestampMs: now - 8000 },
        { latitude: 12.972, longitude: 77.59, speedMps: 0.1, headingDegrees: 0, accuracyMeters: 5, timestampMs: now - 7000 },
      ];

      // First tick when stopped
      detector.evaluate(locHistory[2], locHistory, "STILL", [], []);

      // Current sample 7s later, remains stopped
      const currentLoc = {
        latitude: 12.972,
        longitude: 77.59,
        speedMps: 0.0,
        headingDegrees: 0,
        accuracyMeters: 5,
        timestampMs: now,
      };

      const event = detector.evaluate(currentLoc, [...locHistory, currentLoc], "STILL", [], []);
      expect(event).not.toBeNull();
      expect(event?.type).toBe("SUDDEN_STOP");
      expect(event?.riskScoreDelta).toBe(20);
    });
  });

  describe("DirectionChangeDetector", () => {
    it("flags sharp repetitive heading shifts within time window", () => {
      const detector = new DirectionChangeDetector();
      const now = Date.now();

      const locations = [
        { latitude: 12.97, longitude: 77.59, speedMps: 1.5, headingDegrees: 0, accuracyMeters: 5, timestampMs: now - 15000 },
        { latitude: 12.971, longitude: 77.59, speedMps: 1.5, headingDegrees: 90, accuracyMeters: 5, timestampMs: now - 10000 },
        { latitude: 12.972, longitude: 77.59, speedMps: 1.5, headingDegrees: 180, accuracyMeters: 5, timestampMs: now - 5000 },
        { latitude: 12.973, longitude: 77.59, speedMps: 1.5, headingDegrees: 270, accuracyMeters: 5, timestampMs: now },
      ];

      let event = null;
      for (let i = 1; i < locations.length; i++) {
        event = detector.evaluate(locations[i], locations.slice(0, i + 1), "WALKING", [], []);
      }

      expect(event).not.toBeNull();
      expect(event?.type).toBe("DIRECTION_CHANGE_PATTERN");
    });
  });

  describe("InactivityDetector", () => {
    it("flags unexpected stationary period mid-journey", () => {
      const detector = new InactivityDetector();
      const now = Date.now();

      const loc1 = { latitude: 12.97, longitude: 77.59, speedMps: 0.0, headingDegrees: 0, accuracyMeters: 5, timestampMs: now - 50000 };
      detector.evaluate(loc1, [loc1], "STILL", [], []);

      const loc2 = { latitude: 12.97, longitude: 77.59, speedMps: 0.0, headingDegrees: 0, accuracyMeters: 5, timestampMs: now };
      const event = detector.evaluate(loc2, [loc1, loc2], "STILL", [], []);

      expect(event).not.toBeNull();
      expect(event?.type).toBe("UNUSUAL_INACTIVITY");
    });
  });

  describe("DeviceMovementDetector", () => {
    it("detects high-g acceleration spike followed by stillness", () => {
      const detector = new DeviceMovementDetector();
      const now = Date.now();

      // 1. High impact spike 3 seconds ago
      const motionHistory = [
        { x: 2.0, y: 2.5, z: 1.0, magnitude: 3.35, timestampMs: now - 3000 }, // > 2.6g
        { x: 0.0, y: 1.0, z: 0.0, magnitude: 1.0, timestampMs: now - 2000 },
        { x: 0.0, y: 1.0, z: 0.0, magnitude: 1.0, timestampMs: now - 1000 },
        { x: 0.0, y: 1.0, z: 0.0, magnitude: 1.0, timestampMs: now },
      ];

      const gyroHistory = [
        { x: 3.5, y: 4.0, z: 1.0, timestampMs: now - 3000 },
        { x: 0.0, y: 0.0, z: 0.0, timestampMs: now },
      ];

      const currentLoc = { latitude: 12.97, longitude: 77.59, speedMps: 0, headingDegrees: 0, accuracyMeters: 5, timestampMs: now };

      // Evaluate initial spike
      detector.evaluate(currentLoc, [currentLoc], "STILL", motionHistory.slice(0, 1), gyroHistory.slice(0, 1));

      // Evaluate stillness 3s later
      const event = detector.evaluate(currentLoc, [currentLoc], "STILL", motionHistory, gyroHistory);
      expect(event).not.toBeNull();
      expect(event?.type).toBe("POSSIBLE_DEVICE_DROP_OR_FALL");
      expect(event?.riskScoreDelta).toBe(30);
    });
  });

  describe("MovementPatternDetector", () => {
    it("flags rapid alternating activity mode switches", () => {
      const detector = new MovementPatternDetector();
      const now = Date.now();

      const activities = ["WALKING", "RUNNING", "STILL", "RUNNING", "STILL"] as const;
      let event: any = null;

      activities.forEach((act, i) => {
        const loc = { latitude: 12.97, longitude: 77.59, speedMps: 1.0, headingDegrees: 0, accuracyMeters: 5, timestampMs: now - (5 - i) * 5000 };
        const result = detector.evaluate(loc, [loc], act, [], []);
        if (result) event = result;
      });

      expect(event).not.toBeNull();
      expect(event?.type).toBe("UNUSUAL_MOVEMENT_PATTERN");
    });
  });

  describe("BehaviorRiskEngine", () => {
    it("aggregates risk scores and maps to explainable risk levels", () => {
      const engine = new BehaviorRiskEngine();

      // Normal state
      const initialReport = engine.evaluate([], "WALKING", 4.5, 90);
      expect(initialReport.riskLevel).toBe("NORMAL");
      expect(initialReport.riskScore).toBe(0);

      // Add attention-level event
      const attentionReport = engine.evaluate(
        [
          {
            id: "evt-1",
            type: "SUDDEN_STOP",
            title: "Possible Sudden Stop",
            description: "Movement dropped rapidly and remained stopped.",
            severity: "medium",
            riskScoreDelta: 30,
            timestampMs: Date.now(),
            confidence: 0.85,
          },
        ],
        "STILL",
        0.0,
        90
      );
      expect(attentionReport.riskLevel).toBe("ATTENTION");
      expect(attentionReport.riskScore).toBeGreaterThanOrEqual(26);

      // Add high-risk event
      const highRiskReport = engine.evaluate(
        [
          {
            id: "evt-2",
            type: "POSSIBLE_DEVICE_DROP_OR_FALL",
            title: "Possible Fall",
            description: "Possible fall or unusual movement detected.",
            severity: "high",
            riskScoreDelta: 35,
            timestampMs: Date.now(),
            confidence: 0.9,
          },
        ],
        "STILL",
        0.0,
        90
      );
      expect(highRiskReport.riskLevel).toBe("HIGH");
      expect(highRiskReport.riskScore).toBeGreaterThanOrEqual(65);
    });
  });

  describe("BehaviorSimulator & BehaviorAnalysisService", () => {
    beforeEach(() => {
      BehaviorAnalysisService.reset();
    });

    it("simulates walking pattern cleanly", () => {
      BehaviorSimulator.simulateWalking();
      const report = BehaviorAnalysisService.evaluateAll();
      expect(report.currentActivity).toBe("WALKING");
      expect(report.riskLevel).toBe("NORMAL");
    });

    it("simulates sudden stop scenario", () => {
      BehaviorSimulator.simulateSuddenStop();
      const report = BehaviorAnalysisService.evaluateAll();
      expect(report.currentActivity).toBe("STILL");
      expect(report.riskScore).toBeGreaterThan(0);
    });
  });
});
