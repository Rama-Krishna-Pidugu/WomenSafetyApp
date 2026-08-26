/**
 * ActivityRecognitionService.ts
 *
 * Module 18 — Physical Activity Recognition Layer
 *
 * Manages runtime ACTIVITY_RECOGNITION permissions on Android and provides
 * clean activity state estimation (WALKING, RUNNING, STILL, CYCLING, IN_VEHICLE, UNKNOWN).
 */

import { PermissionsAndroid, Platform } from "react-native";
import { ActivityType } from "../types/behavior.types";
import { BEHAVIOR_CONFIG } from "../config/behaviorConfig";

class ActivityRecognitionServiceClass {
  private isMonitoring = false;
  private currentActivity: ActivityType = "STILL";
  private confidence = 0.85;
  private listeners: Array<(activity: ActivityType, confidence: number) => void> = [];

  /**
   * Checks if Android Activity Recognition permission is currently granted.
   */
  public async checkPermission(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return true;
    }
    try {
      if (Platform.Version >= 29) {
        return await PermissionsAndroid.check(
          "android.permission.ACTIVITY_RECOGNITION" as any
        );
      }
      return true;
    } catch (e) {
      console.warn("[ActivityRecognitionService] checkPermission error:", e);
      return false;
    }
  }

  /**
   * Requests Activity Recognition permission from the user upon Safety Mode activation.
   */
  public async requestPermission(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return true;
    }
    try {
      if (Platform.Version >= 29) {
        const granted = await PermissionsAndroid.request(
          "android.permission.ACTIVITY_RECOGNITION" as any,
          {
            title: "Physical Activity Recognition",
            message:
              "Aegis uses motion activity to detect sudden movement patterns, running, or falls during your journey.",
            buttonPositive: "Allow",
            buttonNegative: "Deny",
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    } catch (e) {
      console.warn("[ActivityRecognitionService] requestPermission error:", e);
      return false;
    }
  }

  /**
   * Starts monitoring physical activity.
   */
  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    console.log("[ActivityRecognitionService] Activity monitoring started.");
  }

  /**
   * Stops physical activity monitoring.
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
    this.currentActivity = "STILL";
    this.confidence = 0.9;
    console.log("[ActivityRecognitionService] Activity monitoring stopped.");
  }

  /**
   * Derives activity from motion energy and GPS speed snapshot.
   */
  public updateInferredActivity(speedMps: number, motionMagnitudeVariance: number): void {
    if (!this.isMonitoring) return;

    let inferred: ActivityType = "STILL";
    let conf = 0.85;

    if (speedMps > 8.0) {
      inferred = "IN_VEHICLE";
      conf = 0.9;
    } else if (speedMps >= BEHAVIOR_CONFIG.SPEED_RUNNING_MIN_MPS || motionMagnitudeVariance > 0.8) {
      inferred = "RUNNING";
      conf = 0.88;
    } else if (speedMps > BEHAVIOR_CONFIG.SPEED_STATIONARY_MAX_MPS || motionMagnitudeVariance > 0.15) {
      inferred = "WALKING";
      conf = 0.85;
    } else {
      inferred = "STILL";
      conf = 0.92;
    }

    this.currentActivity = inferred;
    this.confidence = conf;
    this.notifyListeners(inferred, conf);
  }

  public setManualActivity(activity: ActivityType, confidence: number = 0.95): void {
    this.currentActivity = activity;
    this.confidence = confidence;
    this.notifyListeners(activity, confidence);
  }

  public getCurrentActivity(): ActivityType {
    return this.currentActivity;
  }

  public getConfidence(): number {
    return this.confidence;
  }

  public addListener(cb: (activity: ActivityType, confidence: number) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notifyListeners(activity: ActivityType, confidence: number): void {
    for (const l of this.listeners) {
      try {
        l(activity, confidence);
      } catch {}
    }
  }
}

export const ActivityRecognitionService = new ActivityRecognitionServiceClass();
