jest.mock("../services/liveLocationSharing", () => ({
  startLiveLocationSharing: jest.fn().mockResolvedValue("https://example.com/track"),
  stopLiveLocationSharing: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../services/sosNativeService", () => ({
  sendSilentSms: jest.fn().mockResolvedValue(true),
}));
jest.mock("../services/contactStorageService", () => ({
  contactStorageService: {
    getStoredEmergencyContacts: jest.fn().mockResolvedValue([{ name: "Mom", phone: "+919999999999" }]),
  },
}));
jest.mock("../modules/location/services/locationService", () => ({
  locationService: {
    getCurrentLocation: jest.fn().mockResolvedValue(null),
    startLocationTracking: jest.fn(),
    stopLocationTracking: jest.fn(),
    calculateDistanceKm: jest.fn().mockReturnValue(3.4),
    calculateETA: jest.fn().mockReturnValue(14),
    isInsideGeofence: jest.fn().mockReturnValue(true),
  },
}));
jest.mock("../modules/location/services/nearbyPlacesService", () => ({
  nearbyPlacesService: {
    findNearbyPoliceStations: jest.fn().mockResolvedValue([]),
    findNearbyHospitals: jest.fn().mockResolvedValue([]),
  },
}));

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react-native";
import { SafeRouteScreen } from "./SafeRouteScreen";
import { startLiveLocationSharing, stopLiveLocationSharing } from "../services/liveLocationSharing";
import { sendSilentSms } from "../services/sosNativeService";

const mockedStart = startLiveLocationSharing as jest.Mock;
const mockedStop = stopLiveLocationSharing as jest.Mock;
const mockedSendSms = sendSilentSms as jest.Mock;

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe("SafeRouteScreen — live location wiring", () => {
  it("starts live location sharing via liveLocationSharing when navigation starts", async () => {
    await render(<SafeRouteScreen state="results" />);

    fireEvent.press(screen.getByText("Start Safe Navigation"));

    await waitFor(() => expect(mockedStart).toHaveBeenCalled());
  });

  it("sends the tracking SMS when autoSendSms is on (the default)", async () => {
    await render(<SafeRouteScreen state="results" />);

    fireEvent.press(screen.getByText("Start Safe Navigation"));

    await waitFor(() => expect(mockedSendSms).toHaveBeenCalled());
  });

  it("skips the SMS when autoSendSms is switched off", async () => {
    await render(<SafeRouteScreen state="results" />);

    await fireEvent.press(screen.getByText(/Zone Settings/));
    await fireEvent(screen.getByTestId("autoSendSmsSwitch"), "valueChange", false);
    await fireEvent.press(screen.getByText("Save & Apply Settings"));

    fireEvent.press(screen.getByText("Start Safe Navigation"));

    await waitFor(() => expect(mockedStart).toHaveBeenCalled());
    expect(mockedSendSms).not.toHaveBeenCalled();
  });

  it("stops live location sharing when navigation ends", async () => {
    await render(<SafeRouteScreen state="results" />);

    fireEvent.press(screen.getByText("Start Safe Navigation"));
    await waitFor(() => expect(mockedStart).toHaveBeenCalled());

    fireEvent.press(screen.getByText("End Navigation"));

    await waitFor(() => expect(mockedStop).toHaveBeenCalled());
  });
});
