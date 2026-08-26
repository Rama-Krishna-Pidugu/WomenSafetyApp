import { render, screen, fireEvent, act, cleanup } from "@testing-library/react-native";
import { HomeScreen } from "./HomeScreen";

// Mock the profileService to return a predictable name
jest.mock("../services/profileService", () => ({
  getMyProfile: jest.fn().mockResolvedValue({ full_name: "Test User", name: "Test" }),
}));

afterEach(() => {
  cleanup();
});

describe("HomeScreen", () => {
  it("renders user greeting and status pill correctly", async () => {
    await render(<HomeScreen />);
    expect(screen.getByText("Good evening,")).toBeTruthy();
    // Dynamic name from mock profile
    expect(await screen.findByText("Test")).toBeTruthy();
    expect(screen.getByText("You're in a safe area")).toBeTruthy();
  });

  it("triggers onNotifications callback when bell is pressed", async () => {
    const onNotifications = jest.fn();
    await render(<HomeScreen onNotifications={onNotifications} />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Notifications"));
    });
    expect(onNotifications).toHaveBeenCalledTimes(1);
  });

  it("triggers SOS countdown when SOS hero button is pressed", async () => {
    const onSos = jest.fn();
    await render(<HomeScreen onSos={onSos} />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Press and hold to send SOS"));
    });
    expect(screen.getByText("SOS activating…")).toBeTruthy();
  });

  it("renders quick actions grid items", async () => {
    await render(<HomeScreen />);
    expect(screen.getByText("Safe Route")).toBeTruthy();
    expect(screen.getByText("Live Map")).toBeTruthy();
    expect(screen.getByText("Share Live")).toBeTruthy();
    expect(screen.getByText("Nearby Police")).toBeTruthy();
    expect(screen.getByText("Hospitals")).toBeTruthy();
    expect(screen.getByText("AI Assistant")).toBeTruthy();
  });

  it("triggers onQuickAction callback when an action item is pressed", async () => {
    const onQuickAction = jest.fn();
    await render(<HomeScreen onQuickAction={onQuickAction} />);
    await act(async () => {
      fireEvent.press(screen.getByText("Safe Route"));
    });
    expect(onQuickAction).toHaveBeenCalledWith("Safe Route");
  });
});

