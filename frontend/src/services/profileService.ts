import { auth, getAuthHeader } from "./firebaseConfig";
import { API_BASE_URL } from "../api/config";

export interface UserProfile {
  id?: string;
  firebase_uid: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  blood_group?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  medical_notes?: string | null;
  created_at?: string;
}

let activeProfileState: UserProfile | null = null;
let activeProfileUid: string | null = null;

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function phonesMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return true;
  const da = normalizePhone(a);
  const db = normalizePhone(b);
  return da === db || da.endsWith(db) || db.endsWith(da);
}

export function setCurrentProfile(profile: UserProfile | null): void {
  activeProfileState = profile;
  activeProfileUid = profile?.firebase_uid ?? null;
}

export function clearCurrentProfile(): void {
  activeProfileState = null;
  activeProfileUid = null;
}

// Synchronous read of whatever profile was last loaded via getMyProfile()/saveProfile() —
// for call sites that need a display name/detail right now and can't await a network call.
export function getCachedProfile(): UserProfile | null {
  return activeProfileState;
}

export async function getMyProfile(forceRefreshToken = false): Promise<UserProfile | null> {
  const firebaseUser = auth.currentUser;

  if (firebaseUser) {
    if (activeProfileUid && activeProfileUid !== firebaseUser.uid) {
      clearCurrentProfile();
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/profile/${firebaseUser.uid}`, {
        headers: await getAuthHeader(forceRefreshToken),
      });
      if (response.ok) {
        const profile: UserProfile = await response.json();
        if (!phonesMatch(profile.phone, firebaseUser.phoneNumber)) {
          console.warn("Profile phone does not match authenticated user — not using stale data.");
          clearCurrentProfile();
          return null;
        }
        activeProfileState = profile;
        activeProfileUid = firebaseUser.uid;
        return profile;
      }
      if (response.status === 404) {
        clearCurrentProfile();
        return null;
      }
    } catch (err) {
      console.warn("Failed to retrieve profile from backend:", err);
    }
    return null;
  }

  // Password login path — profile was set from /auth/login response
  return activeProfileState;
}

export async function saveProfile(profileData: Partial<UserProfile>): Promise<UserProfile | null> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error("No authenticated Firebase user found.");

  const fullData = {
    firebase_uid: firebaseUser.uid,
    phone: firebaseUser.phoneNumber || profileData.phone || null,
    ...profileData,
  };

  const response = await fetch(`${API_BASE_URL}/users/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
    body: JSON.stringify(fullData),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to save profile (${response.status}): ${body}`);
  }

  const saved: UserProfile = await response.json();
  activeProfileState = saved;
  activeProfileUid = saved.firebase_uid;
  return saved;
}

export function parseMedicalNotes(notes?: string | null): { allergies: string; conditions: string; notes: string } {
  const result = { allergies: "", conditions: "", notes: "" };
  if (!notes) return result;

  for (const part of notes.split(" · ")) {
    if (part.startsWith("Allergies: ")) result.allergies = part.slice("Allergies: ".length);
    else if (part.startsWith("Conditions: ")) result.conditions = part.slice("Conditions: ".length);
    else if (part.startsWith("Notes: ")) result.notes = part.slice("Notes: ".length);
    else result.notes = result.notes ? `${result.notes} · ${part}` : part;
  }
  return result;
}

export function formatMedicalNotes(allergies: string, conditions: string, notes: string): string | null {
  const parts: string[] = [];
  if (allergies.trim()) parts.push(`Allergies: ${allergies.trim()}`);
  if (conditions.trim()) parts.push(`Conditions: ${conditions.trim()}`);
  if (notes.trim()) parts.push(`Notes: ${notes.trim()}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
