jest.mock("../services/contactStorageService", () => ({
  contactStorageService: {
    getStoredEmergencyContacts: jest.fn().mockResolvedValue([{ phone: "+919999999999" }]),
  },
}));

jest.mock("../services/incidentSyncService", () => ({
  fetchIncidentHistory: jest.fn().mockResolvedValue([]),
  syncIncidentEvent: jest.fn().mockResolvedValue(undefined),
  incidentSyncService: {
    fetchUserIncidents: jest.fn().mockResolvedValue({ incidents: [], isOffline: false }),
    fetchIncidentTimeline: jest.fn().mockResolvedValue({ events: [], isOffline: false }),
    logTimelineEvent: jest.fn().mockResolvedValue(undefined),
    getPendingEvents: jest.fn().mockResolvedValue([]),
  },
}));

import { render, screen, cleanup } from "@testing-library/react-native";
import { HistoryScreen, IncidentDetailScreen } from "./HistoryScreens";

afterEach(() => {
  cleanup();
});

jest.setTimeout(30000);

describe("HistoryScreens", () => {
  it("renders HistoryScreen dashboard and list", async () => {
    await render(<HistoryScreen />);
    expect(screen.getAllByText("History")[0]).toBeTruthy();
    expect(screen.getByText("Monitored walk")).toBeTruthy();
  });

  it("calls onOpen with the tapped incident's id", async () => {
    const onOpen = jest.fn();
    await render(<HistoryScreen onOpen={onOpen} />);

    const { fireEvent } = require("@testing-library/react-native");
    fireEvent.press(screen.getByText("Monitored walk"));

    expect(onOpen).toHaveBeenCalledWith("mock-1");
  });

  it("renders empty history state when state is empty", async () => {
    await render(<HistoryScreen state="empty" />);
    expect(screen.getByText("Nothing here yet")).toBeTruthy();
  });

  it("renders IncidentDetailScreen with a real incident's timeline", async () => {
    const { triggerSOS } = require("../services/sosOrchestratorService");
    const incidentId = await triggerSOS("BUTTON");

    await render(<IncidentDetailScreen incidentId={incidentId} />);

    expect(await screen.findByText("Incident details")).toBeTruthy();
    expect(screen.getByText(/SOS — Button trigger/)).toBeTruthy();
  });

  it("renders a not-found state for an unknown incidentId", async () => {
    await render(<IncidentDetailScreen incidentId="does-not-exist" />);
    expect(await screen.findByText("Incident not found")).toBeTruthy();
  });

  it("renders a friendly label for an AI behavior-analysis alert in the timeline", async () => {
    const { triggerSOS } = require("../services/sosOrchestratorService");
    const incidentId = await triggerSOS("BUTTON");

    // Manually append the step the way the real pipeline would once
    // behaviorAnalysisService.evaluate resolves with a decision (that resolution
    // is async and fire-and-forget in the real pipeline; append directly here to
    // keep this test deterministic rather than racing the fire-and-forget timer).
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const raw = await AsyncStorage.getItem("@aegis_incidents_v2");
    const incidents = JSON.parse(raw);
    const idx = incidents.findIndex((i: { id: string }) => i.id === incidentId);
    incidents[idx].timeline.push({
      step: "AI_RISK_DETECTED",
      timestamp: Date.now(),
      data: { detail: "No significant movement for an extended period." },
    });
    await AsyncStorage.setItem("@aegis_incidents_v2", JSON.stringify(incidents));

    await render(<IncidentDetailScreen incidentId={incidentId} />);

    expect(await screen.findByText("AI Threat Detected")).toBeTruthy();
  });
});

