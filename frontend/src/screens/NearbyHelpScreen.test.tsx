import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react-native";
import { NearbyHelpScreen } from "./NearbyHelpScreen";

jest.mock("../components/app/LiveTrackingMapView", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LiveTrackingMapView: (props: any) => <View testID="mock-live-tracking-map" {...props} />,
  };
});

jest.mock("../services/emergency", () => ({
  emergencyServicesService: {
    getNearbyServices: jest.fn().mockResolvedValue([
      {
        id: "p-1",
        name: "Indiranagar Police Station",
        type: "POLICE",
        latitude: 12.978,
        longitude: 77.640,
        address: "100 Feet Rd, Indiranagar",
        phone: "+91 80 2294 2222",
        distanceKm: 0.4,
        source: "openstreetmap",
      },
      {
        id: "h-2",
        name: "Manipal Hospital Emergency",
        type: "HOSPITAL",
        latitude: 12.960,
        longitude: 77.650,
        address: "Old Airport Rd",
        distanceKm: 1.2,
        isOpen: true,
        source: "openstreetmap",
      },
    ]),
  },
}));

afterEach(() => {
  cleanup();
});

describe("NearbyHelpScreen (Module 13)", () => {
  it("renders nearby help header, all category chips, and direct emergency hotlines", async () => {
    await render(<NearbyHelpScreen />);

    expect(screen.getByText("Nearby help")).toBeTruthy();
    expect(screen.getByText("All")).toBeTruthy();
    expect(screen.getByText("Police")).toBeTruthy();
    expect(screen.getByText("Hospitals")).toBeTruthy();
    expect(screen.getByText("Ambulance")).toBeTruthy();
    expect(screen.getByText("Women Support")).toBeTruthy();
    expect(screen.getByText("NGOs")).toBeTruthy();
    expect(screen.getByText("Transport")).toBeTruthy();

    expect(screen.getByText("DIRECT HELPLINES")).toBeTruthy();
    expect(screen.getByText("National Emergency")).toBeTruthy();
    expect(screen.getByText("112")).toBeTruthy();
    expect(screen.getByText("1091")).toBeTruthy();
  });

  it("renders nearby emergency service cards with distance and action buttons", async () => {
    await render(<NearbyHelpScreen />);

    expect(await screen.findByText("Indiranagar Police Station")).toBeTruthy();
    expect(screen.getByText("0.4 km away")).toBeTruthy();
    expect(screen.getByText("Manipal Hospital Emergency")).toBeTruthy();
    expect(screen.getByText("1.2 km away · Open 24/7")).toBeTruthy();

    expect(screen.getAllByText("Directions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Call")).toBeTruthy();
  });

  it("toggles map view when toggle button is pressed", async () => {
    await render(<NearbyHelpScreen />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Toggle view"));
    });

    expect(screen.getByTestId("mock-live-tracking-map")).toBeTruthy();
  });
});
