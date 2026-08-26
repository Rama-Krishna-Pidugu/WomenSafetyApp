/**
 * behaviorConfig.ts
 *
 * Module 18 — Central Configuration for Behavior Analysis Engine
 *
 * Thresholds, cooldown periods, buffer sizes, and risk score weights.
 */

export const BEHAVIOR_CONFIG = {
  // Activity Recognition & Speed Thresholds
  SPEED_RUNNING_MIN_MPS: 2.5, // ~9 km/h
  SPEED_WALKING_MAX_MPS: 2.2, // ~7.9 km/h
  SPEED_STATIONARY_MAX_MPS: 0.4, // ~1.4 km/h

  // Running Detection
  RUNNING_MIN_DURATION_MS: 4000, // 4 seconds of sustained running
  RUNNING_COOLDOWN_MS: 30000, // 30s before emitting next running event
  RUNNING_RISK_WEIGHT: 10,

  // Sudden Stop Detection
  SUDDEN_STOP_PREV_SPEED_MIN_MPS: 1.5, // was moving at least 5.4 km/h
  SUDDEN_STOP_DECELERATION_RATIO: 0.3, // dropped to <= 30% of prev speed
  SUDDEN_STOP_STILL_DURATION_MS: 6000, // remained stopped for 6 seconds
  SUDDEN_STOP_COOLDOWN_MS: 45000, // 45s cooldown
  SUDDEN_STOP_RISK_WEIGHT: 20,

  // Direction Change Pattern
  DIRECTION_CHANGE_MIN_ANGLE_DEG: 60, // >= 60° shift
  DIRECTION_CHANGE_WINDOW_MS: 30000, // within 30s
  DIRECTION_CHANGE_MIN_TURNS: 3, // 3 sharp turns in 30s
  DIRECTION_CHANGE_COOLDOWN_MS: 60000,
  DIRECTION_CHANGE_RISK_WEIGHT: 15,

  // Unusual Inactivity
  INACTIVITY_MIN_DURATION_MS: 45000, // 45 seconds of continuous no-movement
  INACTIVITY_DESTINATION_RADIUS_M: 50, // ignore if within 50m of destination
  INACTIVITY_COOLDOWN_MS: 60000,
  INACTIVITY_RISK_WEIGHT: 20,

  // Device Movement / Possible Fall
  DEVICE_DROP_MAGNITUDE_G: 2.6, // acceleration spike > 2.6g (~25.5 m/s²)
  DEVICE_DROP_ROTATION_RATE: 4.0, // rad/s rotation
  DEVICE_DROP_POST_STILL_MS: 3000, // followed by stillness
  DEVICE_DROP_COOLDOWN_MS: 60000,
  DEVICE_DROP_RISK_WEIGHT: 30,

  // Movement Pattern Transitions (Rolling 45s window)
  PATTERN_WINDOW_MS: 45000,
  PATTERN_ERRATIC_TRANSITION_COUNT: 4, // 4 rapid activity mode switches
  PATTERN_COOLDOWN_MS: 60000,
  PATTERN_RISK_WEIGHT: 15,

  // Risk Score Configuration
  RISK_SCORE_MAX: 100,
  RISK_SCORE_NORMAL_MAX: 25,
  RISK_SCORE_ATTENTION_MAX: 60,
  RISK_DECAY_RATE_PER_SEC: 0.5, // decay score by 0.5 every sec if no active triggers

  // Sensor Sample Rates & Buffers
  ACCELEROMETER_UPDATE_INTERVAL_MS: 250, // 4Hz
  GYROSCOPE_UPDATE_INTERVAL_MS: 250,
  LOCATION_BUFFER_SIZE: 15,
  MOTION_BUFFER_SIZE: 30,
  GYRO_BUFFER_SIZE: 30,
} as const;
