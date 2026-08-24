describe("trackingUrl", () => {
  const ORIGINAL_ENV = process.env.EXPO_PUBLIC_TRACKING_BASE_URL;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_TRACKING_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_TRACKING_BASE_URL = ORIGINAL_ENV;
    }
  });

  it("builds the tracking URL from EXPO_PUBLIC_TRACKING_BASE_URL when set", () => {
    process.env.EXPO_PUBLIC_TRACKING_BASE_URL = "https://aegis-women-safety.web.app";
    let getPublicTrackingUrl!: typeof import("./trackingUrl").getPublicTrackingUrl;
    jest.isolateModules(() => {
      ({ getPublicTrackingUrl } = require("./trackingUrl"));
    });

    expect(getPublicTrackingUrl("trk_123")).toBe(
      "https://aegis-women-safety.web.app/track.html?sessionId=trk_123"
    );
  });

  it("falls back to an obviously-fake placeholder URL when unset, instead of a dead tunnel link", () => {
    delete process.env.EXPO_PUBLIC_TRACKING_BASE_URL;
    let getPublicTrackingUrl!: typeof import("./trackingUrl").getPublicTrackingUrl;
    jest.isolateModules(() => {
      ({ getPublicTrackingUrl } = require("./trackingUrl"));
    });

    expect(getPublicTrackingUrl("trk_123")).toBe(
      "https://SET_EXPO_PUBLIC_TRACKING_BASE_URL.example/track.html?sessionId=trk_123"
    );
  });
});
