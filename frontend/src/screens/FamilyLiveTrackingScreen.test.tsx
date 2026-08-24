jest.mock("../services/liveLocationSharing", () => ({
  getLiveLocation: jest.fn(),
  stopLiveLocationSharing: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../modules/location/services/locationService", () => ({
  locationService: {
    calculateDistanceKm: jest.fn().mockReturnValue(2.1),
    calculateETA: jest.fn().mockReturnValue(9),
  },
}));

import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react-native";
import { FamilyLiveTrackingScreen } from "./FamilyLiveTrackingScreen";
import { getLiveLocation, stopLiveLocationSharing } from "../services/liveLocationSharing";

const mockedGetLiveLocation = getLiveLocation as jest.Mock;
const mockedStop = stopLiveLocationSharing as jest.Mock;

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe("FamilyLiveTrackingScreen", () => {
  it("renders real location data from getLiveLocation instead of fabricating movement", async () => {
    mockedGetLiveLocation.mockResolvedValue({
      sessionId: "trk_1",
      userName: "Priya Sharma",
      lat: 12.99,
      lng: 77.61,
      updatedAt: Date.now(),
      batteryLevel: 55,
      active: true,
    });

    await render(
      <FamilyLiveTrackingScreen
        sessionId="trk_1"
        destinationName="Home"
        destinationLat={12.985}
        destinationLng={77.605}
      />
    );

    await waitFor(() => expect(mockedGetLiveLocation).toHaveBeenCalledWith("trk_1"));
    expect(await screen.findByText("55%")).toBeTruthy();
  });

  it("shows a signal-lost message on fetch failure instead of fabricating coordinates", async () => {
    mockedGetLiveLocation.mockResolvedValue(null);

    await render(<FamilyLiveTrackingScreen sessionId="trk_2" />);

    expect(await screen.findByText(/Location signal lost/i)).toBeTruthy();
  });

  it("stop button calls stopLiveLocationSharing with the current session id", async () => {
    mockedGetLiveLocation.mockResolvedValue({
      sessionId: "trk_3",
      userName: "Priya Sharma",
      lat: 12.99,
      lng: 77.61,
      updatedAt: Date.now(),
      batteryLevel: 80,
      active: true,
    });

    await render(<FamilyLiveTrackingScreen sessionId="trk_3" />);
    await waitFor(() => expect(mockedGetLiveLocation).toHaveBeenCalled());

    fireEvent.press(screen.getByText("I'm Safe — Stop Live Location"));

    await waitFor(() => expect(mockedStop).toHaveBeenCalledWith("trk_3"));
  });
});
