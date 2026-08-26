import { render, screen, fireEvent, act, cleanup } from "@testing-library/react-native";
import { SosScreen } from "./SosScreen";

jest.mock("../services/sosOrchestratorService", () => ({
  triggerSOS: jest.fn(() => Promise.resolve("inc-1")),
  cancelSOS: jest.fn(() => Promise.resolve()),
  getActiveIncidentId: jest.fn(() => null),
}));

jest.mock("../services/contactStorageService", () => ({
  contactStorageService: {
    getStoredEmergencyContacts: jest.fn(() => Promise.resolve([])),
  },
}));

afterEach(() => {
  cleanup();
});

describe("SosScreen", () => {
  it("renders active emergency state correctly", async () => {
    await render(<SosScreen state="active" />);
    expect(screen.getByText("EMERGENCY ACTIVE")).toBeTruthy();
    expect(screen.getByText("00:00")).toBeTruthy();
    expect(screen.getByText("Audio recording")).toBeTruthy();
    expect(screen.getByText("Call police · 112")).toBeTruthy();
  });

  it("triggers onEnd callback when end emergency button is pressed", async () => {
    const onEnd = jest.fn();
    await render(<SosScreen state="active" onEnd={onEnd} />);
    await act(async () => {
      fireEvent.press(screen.getByText("Hold to end emergency"));
    });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("renders confirm dialog when state is confirm", async () => {
    await render(<SosScreen state="confirm" />);
    expect(screen.getByText("End the emergency?")).toBeTruthy();
    expect(screen.getByText("Verify a trusted face")).toBeTruthy();
  });

  it("renders cancelled screen when state is cancelled", async () => {
    await render(<SosScreen state="cancelled" />);
    expect(screen.getByText("Emergency ended")).toBeTruthy();
    expect(screen.getByText("Evidence saved privately")).toBeTruthy();
    expect(screen.getByText("Back to Home")).toBeTruthy();
  });

  it("triggers onDone callback from cancelled screen", async () => {
    const onDone = jest.fn();
    await render(<SosScreen state="cancelled" onDone={onDone} />);
    await act(async () => {
      fireEvent.press(screen.getByText("Back to Home"));
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

