/**
 * BehaviorAnalysisService.ts
 *
 * Module 18 — Central Behavior Analysis Engine Orchestrator
 *
 * Coordinates Physical Activity Recognition, Accelerometer/Gyroscope motion streams,
 * GPS location telemetry, independent rule detectors, and explainable local risk scoring.
 */

import { Accelerometer, Gyroscope } from "expo-sensors";
import {
  ActivityType,
  BehaviorReport,
  DetectedBehaviorEvent,
  GyroSample,
  IBehaviorDetector,
  LocationSample,
  MotionSample,
} from "../types/behavior.types";
import { BEHAVIOR_CONFIG } from "../config/behaviorConfig";
import { ActivityRecognitionService } from "./ActivityRecognitionService";
import { RunningDetector } from "../detectors/RunningDetector";
import { SuddenStopDetector } from "../detectors/SuddenStopDetector";
import { DirectionChangeDetector } from "../detectors/DirectionChangeDetector";
import { InactivityDetector } from "../detectors/InactivityDetector";
import { DeviceMovementDetector } from "../detectors/DeviceMovementDetector";
import { MovementPatternDetector } from "../detectors/MovementPatternDetector";
import { BehaviorRiskEngine } from "./BehaviorRiskEngine";

class BehaviorAnalysisServiceClass {
  private isRunning = false;
  private detectors: IBehaviorDetector[] = [];
  private riskEngine = new BehaviorRiskEngine();

  // Sliding buffers
  private locationHistory: LocationSample[] = [];
  private currentLocation: LocationSample | null = null;
  private motionHistory: MotionSample[] = [];
  private gyroHistory: GyroSample[] = [];

  // Subscriptions
  private accelSubscription: any = null;
  private gyroSubscription: any = null;
  private evalTimer: ReturnType<typeof setInterval> | null = null;

  // Listeners
  private listeners: Array<(report: BehaviorReport) => void> = [];
  private highRiskEscalationCallback: ((report: BehaviorReport) => void) | null = null;

  constructor() {
    this.detectors = [
      new RunningDetector(),
      new SuddenStopDetector(),
      new DirectionChangeDetector(),
      new InactivityDetector(),
      new DeviceMovementDetector(),
      new MovementPatternDetector(),
    ];
  }

  /**
   * Starts behavior analysis monitoring (invoked when Safety Mode / Journey starts).
   */
  public async startMonitoring(options?: {
    destinationLat?: number;
    destinationLng?: number;
    onHighRiskEscalate?: (report: BehaviorReport) => void;
  }): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.reset();

    if (options?.onHighRiskEscalate) {
      this.highRiskEscalationCallback = options.onHighRiskEscalate;
    }

    // 1. Request & start activity recognition
    await ActivityRecognitionService.requestPermission();
    await ActivityRecognitionService.startMonitoring();

    // 2. Start hardware sensors if available
    try {
      Accelerometer.setUpdateInterval(BEHAVIOR_CONFIG.ACCELEROMETER_UPDATE_INTERVAL_MS);
      this.accelSubscription = Accelerometer.addListener((data) => {
        const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
        this.addMotionSample({
          x: data.x,
          y: data.y,
          z: data.z,
          magnitude,
          timestampMs: Date.now(),
        });
      });
    } catch (e) {
      console.log("[BehaviorAnalysisService] Accelerometer unavailable in environment:", e);
    }

    try {
      Gyroscope.setUpdateInterval(BEHAVIOR_CONFIG.GYROSCOPE_UPDATE_INTERVAL_MS);
      this.gyroSubscription = Gyroscope.addListener((data) => {
        this.addGyroSample({
          x: data.x,
          y: data.y,
          z: data.z,
          timestampMs: Date.now(),
        });
      });
    } catch (e) {
      console.log("[BehaviorAnalysisService] Gyroscope unavailable in environment:", e);
    }

    // 3. Periodic evaluation loop
    this.evalTimer = setInterval(() => {
      this.evaluateAll();
    }, 1500);

    console.log("[BehaviorAnalysisService] Real-time behavior monitoring active.");
  }

  /**
   * Stops behavior analysis monitoring and releases all hardware listeners.
   */
  public stopMonitoring(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.accelSubscription) {
      this.accelSubscription.remove();
      this.accelSubscription = null;
    }

    if (this.gyroSubscription) {
      this.gyroSubscription.remove();
      this.gyroSubscription = null;
    }

    if (this.evalTimer) {
      clearInterval(this.evalTimer);
      this.evalTimer = null;
    }

    ActivityRecognitionService.stopMonitoring();
    this.reset();
    console.log("[BehaviorAnalysisService] Behavior monitoring stopped & sensors released.");
  }

  /**
   * Ingests a new GPS location sample from the active Safety Mode tracking loop.
   */
  public ingestLocation(loc: {
    latitude: number;
    longitude: number;
    speedMps?: number;
    headingDegrees?: number;
    accuracyMeters?: number;
    timestampMs?: number;
  }): void {
    const sample: LocationSample = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      speedMps: loc.speedMps ?? 0,
      headingDegrees: loc.headingDegrees ?? 0,
      accuracyMeters: loc.accuracyMeters ?? 10,
      timestampMs: loc.timestampMs ?? Date.now(),
    };

    this.currentLocation = sample;
    this.locationHistory.push(sample);
    if (this.locationHistory.length > BEHAVIOR_CONFIG.LOCATION_BUFFER_SIZE) {
      this.locationHistory.shift();
    }

    // Update inferred activity
    const motionVariance = this.calculateMotionVariance();
    ActivityRecognitionService.updateInferredActivity(sample.speedMps, motionVariance);

    this.evaluateAll();
  }

  public addMotionSample(sample: MotionSample): void {
    this.motionHistory.push(sample);
    if (this.motionHistory.length > BEHAVIOR_CONFIG.MOTION_BUFFER_SIZE) {
      this.motionHistory.shift();
    }
  }

  public addGyroSample(sample: GyroSample): void {
    this.gyroHistory.push(sample);
    if (this.gyroHistory.length > BEHAVIOR_CONFIG.GYRO_BUFFER_SIZE) {
      this.gyroHistory.shift();
    }
  }

  /**
   * Executes all independent detectors and compiles the current BehaviorReport.
   */
  public evaluateAll(): BehaviorReport {
    const currentActivity = ActivityRecognitionService.getCurrentActivity();
    const confidence = ActivityRecognitionService.getConfidence();
    const speedKmh = this.currentLocation ? this.currentLocation.speedMps * 3.6 : 0;
    const heading = this.currentLocation ? this.currentLocation.headingDegrees : 0;

    const newEvents: DetectedBehaviorEvent[] = [];

    for (const detector of this.detectors) {
      try {
        const evt = detector.evaluate(
          this.currentLocation,
          this.locationHistory,
          currentActivity,
          this.motionHistory,
          this.gyroHistory
        );
        if (evt) {
          newEvents.push(evt);
        }
      } catch (err) {
        console.warn(`[BehaviorAnalysisService] Detector ${detector.name} error:`, err);
      }
    }

    const report = this.riskEngine.evaluate(
      newEvents,
      currentActivity,
      speedKmh,
      heading,
      confidence
    );

    this.notifyListeners(report);

    if (report.riskLevel === "HIGH" && this.highRiskEscalationCallback) {
      this.highRiskEscalationCallback(report);
    }

    return report;
  }

  public dismissWarning(): void {
    this.riskEngine.dismissWarning();
    this.evaluateAll();
  }

  public reset(): void {
    this.locationHistory = [];
    this.currentLocation = null;
    this.motionHistory = [];
    this.gyroHistory = [];
    this.riskEngine.reset();
    for (const d of this.detectors) {
      d.reset();
    }
  }

  public subscribe(cb: (report: BehaviorReport) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notifyListeners(report: BehaviorReport): void {
    for (const cb of this.listeners) {
      try {
        cb(report);
      } catch {}
    }
  }

  private calculateMotionVariance(): number {
    if (this.motionHistory.length < 3) return 0;
    const mags = this.motionHistory.map((m) => m.magnitude);
    const avg = mags.reduce((a, b) => a + b, 0) / mags.length;
    const squareDiffs = mags.map((val) => Math.pow(val - avg, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  }
}

export const BehaviorAnalysisService = new BehaviorAnalysisServiceClass();
