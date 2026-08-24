# Live Location Sharing — Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-merged live-location-sharing feature (Harshith's `2bfb3e0`) actually work end-to-end, by consolidating on the one data path that already works (Firebase RTDB) instead of the backend REST endpoints that were never implemented.

**Architecture:** Firebase Realtime Database (`tracking_sessions/{sessionId}`) becomes the single live-position data path for both the mobile app and the public web page. `liveLocationSharing.ts` is the one place that writes and reads it; `FamilyLiveTrackingScreen` and `SafeRouteScreen` both go through it instead of each having their own broken/duplicate logic. Trip metadata (destination) travels via navigation params, not the network, since it's known client-side at the point a session starts.

**Tech Stack:** React Native (Expo SDK 57) + TypeScript, `@testing-library/react-native`, Jest (`jest-expo` preset); FastAPI + pytest for the backend cleanup task.

**Spec:** `docs/superpowers/specs/2026-08-23-live-location-wiring-design.md`

## Global Constraints

- Firebase RTDB base URL is `https://women-safety-3d446-default-rtdb.firebaseio.com` (hardcoded today, matches `frontend/google-services.json`'s `project_id: women-safety-3d446` — do not change).
- Do not implement `/api/v1/gps/ping`, `/api/v1/gps/session/*` on the backend — the spec's Decision 1 is to remove the frontend calls to them, not add backend support. Only `/api/v1/geofence/check` stays.
- Do not deploy Firebase Hosting (`firebase deploy --only hosting`) — the spec's Decision 2 leaves this to the repo owner. Leave the exact command in a code comment instead.
- Do not touch Firebase RTDB security rules (`firebase-database-rules.json`) — spec's Decision 4, documented as a known limitation, not addressed here.
- Never fabricate/simulate location data on a fetch failure — show an explicit "signal lost" state instead (this was the bug being fixed in `FamilyLiveTrackingScreen`).
- Per this repo's standing rule: stage changes (`git add`), never `git commit` — the owner commits.
- Follow TDD: write the failing test, run it, confirm the failure reason, then implement, then confirm green.

---

### Task 1: `liveLocationSharing.ts` — add `getLiveLocation`, remove dead backend calls

**Files:**
- Modify: `frontend/src/services/liveLocationSharing.ts`
- Test: `frontend/src/services/liveLocationSharing.test.ts` (new)

**Interfaces:**
- Produces: `export function trackingSessionUrl(sessionId: string): string` — builds the Firebase RTDB REST URL for a session.
- Produces: `export async function getLiveLocation(sessionId: string): Promise<LiveLocationData | null>` — GETs the current session doc; returns `null` on any failure or empty session.
- Produces: `export async function pushLocationUpdate(sessionId: string, userName: string, coords: { lat: number; lng: number }, active: boolean): Promise<void>` — now exported (was module-private) so its RTDB-only behavior is directly testable.
- `startLiveLocationSharing`/`stopLiveLocationSharing` keep their existing exported signatures — later tasks depend on those not changing.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/services/liveLocationSharing.test.ts`:

```ts
import { getLiveLocation, pushLocationUpdate } from "./liveLocationSharing";

describe("liveLocationSharing — getLiveLocation", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("returns parsed location data on a successful fetch", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
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

    expect(global.fetch).toHaveBeenCalledWith(
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
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => null });

    expect(await getLiveLocation("trk_new")).toBeNull();
  });

  it("returns null on a non-ok response instead of throwing", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    expect(await getLiveLocation("trk_err")).toBeNull();
  });

  it("returns null on a network failure instead of throwing", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));

    expect(await getLiveLocation("trk_neterr")).toBeNull();
  });
});

describe("liveLocationSharing — pushLocationUpdate", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it("writes only to Firebase RTDB — no call to the removed /api/v1/gps/ping endpoint", async () => {
    await pushLocationUpdate("trk_123", "Priya Sharma", { lat: 12.9, lng: 77.5 }, true);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://women-safety-3d446-default-rtdb.firebaseio.com/tracking_sessions/trk_123.json",
      expect.objectContaining({ method: "PUT" })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx jest src/services/liveLocationSharing.test.ts -v`
Expected: FAIL — `getLiveLocation` is not exported / undefined, `pushLocationUpdate` is not exported / undefined.

- [ ] **Step 3: Implement**

In `frontend/src/services/liveLocationSharing.ts`, add near the top (after the `UPDATE_INTERVAL_MS` constant):

```ts
const FIREBASE_RTDB_BASE = "https://women-safety-3d446-default-rtdb.firebaseio.com";

export function trackingSessionUrl(sessionId: string): string {
  return `${FIREBASE_RTDB_BASE}/tracking_sessions/${sessionId}.json`;
}
```

Replace the whole `pushLocationUpdate` function (currently lines ~128-169) with:

```ts
/**
 * Pushes location payload to Firebase Realtime Database — the single source of truth for
 * live position, read by both FamilyLiveTrackingScreen and web/track.html.
 */
export async function pushLocationUpdate(
  sessionId: string,
  userName: string,
  coords: { lat: number; lng: number },
  active: boolean
): Promise<void> {
  const payload = {
    lat: coords.lat,
    lng: coords.lng,
    updatedAt: Date.now(),
    userName: userName,
    batteryLevel: 88,
    active: active,
  };

  fetch(trackingSessionUrl(sessionId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => console.warn("[liveLocationSharing] Firebase RTDB sync error:", err));
}

/**
 * Fetches the current live-location snapshot for a session from Firebase RTDB.
 * Returns null on any failure or if the session has no data yet — callers must handle
 * null explicitly rather than falling back to fabricated coordinates.
 */
export async function getLiveLocation(sessionId: string): Promise<LiveLocationData | null> {
  try {
    const response = await fetch(trackingSessionUrl(sessionId));
    if (!response.ok) return null;

    const data = await response.json();
    if (!data) return null;

    return {
      sessionId,
      userName: data.userName ?? "User",
      lat: data.lat,
      lng: data.lng,
      updatedAt: data.updatedAt,
      batteryLevel: data.batteryLevel,
      active: data.active ?? false,
    };
  } catch (err) {
    console.warn("[liveLocationSharing] getLiveLocation error:", err);
    return null;
  }
}
```

In `stopLiveLocationSharing`, delete the now-dead block that hits the backend stop endpoint (currently lines ~108-115):

```ts
  // Also hit backend stop endpoint
  try {
    await fetch(`${API_BASE_URL}/api/v1/gps/session/${sessionId}/stop`, {
      method: "POST",
    });
  } catch {
    /* best effort */
  }
```

Remove the now-unused `import { API_BASE_URL } from "../api/config";` line at the top of the file (nothing else in this file uses it after this change).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx jest src/services/liveLocationSharing.test.ts -v`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/services/liveLocationSharing.ts frontend/src/services/liveLocationSharing.test.ts
```

---

### Task 2: `trackingUrl.ts` — real configurable public URL

**Files:**
- Modify: `frontend/src/utils/trackingUrl.ts`
- Modify: `frontend/.env.example`
- Test: `frontend/src/utils/trackingUrl.test.ts` (new)

**Interfaces:**
- Produces: `export function getPublicTrackingUrl(sessionId: string): string` — signature unchanged, callers in `liveLocationSharing.ts`, `FamilyLiveTrackingScreen.tsx`, and `SafeRouteScreen.tsx` need no changes.
- Reads: `process.env.EXPO_PUBLIC_TRACKING_BASE_URL`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/trackingUrl.test.ts`:

```ts
describe("trackingUrl", () => {
  const ORIGINAL_ENV = process.env.EXPO_PUBLIC_TRACKING_BASE_URL;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_TRACKING_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_TRACKING_BASE_URL = ORIGINAL_ENV;
    }
    jest.resetModules();
  });

  it("builds the tracking URL from EXPO_PUBLIC_TRACKING_BASE_URL when set", async () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_TRACKING_BASE_URL = "https://aegis-women-safety.web.app";

    const { getPublicTrackingUrl } = await import("./trackingUrl");

    expect(getPublicTrackingUrl("trk_123")).toBe(
      "https://aegis-women-safety.web.app/track.html?sessionId=trk_123"
    );
  });

  it("falls back to an obviously-fake placeholder URL when unset, instead of a dead tunnel link", async () => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_TRACKING_BASE_URL;

    const { getPublicTrackingUrl } = await import("./trackingUrl");

    expect(getPublicTrackingUrl("trk_123")).toBe(
      "https://SET_EXPO_PUBLIC_TRACKING_BASE_URL.example/track.html?sessionId=trk_123"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest src/utils/trackingUrl.test.ts -v`
Expected: FAIL — first test gets the old hardcoded `loca.lt` URL instead of the env-based one.

- [ ] **Step 3: Implement**

Replace the full contents of `frontend/src/utils/trackingUrl.ts`:

```ts
/**
 * trackingUrl.ts
 *
 * Helper to generate universal, domain-based live tracking URLs for SMS and link sharing.
 * Independent of local dev IP addresses.
 */

const PLACEHOLDER_BASE_URL = "https://SET_EXPO_PUBLIC_TRACKING_BASE_URL.example";

// Deploy web/ to Firebase Hosting to get the real base URL:
//   firebase deploy --only hosting
// Then set EXPO_PUBLIC_TRACKING_BASE_URL to the resulting https://<project>.web.app URL
// in frontend/.env (see frontend/.env.example). Until that's set, links use an obviously
// fake placeholder so a missing config is visible in testing, not silently broken.
const TRACKING_BASE_URL = process.env.EXPO_PUBLIC_TRACKING_BASE_URL || PLACEHOLDER_BASE_URL;

export function getPublicTrackingUrl(sessionId: string): string {
  return `${TRACKING_BASE_URL}/track.html?sessionId=${sessionId}`;
}
```

In `frontend/.env.example`, add after the `EXPO_PUBLIC_API_BASE_URL` line:

```
# Public live-tracking web page (Firebase Hosting URL for web/track.html).
# Deploy with: firebase deploy --only hosting
# Then paste the resulting https://<project>.web.app URL here.
EXPO_PUBLIC_TRACKING_BASE_URL=https://your-project.web.app
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest src/utils/trackingUrl.test.ts -v`
Expected: PASS, both tests.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/utils/trackingUrl.ts frontend/src/utils/trackingUrl.test.ts frontend/.env.example
```

---

### Task 3: `FamilyLiveTrackingScreen.tsx` — real data, no fabrication, real destination props

**Files:**
- Modify: `frontend/src/screens/FamilyLiveTrackingScreen.tsx`
- Modify: `frontend/src/navigation/RootStack.tsx:98` (param list), `:492-499` (route wrapper)
- Test: `frontend/src/screens/FamilyLiveTrackingScreen.test.tsx` (new)

**Interfaces:**
- Consumes: `getLiveLocation(sessionId): Promise<LiveLocationData | null>`, `stopLiveLocationSharing(sessionId): Promise<void>` from `../services/liveLocationSharing` (Task 1).
- Consumes: `locationService.calculateDistanceKm(lat1, lng1, lat2, lng2): number`, `locationService.calculateETA(distanceKm, speedKmh): number` from `../modules/location/services/locationService` (existing, already used by `SafeRouteScreen.tsx`).
- Produces: `FamilyLiveTrackingScreen` now accepts `destinationName?: string`, `destinationLat?: number`, `destinationLng?: number` props — Task 4 passes these from `SafeRouteScreen`.
- Produces: `RootStackParamList["FamilyLiveTracking"]` extended to `{ sessionId?: string; destinationName?: string; destinationLat?: number; destinationLng?: number } | undefined` — Task 4's `onOpenFamilyTracking` call site relies on this shape.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/screens/FamilyLiveTrackingScreen.test.tsx`:

```tsx
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

    render(
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

    render(<FamilyLiveTrackingScreen sessionId="trk_2" />);

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

    render(<FamilyLiveTrackingScreen sessionId="trk_3" />);
    await waitFor(() => expect(mockedGetLiveLocation).toHaveBeenCalled());

    fireEvent.press(screen.getByText("I'm Safe — Stop Live Location"));

    await waitFor(() => expect(mockedStop).toHaveBeenCalledWith("trk_3"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx jest src/screens/FamilyLiveTrackingScreen.test.tsx -v --forceExit`
Expected: FAIL — screen still polls `API_BASE_URL`/fetch directly, no "Location signal lost" text exists, props aren't accepted.

- [ ] **Step 3: Implement**

In `frontend/src/screens/FamilyLiveTrackingScreen.tsx`:

Replace the imports (lines 1-22) — remove `import { API_BASE_URL } from "../api/config";`, add:

```ts
import { getLiveLocation, stopLiveLocationSharing } from "../services/liveLocationSharing";
import { locationService } from "../modules/location/services/locationService";
```

Replace the component signature and state block (lines 24-43):

```tsx
export function FamilyLiveTrackingScreen({
  sessionId = "trk_demo",
  destinationName = "Home · Nandi Layout",
  destinationLat = 12.985,
  destinationLng = 77.605,
  onBack,
  onEmergencyAlert,
}: {
  sessionId?: string;
  destinationName?: string;
  destinationLat?: number;
  destinationLng?: number;
  onBack?: () => void;
  onEmergencyAlert?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Priya Sharma");
  const [userLocation, setUserLocation] = useState<LatLng>({ lat: 12.9716, lng: 77.5946 });
  const [distanceKm, setDistanceKm] = useState(3.4);
  const [etaMinutes, setEtaMinutes] = useState(14);
  const [batteryLevel, setBatteryLevel] = useState(88);
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [signalLost, setSignalLost] = useState(false);
  const [userConfirmedSafe, setUserConfirmedSafe] = useState(false);
  const destinationLocation: LatLng = { lat: destinationLat, lng: destinationLng };
```

Replace the `useEffect` fetch loop (lines ~45-82):

```tsx
  // Fetch live tracking feed from Firebase RTDB every 4 seconds
  useEffect(() => {
    let interval: any;

    const fetchLiveFeed = async () => {
      if (userConfirmedSafe) return;

      const data = await getLiveLocation(sessionId);
      if (data) {
        setSignalLost(false);
        setUserName(data.userName || "User");
        setUserLocation({ lat: data.lat, lng: data.lng });
        setBatteryLevel(data.batteryLevel ?? 85);
        setIsLiveActive(data.active);
        setLastUpdated(
          new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        );

        const remDist = locationService.calculateDistanceKm(
          data.lat,
          data.lng,
          destinationLocation.lat,
          destinationLocation.lng
        );
        setDistanceKm(remDist);
        setEtaMinutes(locationService.calculateETA(remDist, 15));
      } else {
        setSignalLost(true);
      }
      setLoading(false);
    };

    fetchLiveFeed();
    interval = setInterval(fetchLiveFeed, 4000);

    return () => clearInterval(interval);
  }, [sessionId, userConfirmedSafe]);
```

Replace `handleStopLiveTracking` (lines ~84-95):

```tsx
  const handleStopLiveTracking = async () => {
    setUserConfirmedSafe(true);
    setIsLiveActive(false);
    await stopLiveLocationSharing(sessionId);
  };
```

Update the last-sync text (lines ~122-124) to show signal-lost state instead of always "Last updated":

```tsx
          <Text style={styles.userInfoTitle}>Tracking {userName}</Text>
          <Text style={styles.lastSyncText}>
            {signalLost ? `Location signal lost — last seen at ${lastUpdated}` : `Last updated: ${lastUpdated}`}
          </Text>
```

The `destinationName`/`destinationLocation` references further down in the JSX (map component, detail card) already read from the values set above — no other JSX changes needed, since the prop names match the removed local `useState` names.

In `frontend/src/navigation/RootStack.tsx`, change the `FamilyLiveTracking` entry in `RootStackParamList` (line 98):

```ts
  FamilyLiveTracking: {
    sessionId?: string;
    destinationName?: string;
    destinationLat?: number;
    destinationLng?: number;
  } | undefined;
```

And update `FamilyLiveTrackingRouteScreen` (lines ~492-499) to forward the new params, keeping its existing `onBack`/other props unchanged:

```tsx
function FamilyLiveTrackingRouteScreen({ navigation, route }: P<"FamilyLiveTracking">) {
  return (
    <FamilyLiveTrackingScreen
      sessionId={route.params?.sessionId}
      destinationName={route.params?.destinationName}
      destinationLat={route.params?.destinationLat}
      destinationLng={route.params?.destinationLng}
      onBack={() => navigation.goBack()}
```

(Leave any lines after `onBack` in that block exactly as they already are.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx jest src/screens/FamilyLiveTrackingScreen.test.tsx -v --forceExit`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/screens/FamilyLiveTrackingScreen.tsx frontend/src/screens/FamilyLiveTrackingScreen.test.tsx frontend/src/navigation/RootStack.tsx
```

---

### Task 4: `SafeRouteScreen.tsx` — single tracking implementation, real auto-SMS gating

**Files:**
- Modify: `frontend/src/screens/SafeRouteScreen.tsx`
- Modify: `frontend/src/components/app/GeofenceSettingsModal.tsx` (add `testID` to the auto-SMS switch)
- Modify: `frontend/src/navigation/RootStack.tsx:607` (forward new `onOpenFamilyTracking` params)
- Test: `frontend/src/screens/SafeRouteScreen.test.tsx` (new)

**Interfaces:**
- Consumes: `startLiveLocationSharing(sessionId, userName?): Promise<string>`, `stopLiveLocationSharing(sessionId): Promise<void>` from `../services/liveLocationSharing` (Task 1, signatures unchanged from before this plan).
- Produces: `onOpenFamilyTracking?: (params: { sessionId: string; destinationName: string; destinationLat: number; destinationLng: number }) => void` — replaces the old `() => void` signature. `RootStack.tsx`'s `SafeRoute` screen registration is the only caller and is updated in this task.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/screens/SafeRouteScreen.test.tsx`:

```tsx
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
    render(<SafeRouteScreen state="results" />);

    fireEvent.press(screen.getByText("Start Safe Navigation"));

    await waitFor(() => expect(mockedStart).toHaveBeenCalled());
  });

  it("sends the tracking SMS when autoSendSms is on (the default)", async () => {
    render(<SafeRouteScreen state="results" />);

    fireEvent.press(screen.getByText("Start Safe Navigation"));

    await waitFor(() => expect(mockedSendSms).toHaveBeenCalled());
  });

  it("skips the SMS when autoSendSms is switched off", async () => {
    render(<SafeRouteScreen state="results" />);

    fireEvent.press(screen.getByText(/Zone Settings/));
    fireEvent(screen.getByTestId("autoSendSmsSwitch"), "valueChange", false);
    fireEvent.press(screen.getByText("Save & Apply Settings"));

    fireEvent.press(screen.getByText("Start Safe Navigation"));

    await waitFor(() => expect(mockedStart).toHaveBeenCalled());
    expect(mockedSendSms).not.toHaveBeenCalled();
  });

  it("stops live location sharing when navigation ends", async () => {
    render(<SafeRouteScreen state="results" />);

    fireEvent.press(screen.getByText("Start Safe Navigation"));
    await waitFor(() => expect(mockedStart).toHaveBeenCalled());

    fireEvent.press(screen.getByText("End Navigation"));

    await waitFor(() => expect(mockedStop).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx jest src/screens/SafeRouteScreen.test.tsx -v --forceExit`
Expected: FAIL — `startLiveLocationSharing`/`stopLiveLocationSharing` not called (screen still calls the dead `/gps/session/start` fetch instead), `autoSendSmsSwitch` testID doesn't exist yet.

- [ ] **Step 3: Implement**

In `frontend/src/components/app/GeofenceSettingsModal.tsx`, add a `testID` to the auto-SMS `Switch` (in the "Auto-SMS Tracking Link" toggle row, around line 90):

```tsx
              <Switch
                testID="autoSendSmsSwitch"
                value={config.autoSendSms}
                onValueChange={(val) => updateSetting("autoSendSms", val)}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
```

In `frontend/src/screens/SafeRouteScreen.tsx`:

Remove `import { API_BASE_URL } from "../api/config";` (line 32) — no longer used after this task.
Add: `import { startLiveLocationSharing, stopLiveLocationSharing } from "../services/liveLocationSharing";`

Change the `onOpenFamilyTracking` prop type (lines 90, 95):

```tsx
  onOpenFamilyTracking,
}: {
  state?: SafeRouteState;
  onBack?: () => void;
  onStartNavigation?: () => void;
  onOpenFamilyTracking?: (params: {
    sessionId: string;
    destinationName: string;
    destinationLat: number;
    destinationLng: number;
  }) => void;
}) {
```

Delete the "Ping backend GPS endpoint" block at the end of the `locationService.startLocationTracking` callback (lines ~264-275) — keep everything above it in that callback (position/distance/ETA/geofence updates) unchanged, just remove:

```tsx
      // Ping backend GPS endpoint
      fetch(`${API_BASE_URL}/api/v1/gps/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "usr_active",
          session_id: trackingSessionId,
          latitude: newPos.lat,
          longitude: newPos.lng,
          battery_level: 90,
        }),
      }).catch(() => {});
```

Replace `handleStartNavigation` (lines ~286-342) in full:

```tsx
  const handleStartNavigation = async () => {
    setScreenState("navigating");
    if (externalStartNav) externalStartNav();

    const sessionId = `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setTrackingSessionId(sessionId);
    await startLiveLocationSharing(sessionId);

    if (!geofenceConfig.autoSendSms) {
      setSmsSentStatus("Live tracking active. Auto-SMS is turned off in Zone Settings.");
      return;
    }

    try {
      const contacts = await contactStorageService.getStoredEmergencyContacts();
      const trackingUrl = getPublicTrackingUrl(sessionId);
      const smsMessage = `🛡️ Aegis Safety Live Tracking: I have started navigation to ${destinationName}. Track my real-time location live on map: ${trackingUrl}`;

      if (contacts && contacts.length > 0) {
        const phoneNumbers = contacts.map((c) => c.phone).filter(Boolean);
        if (phoneNumbers.length > 0) {
          const sent = await sendSilentSms(phoneNumbers, smsMessage);
          if (sent) {
            setSmsSentStatus(`Live tracking link sent via SMS to ${phoneNumbers.length} emergency contact(s)!`);
          } else {
            const firstPhone = phoneNumbers[0];
            const smsUrl = `sms:${firstPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(smsMessage)}`;
            Linking.canOpenURL(smsUrl).then((supported) => {
              if (supported) Linking.openURL(smsUrl);
            });
            setSmsSentStatus(`Live tracking SMS prepared for ${contacts[0].name} (${firstPhone})`);
          }
        }
      } else {
        setSmsSentStatus(`Live tracking link generated: ${trackingUrl}`);
      }
    } catch (err) {
      setSmsSentStatus("Live tracking active.");
    }
  };

  const handleEndNavigation = async () => {
    if (trackingSessionId) {
      await stopLiveLocationSharing(trackingSessionId);
    }
    setScreenState("results");
  };
```

Update the "End Navigation" button (line ~566) to call the new handler:

```tsx
              <AppButton
                variant="secondary"
                leading={<Square size={16} color={colors.foreground} />}
                onPress={handleEndNavigation}
              >
                End Navigation
              </AppButton>
```

Update the "Family Share" button (lines ~556-561) to pass the new params:

```tsx
            {onOpenFamilyTracking && (
              <Pressable
                style={styles.secondaryActionBtn}
                onPress={() =>
                  onOpenFamilyTracking({
                    sessionId: trackingSessionId ?? "trk_demo",
                    destinationName,
                    destinationLat: destination.lat,
                    destinationLng: destination.lng,
                  })
                }
              >
                <Users size={18} color={colors.foreground} />
                <Text style={styles.secondaryBtnText}>Family Share</Text>
              </Pressable>
            )}
```

In `frontend/src/navigation/RootStack.tsx`, update the `SafeRoute` screen's `onOpenFamilyTracking` wiring (line ~607):

```tsx
              onOpenFamilyTracking={(params) => navigation.navigate("FamilyLiveTracking", params)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx jest src/screens/SafeRouteScreen.test.tsx -v --forceExit`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/screens/SafeRouteScreen.tsx frontend/src/screens/SafeRouteScreen.test.tsx frontend/src/components/app/GeofenceSettingsModal.tsx frontend/src/navigation/RootStack.tsx
```

---

### Task 5: Backend `gps.py` — remove orphaned schemas

**Files:**
- Modify: `backend/app/schemas/gps.py`
- Test: `backend/tests/test_gps_schemas.py` (new)

**Interfaces:**
- Removes: `LocationPingRequest`, `LocationPingResponse`, `TrackingSessionCreateRequest`, `TrackingSessionResponse`, `FamilyLiveTrackingData` — confirmed via repo-wide grep that nothing outside `gps.py` itself imports these names.
- Keeps: `GeofenceCheckRequest`, `GeofenceCheckResponse` — used by `backend/app/api/v1/gps/router.py`'s working `/geofence/check` endpoint, untouched.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_gps_schemas.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas import gps


def test_geofence_schemas_still_present():
    assert hasattr(gps, "GeofenceCheckRequest")
    assert hasattr(gps, "GeofenceCheckResponse")


def test_orphaned_tracking_schemas_removed():
    # These described /api/v1/gps/ping and /api/v1/gps/session/* endpoints that were
    # never implemented (see docs/superpowers/specs/2026-08-23-live-location-wiring-design.md,
    # Decision 1) - the frontend now talks to Firebase RTDB directly instead.
    for name in (
        "LocationPingRequest",
        "LocationPingResponse",
        "TrackingSessionCreateRequest",
        "TrackingSessionResponse",
        "FamilyLiveTrackingData",
    ):
        assert not hasattr(gps, name), f"{name} should have been removed"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_gps_schemas.py -v`
Expected: FAIL on `test_orphaned_tracking_schemas_removed` — the classes still exist.

- [ ] **Step 3: Implement**

Replace the full contents of `backend/app/schemas/gps.py`:

```python
from pydantic import BaseModel, Field
from typing import Optional

class GeofenceCheckRequest(BaseModel):
    current_lat: float
    current_lng: float
    center_lat: float
    center_lng: float
    radius_meters: float = 500.0

class GeofenceCheckResponse(BaseModel):
    is_inside: bool
    distance_meters: float
    zone_name: Optional[str] = "Safe Zone"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_gps_schemas.py -v`
Expected: PASS, both tests.

Also run the full backend test suite to confirm no other file broke:

Run: `cd backend && venv\Scripts\python -m pytest -v`
Expected: PASS (same results as before this change, plus the 2 new tests).

- [ ] **Step 5: Stage**

```bash
git add backend/app/schemas/gps.py backend/tests/test_gps_schemas.py
```

---

### Task 6: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend test suite**

Run: `cd frontend && npx jest --forceExit`
Expected: PASS, zero regressions, including the 4 new test files from Tasks 1-4. (`HistoryScreens.test.tsx`/`ProfileScreens.test.tsx` are pre-existing flaky-in-full-suite-only tests per the Module 18/19 ledgers — `--forceExit` is required for exactly this reason.)

- [ ] **Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean, zero errors.

- [ ] **Step 3: Run the full backend test suite**

Run: `cd backend && venv\Scripts\python -m pytest -v`
Expected: PASS, zero regressions.

- [ ] **Step 4: Manual smoke check (if a device/emulator is available)**

Not required for this plan to be considered complete (no test infra for this exists in-repo), but if you have an emulator handy: start a Safe Route navigation, confirm `startLiveLocationSharing` fires (check console log), open the "Family Share" screen and confirm it shows a real, moving position rather than a static/fabricated one within ~4-8 seconds.

- [ ] **Step 5: Report**

Summarize: tests run, pass/fail counts, any deviations from the plan and why. Leave everything staged (not committed) per the standing project rule — the owner reviews `git diff --cached` and commits.
