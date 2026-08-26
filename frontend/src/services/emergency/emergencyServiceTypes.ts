/**
 * emergencyServiceTypes.ts
 *
 * Module 13 — Nearby Emergency Services Types
 */

export type EmergencyServiceCategory =
  | "POLICE"
  | "HOSPITAL"
  | "AMBULANCE"
  | "WOMEN_SUPPORT"
  | "NGO"
  | "PUBLIC_TRANSPORT";

export interface NormalizedEmergencyService {
  id: string;
  name: string;
  type: EmergencyServiceCategory;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  distanceKm: number;
  isOpen?: boolean;
  source: "openstreetmap" | "local_cache";
  metadata?: {
    osmId?: number | string;
    osmType?: "node" | "way" | "relation";
    operator?: string;
    website?: string;
    wheelchair?: string;
    openingHours?: string;
  };
}

export interface EmergencySearchOptions {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  category?: EmergencyServiceCategory;
  forceRefresh?: boolean;
}
