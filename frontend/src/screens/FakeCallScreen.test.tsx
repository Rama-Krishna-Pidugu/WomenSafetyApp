import React from "react";
import { render, screen, cleanup } from "@testing-library/react-native";
import { FakeCallScreen } from "./FakeCallScreen";

jest.mock("../services/fakeCallService", () => ({
  fakeCallService: {
    getConfig: jest.fn().mockResolvedValue({
      callerName: "Mom",
      phoneNumber: "+91 98765 43210",
      ringtone: "Marimba",
      vibrate: true,
      autoPlayVoice: true,
      delayMinutes: 2,
      delaySeconds: 120,
      enabled: true,
    }),
    saveConfig: jest.fn().mockResolvedValue(undefined),
    scheduleFakeCall: jest.fn().mockResolvedValue(undefined),
    triggerImmediateFakeCall: jest.fn().mockResolvedValue(undefined),
  },
}));

afterEach(() => {
  cleanup();
});

describe("FakeCallScreen", () => {
  it("renders Fake Call Generator title, Quick Settings banner, and options", async () => {
    await render(<FakeCallScreen />);

    expect(screen.getByText("Fake Call Generator")).toBeTruthy();
    expect(screen.getByText("Quick Settings Tile Ready")).toBeTruthy();
    expect(screen.getByText("Mom")).toBeTruthy();
    expect(screen.getByText("Dad")).toBeTruthy();
    expect(screen.getByText("Instant")).toBeTruthy();
    expect(screen.getByText("10s")).toBeTruthy();
    expect(screen.getByText("2m")).toBeTruthy();
    expect(screen.getByText("Marimba")).toBeTruthy();
    expect(screen.getByText("Vibration")).toBeTruthy();
    expect(screen.getByText("Auto-Play Voice")).toBeTruthy();
  });
});
