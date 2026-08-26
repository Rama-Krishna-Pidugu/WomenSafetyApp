import React from "react";
import { render, screen, cleanup } from "@testing-library/react-native";
import { LiveLocationSharingModal } from "./LiveLocationSharingModal";

jest.mock("../../hooks/useEmergencyContacts", () => ({
  useEmergencyContacts: () => ({
    contacts: [
      { id: "c1", name: "Amma", relation: "MOTHER", phone: "9999999999", initials: "AM" },
      { id: "c2", name: "Priya", relation: "SISTER", phone: "8888888888", initials: "PR" },
    ],
  }),
}));

jest.mock("../../services/liveLocationSharing", () => ({
  startLiveLocationSharing: jest.fn().mockResolvedValue("https://track.demo/123"),
  stopLiveLocationSharing: jest.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
});

describe("LiveLocationSharingModal", () => {
  it("renders sharing options and contacts correctly", async () => {
    await render(
      <LiveLocationSharingModal
        visible={true}
        onClose={jest.fn()}
        userLocation={{ lat: 12.9716, lng: 77.5946 }}
        destination={{ lat: 12.985, lng: 77.605 }}
        destinationName="Home"
      />
    );

    expect(screen.getByText("Share Live Location")).toBeTruthy();
    expect(screen.getByText("Let someone you trust follow your journey in real time.")).toBeTruthy();
    expect(screen.getByText("Sharing with")).toBeTruthy();
    expect(screen.getByText("Amma")).toBeTruthy();
    expect(screen.getByText("Start Live Sharing")).toBeTruthy();
  });

  it("renders active sharing state when isAlreadySharing is true", async () => {
    await render(
      <LiveLocationSharingModal
        visible={true}
        onClose={jest.fn()}
        userLocation={{ lat: 12.9716, lng: 77.5946 }}
        destination={{ lat: 12.985, lng: 77.605 }}
        destinationName="Home"
        isAlreadySharing={true}
      />
    );

    expect(screen.getByText("Live location is being shared")).toBeTruthy();
    expect(screen.getByText("Stop Live Sharing")).toBeTruthy();
  });
});
