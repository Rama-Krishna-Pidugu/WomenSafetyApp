import React from "react";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react-native";
import { SafetyCircleScreen } from "./SafetyCircleScreen";
import { useSafetyCircle } from "../hooks/useSafetyCircle";

jest.mock("../hooks/useSafetyCircle");

const mockUseSafetyCircle = useSafetyCircle as jest.Mock;

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe("SafetyCircleScreen", () => {
  it("renders the empty state when there are no trusted contacts", async () => {
    mockUseSafetyCircle.mockReturnValue({
      contacts: [],
      loading: false,
      error: null,
      add: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      isMaxReached: false,
    });

    await render(<SafetyCircleScreen />);

    expect(screen.getByText("Your Safety Circle is empty")).toBeTruthy();
  });

  it("renders trusted contact cards with relation badge and notification state", async () => {
    mockUseSafetyCircle.mockReturnValue({
      contacts: [
        {
          id: "c1",
          name: "Mom",
          initials: "MO",
          phone: "+911234567890",
          relation: "MOTHER",
          priority: 1,
          isActive: true,
          notificationEnabled: true,
          liveLocationEnabled: true,
          smsEnabled: false,
        },
      ],
      loading: false,
      error: null,
      add: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      isMaxReached: false,
    });

    await render(<SafetyCircleScreen />);

    expect(screen.getByText("Mom")).toBeTruthy();
    expect(screen.getByText("+911234567890")).toBeTruthy();
    expect(screen.getByText("Notifications on")).toBeTruthy();
    expect(screen.getByText("Sees live location")).toBeTruthy();
  });

  it("toggling the notification switch calls update() with the flipped value", async () => {
    const update = jest.fn();
    mockUseSafetyCircle.mockReturnValue({
      contacts: [
        {
          id: "c1", name: "Mom", initials: "MO", phone: "+911234567890", relation: "MOTHER",
          priority: 1, isActive: true, notificationEnabled: true, liveLocationEnabled: true, smsEnabled: false,
        },
      ],
      loading: false,
      error: null,
      add: jest.fn(),
      update,
      remove: jest.fn(),
      isMaxReached: false,
    });

    await render(<SafetyCircleScreen />);
    fireEvent(screen.getByText("Notifications on"), "press");

    expect(update).toHaveBeenCalledWith("c1", { notificationEnabled: false });
  });

  it("opening the add-contact form and saving calls add() with the entered fields", async () => {
    const add = jest.fn().mockResolvedValue(true);
    mockUseSafetyCircle.mockReturnValue({
      contacts: [],
      loading: false,
      error: null,
      add,
      update: jest.fn(),
      remove: jest.fn(),
      isMaxReached: false,
    });

    await render(<SafetyCircleScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add trusted contact"));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText("Name"), "Dad");
    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText("Phone number"), "+919876543210");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Add to Safety Circle"));
    });

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Dad", phone: "+919876543210" })
    );
  });
});
