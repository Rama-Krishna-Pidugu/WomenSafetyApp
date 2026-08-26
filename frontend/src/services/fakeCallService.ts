/**
 * Module 8: Fake Call Generator Service
 * Bridges React Native Fake Call settings with Native Android SharedPreferences & AlarmManager.
 */

import { NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FakeCallConfig, CallerProfile } from "../types/fakeCall";

const STORAGE_KEY_CONFIG = "@fake_call_instant_config";

const getNativeModule = () => NativeModules.FakeCallModule;

export const DEFAULT_FAKE_CALL_CONFIG: FakeCallConfig = {
  callerName: "Mom",
  phoneNumber: "+91 98765 43210",
  ringtone: "Marimba",
  vibrate: true,
  autoPlayVoice: true,
  delayMinutes: 0,
  delaySeconds: 0,
  enabled: true,
};

export class FakeCallService {
  /**
   * Load user's preferred instant fake call configuration.
   * Reads from Native SharedPreferences on Android if available, otherwise AsyncStorage.
   */
  public async getConfig(): Promise<FakeCallConfig> {
    const mod = getNativeModule();
    if (Platform.OS === "android" && mod?.getNativeConfig) {
      try {
        const nativeCfg = await mod.getNativeConfig();
        if (nativeCfg && nativeCfg.callerName) {
          const delaySec = nativeCfg.delaySeconds ?? 0;
          return {
            callerName: nativeCfg.callerName || "Mom",
            phoneNumber: nativeCfg.phoneNumber || "+91 98765 43210",
            ringtone: nativeCfg.ringtone || "Marimba",
            vibrate: Boolean(nativeCfg.vibrate),
            autoPlayVoice: Boolean(nativeCfg.autoPlayVoice),
            delayMinutes: Math.floor(delaySec / 60),
            delaySeconds: delaySec,
            enabled: Boolean(nativeCfg.enabled),
          };
        }
      } catch (e) {
        console.warn("[FakeCallService] Failed to read native config, falling back to AsyncStorage", e);
      }
    }

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<FakeCallConfig>;
        return {
          ...DEFAULT_FAKE_CALL_CONFIG,
          ...parsed,
          delayMinutes: parsed.delayMinutes ?? (parsed.delaySeconds ? Math.floor(parsed.delaySeconds / 60) : 0),
          delaySeconds: parsed.delaySeconds ?? (parsed.delayMinutes ? parsed.delayMinutes * 60 : 0),
        };
      }
    } catch (err) {
      console.error("[FakeCallService] Failed to load fake call config", err);
    }
    return DEFAULT_FAKE_CALL_CONFIG;
  }

  /**
   * Save user's preferred fake call configuration.
   * Updates AsyncStorage AND syncs directly to Native Android SharedPreferences.
   */
  public async saveConfig(config: FakeCallConfig): Promise<void> {
    const delaySec =
      config.delaySeconds !== undefined
        ? config.delaySeconds
        : (config.delayMinutes || 0) * 60;

    const normalizedConfig: FakeCallConfig = {
      ...config,
      delaySeconds: delaySec,
      delayMinutes: Math.floor(delaySec / 60),
    };

    // 1. Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(normalizedConfig));
    } catch (err) {
      console.error("[FakeCallService] Failed to save fake call config to AsyncStorage", err);
    }

    // 2. Sync to Android SharedPreferences for Quick Settings Tile & AlarmManager
    const mod = getNativeModule();
    if (Platform.OS === "android" && mod?.saveNativeConfig) {
      try {
        await mod.saveNativeConfig({
          callerName: normalizedConfig.callerName,
          phoneNumber: normalizedConfig.phoneNumber || "+91 98765 43210",
          ringtone: normalizedConfig.ringtone,
          vibrate: normalizedConfig.vibrate,
          autoPlayVoice: normalizedConfig.autoPlayVoice,
          delaySeconds: delaySec,
          enabled: normalizedConfig.enabled ?? true,
        });
        console.log(`[FakeCallService] Synchronized fake call config to native layer (delay: ${delaySec}s)`);
      } catch (err) {
        console.warn("[FakeCallService] Native config sync error:", err);
      }
    }
  }

  /**
   * Schedule a fake call via Native Android AlarmManager (or JS fallback).
   */
  public async scheduleFakeCall(delaySeconds: number): Promise<void> {
    console.log(`[FakeCallService] Scheduling fake call in ${delaySeconds} seconds`);
    const mod = getNativeModule();
    if (Platform.OS === "android" && mod?.scheduleFakeCall) {
      try {
        await mod.scheduleFakeCall(delaySeconds);
        return;
      } catch (err) {
        console.warn("[FakeCallService] Native schedule failed, trying fallback:", err);
      }
    }
  }

  /**
   * Cancel any active scheduled fake call.
   */
  public async cancelScheduledFakeCall(): Promise<void> {
    const mod = getNativeModule();
    if (Platform.OS === "android" && mod?.cancelScheduledFakeCall) {
      try {
        await mod.cancelScheduledFakeCall();
        return;
      } catch (err) {
        console.warn("[FakeCallService] Native cancel error:", err);
      }
    }
  }

  /**
   * Trigger immediate incoming fake call.
   */
  public async triggerImmediateFakeCall(): Promise<void> {
    const mod = getNativeModule();
    if (Platform.OS === "android" && mod?.triggerImmediateFakeCall) {
      try {
        await mod.triggerImmediateFakeCall();
        return;
      } catch (err) {
        console.warn("[FakeCallService] Native immediate trigger error:", err);
      }
    }
  }

  /**
   * Get available caller profiles
   */
  public async getCallerProfiles(): Promise<CallerProfile[]> {
    return [
      { id: "1", name: "Mom", phoneNumber: "+91 98765 43210", voicePresetId: "female_friendly" },
      { id: "2", name: "Dad", phoneNumber: "+91 98765 43211", voicePresetId: "male_friendly" },
      { id: "3", name: "Police Officer", phoneNumber: "112", voicePresetId: "officer_authoritative" },
    ];
  }
}

export const fakeCallService = new FakeCallService();
