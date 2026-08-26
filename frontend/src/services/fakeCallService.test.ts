import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import { fakeCallService, DEFAULT_FAKE_CALL_CONFIG } from "./fakeCallService";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe("fakeCallService (Native Quick Settings Tile & Background Bridge)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NativeModules.FakeCallModule = {
      saveNativeConfig: jest.fn().mockResolvedValue(true),
      getNativeConfig: jest.fn().mockResolvedValue({
        callerName: "Mom",
        phoneNumber: "+91 98765 43210",
        ringtone: "Marimba",
        vibrate: true,
        autoPlayVoice: true,
        delaySeconds: 120,
        isScheduled: false,
        enabled: true,
      }),
      scheduleFakeCall: jest.fn().mockResolvedValue(true),
      cancelScheduledFakeCall: jest.fn().mockResolvedValue(true),
      triggerImmediateFakeCall: jest.fn().mockResolvedValue(true),
    };
  });

  it("returns native config when available on Android", async () => {
    Platform.OS = "android";
    const config = await fakeCallService.getConfig();
    expect(config.callerName).toBe("Mom");
    expect(config.delaySeconds).toBe(120);
    expect(config.delayMinutes).toBe(2);
  });

  it("saves config to both AsyncStorage and Android Native SharedPreferences", async () => {
    Platform.OS = "android";
    const newConfig = {
      callerName: "Dad",
      phoneNumber: "+91 98765 43211",
      ringtone: "Classic",
      vibrate: false,
      autoPlayVoice: true,
      delayMinutes: 1,
      delaySeconds: 60,
      enabled: true,
    };

    await fakeCallService.saveConfig(newConfig);

    expect(AsyncStorage.setItem).toHaveBeenCalled();
    expect(NativeModules.FakeCallModule.saveNativeConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        callerName: "Dad",
        delaySeconds: 60,
        ringtone: "Classic",
      })
    );
  });

  it("schedules fake call via native AlarmManager bridge", async () => {
    Platform.OS = "android";
    await fakeCallService.scheduleFakeCall(120);
    expect(NativeModules.FakeCallModule.scheduleFakeCall).toHaveBeenCalledWith(120);
  });

  it("cancels scheduled fake call via native AlarmManager bridge", async () => {
    Platform.OS = "android";
    await fakeCallService.cancelScheduledFakeCall();
    expect(NativeModules.FakeCallModule.cancelScheduledFakeCall).toHaveBeenCalled();
  });

  it("triggers immediate fake call via native bridge", async () => {
    Platform.OS = "android";
    await fakeCallService.triggerImmediateFakeCall();
    expect(NativeModules.FakeCallModule.triggerImmediateFakeCall).toHaveBeenCalled();
  });
});
