# Live Location Sharing — Wiring Design

**Date:** 2026-08-23
**Branch:** `Integration`
**Status:** Approved for planning

## Background

Harshith (`GuntukaHarshith`) merged a large live-location-sharing feature into
`Integration`/`main` via commit `2bfb3e0` (PR #12/#7, `origin/SOSsmsService`). A read-only
audit (2026-08-23) found the feature is mostly UI and one working data path, with the rest
calling backend endpoints that don't exist:

- `backend/app/api/v1/gps/router.py` implements exactly one endpoint, `POST /geofence/check`.
  It does **not** implement `session/start`, `session/{id}` (GET), `session/{id}/stop`, or
  `ping` — all four are called by frontend code and 404 in production.
- `frontend/src/services/liveLocationSharing.ts` writes location two ways every 4.5s: a direct
  `PUT` to Firebase Realtime Database (works) and a `POST /api/v1/gps/ping` (404s).
- `frontend/src/screens/FamilyLiveTrackingScreen.tsx` polls the missing `GET
  /api/v1/gps/session/{id}` and, on failure, **silently fabricates random-walk coordinates**
  instead of showing real or absent data.
- `frontend/src/screens/SafeRouteScreen.tsx` runs a second, independent GPS-push loop (not
  `liveLocationSharing.ts`) that also only calls the missing backend endpoints — it never
  writes to Firebase RTDB at all, so a SafeRoute journey (as opposed to an SOS trigger) never
  produced real data on the one path that does work (`web/track.html`).
- `frontend/src/utils/trackingUrl.ts` hardcodes a dead `loca.lt` dev-tunnel URL as the public
  share link.
- `GeofenceSettingsModal`'s "Auto-SMS Tracking Link" toggle (`autoSendSms`) is read into
  `SafeRouteScreen`'s local state but never checked — the SMS send it's supposed to gate fires
  unconditionally.
- `backend/app/api/v1/gps/router.py`'s `gps.py` schemas (`LocationPingRequest`,
  `TrackingSessionCreateRequest`, `TrackingSessionResponse`, `FamilyLiveTrackingData`) describe
  endpoints that were scaffolded but never implemented — consistent with a note in this
  project's Module 19 ledger about a "disconnected SQLite" pattern in this exact area (Module
  4's `/gps/ping` stub).
- `backend/app` confirmed as the service actually deployed to Lambda (`Dockerfile.lambda`
  copies `app/`), and confirmed to use Supabase (not SQLite) as its real data store via a
  repository pattern (e.g. `emergency_contact_repository.py`) — the `women_safety.db` SQLite
  files were dead weight, already untracked from git in a separate cleanup.

`FamilyLiveTrackingScreen` is the **traveler's own** in-app view (it has "I'm Safe — Stop
Live Location" and "Trigger Emergency Assistance" actions) — not a family member's screen. The
family member's view is the public web page (`web/track.html`), opened via a shared link,
outside the app.

## Decisions (confirmed with owner, 2026-08-23)

1. **Data flow:** Firebase Realtime Database (`tracking_sessions/{sessionId}`) becomes the
   single live-position data path, used by both the mobile app and the public web page. The
   `/api/v1/gps/ping` and `/api/v1/gps/session/*` REST calls are removed rather than
   implemented — RTDB already works end-to-end for `web/track.html`, and building a parallel
   Supabase-backed session store to match the scaffolded-but-unused `gps.py` schemas would
   duplicate that working path for no benefit. `/api/v1/geofence/check` is untouched.
2. **Public tracking URL:** `trackingUrl.ts` is wired to expect a Firebase Hosting URL (env-
   configurable, with a placeholder), but **the owner deploys `firebase deploy --only
   hosting` themselves** — this spec does not perform that deploy.
3. **Auto-SMS:** Reuse the existing `sendSilentSms` call already present in
   `SafeRouteScreen.handleStartNavigation` — gate it behind `geofenceConfig.autoSendSms`
   instead of adding a new send mechanism.
4. **RTDB security:** Left as-is. Current rules (`firebase-database-rules.json`) allow
   unauthenticated writes to any session while `active: true`, and reads are fully public —
   security rests entirely on the session ID being unguessable. This was already shipped and
   graded as part of Harshith's merged work; tightening it is out of scope for this change and
   is recorded here as a known limitation, not an oversight.

## Architecture

```
liveLocationSharing.ts (single implementation)
  started by: sosOrchestratorService.ts (SOS trigger)
          and: SafeRouteScreen.tsx (manual "start navigation")
       |
       | write, 4.5s throttle (PUT)
       v
Firebase Realtime DB: tracking_sessions/{sessionId}
  { lat, lng, updatedAt, userName, batteryLevel, active }
       |
       | read (GET, polled every 4s / on page load)
       v
  +-----------------------------+     +----------------------------+
  | FamilyLiveTrackingScreen    |     | web/track.html              |
  | (mobile, traveler's own     |     | (family member, via shared  |
  | view - has Stop/SOS actions)|     | link, outside the app)      |
  +-----------------------------+     +----------------------------+
```

Trip metadata (`destinationName`, `destinationLat/Lng`) is known client-side by
`SafeRouteScreen` at the moment it starts a session, so it is passed directly as navigation
params to `FamilyLiveTrackingScreen` rather than round-tripped through any backend — RTDB only
ever needs to carry the fields that must sync across devices/processes (position, battery,
active flag).

## Component changes

### 1. `frontend/src/services/liveLocationSharing.ts`
- Remove the `POST /api/v1/gps/ping` call in `pushLocationUpdate` (lines ~151-168).
- Remove the `POST /api/v1/gps/session/{id}/stop` call in `stopLiveLocationSharing`
  (lines ~108-115).
- RTDB `PUT` write path is unchanged (already correct).
- Add an exported `getLiveLocation(sessionId): Promise<LiveLocationData | null>` that does a
  `GET` against the same RTDB URL pattern the write uses, for `FamilyLiveTrackingScreen` to
  call — keeps the RTDB URL construction in one place instead of duplicating the
  `https://women-safety-3d446-default-rtdb.firebaseio.com/...` string in a second file.

### 2. `frontend/src/screens/FamilyLiveTrackingScreen.tsx`
- Replace the `fetch(${API_BASE_URL}/api/v1/gps/session/${sessionId})` poll with
  `liveLocationSharing.getLiveLocation(sessionId)`, still on a 4s interval.
- Remove the fake random-walk fallback (lines ~67-72). On fetch failure or no data yet, set an
  explicit `signalLost` state and render "Location signal lost — last seen at {time}" instead
  of moving the pin. Never synthesize coordinates.
- Replace the `POST /api/v1/gps/session/{id}/stop` call in `handleStopLiveTracking` with
  `liveLocationSharing.stopLiveLocationSharing(sessionId)`.
- Accept `destinationName`, `destinationLat`, `destinationLng` as optional props (falling back
  to the existing hardcoded demo values when absent, so the screen still renders sensibly when
  opened without params, e.g. during manual QA).

### 3. `frontend/src/screens/SafeRouteScreen.tsx`
- Delete the inline GPS-push effect block (lines ~233-276) and the `/api/v1/gps/session/start`
  call in `handleStartNavigation` (lines ~292-312).
- On `handleStartNavigation`: generate `sessionId` locally (`` `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` ``),
  call `startLiveLocationSharing(sessionId, userName)`, store it in the existing
  `trackingSessionId` state.
- On navigation stop / unmount: call `stopLiveLocationSharing(trackingSessionId)`.
- Wrap the existing `sendSilentSms(...)` call (lines ~314-341) in
  `if (geofenceConfig.autoSendSms) { ... }`; when the toggle is off, skip straight to setting
  `smsSentStatus` to a "tracking active, SMS disabled" message so the UI doesn't look stuck.
- `onOpenFamilyTracking` (prop, called from `RootStack.tsx`) needs to receive
  `trackingSessionId`, `destinationName`, `destination.lat`, `destination.lng` — signature
  changes from `() => void` to accept these as arguments.

### 4. `frontend/src/navigation/RootStack.tsx`
- Extend `RootStackParamList.FamilyLiveTracking` from `{ sessionId?: string } | undefined` to
  `{ sessionId?: string; destinationName?: string; destinationLat?: number; destinationLng?:
  number } | undefined`.
- Update the `SafeRoute` screen's `onOpenFamilyTracking` wiring (line ~607) to forward the new
  args into `navigation.navigate("FamilyLiveTracking", { ... })`.
- Update `FamilyLiveTrackingRouteScreen` (line ~492) to pass the new route params through as
  props.

### 5. `frontend/src/utils/trackingUrl.ts`
- Replace the hardcoded `https://aegis-women-safety.loca.lt` with a constant read from
  `EXPO_PUBLIC_TRACKING_BASE_URL` (new env var, added to `frontend/.env.example` with a
  placeholder and a comment), falling back to a clearly-labeled placeholder string if unset, so
  a missing env var fails loudly (visibly wrong URL) rather than silently pointing at a dead
  tunnel.
- Leave a code comment with the exact deploy command (`firebase deploy --only hosting`) and a
  note that the resulting `https://<project>.web.app` URL is what belongs in
  `EXPO_PUBLIC_TRACKING_BASE_URL`.

### 6. Backend `backend/app/api/v1/gps/router.py` and `backend/app/schemas/gps.py`
- Keep `POST /geofence/check` and its schemas (`GeofenceCheckRequest`/`Response`) — unrelated,
  already correct, already called successfully by `SafeRouteScreen`'s geofence check.
- Remove `LocationPingRequest`, `LocationPingResponse`, `TrackingSessionCreateRequest`,
  `TrackingSessionResponse`, `FamilyLiveTrackingData` from `gps.py` — they described endpoints
  that are being deliberately not built (Decision 1), and leaving them in place would
  misrepresent what the backend actually does to the next person reading this file.

## Error handling

- RTDB write failures in `liveLocationSharing.ts`: already best-effort/non-blocking
  (`.catch(err => console.warn(...))`) — unchanged.
- RTDB read failures / no data yet in `FamilyLiveTrackingScreen`: explicit "signal lost" UI
  state, never fabricated coordinates (see Component change #2).
- `sendSilentSms` failure in `SafeRouteScreen`: existing SMS-app-fallback behavior
  (`Linking.openURL` with a pre-filled `sms:` URL) is unchanged, still reachable when
  `autoSendSms` is on and the silent send fails.
- Missing `EXPO_PUBLIC_TRACKING_BASE_URL`: falls back to a placeholder string that is
  obviously not a real URL (e.g. `https://SET_EXPO_PUBLIC_TRACKING_BASE_URL.example/track.html`)
  rather than a URL that looks plausible but is dead, so a misconfiguration is obvious in
  testing rather than silently broken like the current `loca.lt` link.

## Testing

Following this repo's established TDD convention (per Module 18/19 ledgers), each new/changed
unit gets tests written first:

- `liveLocationSharing.test.ts` (new): `getLiveLocation` fetch-mocked success/failure/no-data
  cases; confirms `pushLocationUpdate` no longer calls the removed `/gps/ping` endpoint.
- `FamilyLiveTrackingScreen.test.tsx` (new): renders with injected `getLiveLocation` mock;
  verifies signal-lost state on failure instead of coordinate drift; verifies stop button calls
  `stopLiveLocationSharing`.
- `SafeRouteScreen.test.tsx` (new, or extend if one exists — none found as of this audit):
  verifies `autoSendSms: false` skips `sendSilentSms`; verifies `autoSendSms: true` still calls
  it (regression guard for the bug found during this audit, where the toggle was previously
  ignored); verifies `startLiveLocationSharing`/`stopLiveLocationSharing` are called instead of
  the removed inline fetches.
- `trackingUrl.test.ts` (new): verifies env-var URL construction and the placeholder fallback
  when unset.

No existing test files cover any of the four touched frontend files as of 2026-08-23 (checked
via file listing) — all of the above are new files.

## Out of scope

- Deploying Firebase Hosting (`firebase deploy --only hosting`) — owner runs this themselves.
- Hardening Firebase RTDB read/write security rules — documented above as a known, deliberately
  unaddressed limitation.
- `GeofenceSettingsModal`'s other toggles (`voiceAlerts`, `showPolice`/`showHospitals`/
  `showShelters`) — pre-existing, unrelated to this fix, untouched.
- Any change to `sosOrchestratorService.ts`'s use of `liveLocationSharing.ts` — it already
  calls `startLiveLocationSharing`/`stopLiveLocationSharing` correctly; only the SafeRoute path
  needs to start doing the same.
- Removing or rewriting `women_safety.db` further — already handled in a prior session (staged
  `git rm --cached`, not committed).
