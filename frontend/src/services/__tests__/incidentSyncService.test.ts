import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "../../api/apiClient";
import { incidentSyncService } from "../incidentSyncService";

jest.mock("../../api/apiClient", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

jest.mock("../../infrastructure/auth/firebaseAuthService", () => ({
  firebaseAuthService: {
    getIdToken: jest.fn().mockResolvedValue("mock-jwt-token"),
  },
}));

describe("IncidentSyncService (Module 19)", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("fetches user incidents from backend and caches them", async () => {
    const mockIncidents = [
      {
        id: "inc-1",
        clientIncidentId: "inc-1",
        userId: "user-123",
        triggerSource: "MANUAL_BUTTON",
        status: "ACTIVE",
        dangerScore: 0,
        createdAt: "2026-08-26T10:00:00Z",
      },
    ];

    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: mockIncidents,
    });

    const result = await incidentSyncService.fetchUserIncidents();
    expect(result.isOffline).toBe(false);
    expect(result.incidents).toEqual(mockIncidents);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "aegis_incidents_cache",
      JSON.stringify(mockIncidents)
    );
  });

  it("falls back to local cache when server is unreachable", async () => {
    const cachedIncidents = [
      {
        id: "inc-cached",
        userId: "user-123",
        triggerSource: "VOICE",
        status: "RESOLVED",
        dangerScore: 10,
        createdAt: "2026-08-26T09:00:00Z",
      },
    ];

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify(cachedIncidents)
    );
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error("Network Error"));

    const result = await incidentSyncService.fetchUserIncidents();
    expect(result.isOffline).toBe(true);
    expect(result.incidents).toEqual(cachedIncidents);
  });

  it("logs timeline event to backend successfully", async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { id: "evt-123", status: "success" },
    });

    await incidentSyncService.logTimelineEvent({
      incidentId: "inc-100",
      eventType: "PHOTO_CAPTURED",
      source: "EVIDENCE",
      title: "Photos Captured",
      description: "2 surroundings photos captured",
      metadata: { count: 2, sha256: "abc" },
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/incidents/inc-100/timeline",
      expect.objectContaining({
        eventType: "PHOTO_CAPTURED",
        source: "EVIDENCE",
        title: "Photos Captured",
      })
    );
  });

  it("queues event offline and retries on syncPendingEvents()", async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error("Offline"));

    await incidentSyncService.logTimelineEvent({
      incidentId: "inc-offline",
      eventType: "AUDIO_STARTED",
      source: "EVIDENCE",
      title: "Audio recording started",
    });

    const pending = await incidentSyncService.getPendingEvents();
    expect(pending.length).toBe(1);
    expect(pending[0].incidentId).toBe("inc-offline");
    expect(pending[0].eventType).toBe("AUDIO_STARTED");

    // Retry sync when online
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
    const count = await incidentSyncService.syncPendingEvents();
    expect(count).toBe(1);
  });
});
