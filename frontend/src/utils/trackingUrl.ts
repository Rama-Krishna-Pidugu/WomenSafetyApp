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
