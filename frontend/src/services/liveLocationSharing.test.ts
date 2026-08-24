import { getLiveLocation, pushLocationUpdate } from "./liveLocationSharing";

describe("liveLocationSharing — getLiveLocation", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it("returns parsed location data on a successful fetch", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lat: 12.9716,
        lng: 77.5946,
        updatedAt: 1700000000000,
        userName: "Priya Sharma",
        batteryLevel: 72,
        active: true,
      }),
    });

    const result = await getLiveLocation("trk_123");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://women-safety-3d446-default-rtdb.firebaseio.com/tracking_sessions/trk_123.json"
    );
    expect(result).toEqual({
      sessionId: "trk_123",
      userName: "Priya Sharma",
      lat: 12.9716,
      lng: 77.5946,
      updatedAt: 1700000000000,
      batteryLevel: 72,
      active: true,
    });
  });

  it("returns null when the session has no data yet", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => null });

    expect(await getLiveLocation("trk_new")).toBeNull();
  });

  it("returns null on a non-ok response instead of throwing", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    expect(await getLiveLocation("trk_err")).toBeNull();
  });

  it("returns null on a network failure instead of throwing", async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));

    expect(await getLiveLocation("trk_neterr")).toBeNull();
  });
});

describe("liveLocationSharing — pushLocationUpdate", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it("writes only to Firebase RTDB — no call to the removed /api/v1/gps/ping endpoint", async () => {
    await pushLocationUpdate("trk_123", "Priya Sharma", { lat: 12.9, lng: 77.5 }, true);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://women-safety-3d446-default-rtdb.firebaseio.com/tracking_sessions/trk_123.json",
      expect.objectContaining({ method: "PUT" })
    );
  });
});
