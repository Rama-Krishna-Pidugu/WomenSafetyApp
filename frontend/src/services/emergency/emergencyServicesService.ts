/**
 * emergencyServicesService.ts
 *
 * Module 13 — Nearby Emergency Services Layer
 *
 * Provides normalized, distance-sorted POI queries for:
 * Police, Hospitals, Ambulance, Women Support, NGOs, and Public Transport.
 * Features Haversine distance calculations, caching, and clean fallback.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EmergencySearchOptions,
  EmergencyServiceCategory,
  NormalizedEmergencyService,
} from "./emergencyServiceTypes";
import { OverpassService, RawOsmElement } from "./overpassService";

const CACHE_STORAGE_KEY = "@aegis_emergency_services_cache_v1";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  latitude: number;
  longitude: number;
  timestamp: number;
  services: NormalizedEmergencyService[];
}

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

class EmergencyServicesServiceClass {
  private memoryCache: Map<string, CacheEntry> = new Map();

  public clearCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Main entry point to locate nearby emergency services.
   */
  public async getNearbyServices(
    options: EmergencySearchOptions
  ): Promise<NormalizedEmergencyService[]> {
    const { latitude, longitude, radiusMeters = 5000, category, forceRefresh = false } = options;

    const cacheKey = `${latitude.toFixed(2)}_${longitude.toFixed(2)}_${category || "ALL"}`;

    // 1. Check cache if not forcing refresh
    if (!forceRefresh) {
      const cached = await this.getCachedResults(cacheKey, latitude, longitude);
      if (cached && cached.length > 0) {
        return this.filterAndSort(cached, latitude, longitude, category);
      }
    }

    try {
      // 2. Fetch from Overpass API
      const rawResults = await OverpassService.queryEmergencyPois(
        latitude,
        longitude,
        radiusMeters,
        category
      );

      if (rawResults.length > 0) {
        const normalized = this.normalizeOsmResults(rawResults, latitude, longitude);
        await this.setCachedResults(cacheKey, latitude, longitude, normalized);
        return this.filterAndSort(normalized, latitude, longitude, category);
      }
    } catch (err) {
      console.warn("[EmergencyServicesService] Overpass query failed:", err);
    }

    // 3. Fallback to cached or local offline knowledge
    const fallback = await this.getCachedResults(cacheKey, latitude, longitude, true);
    return this.filterAndSort(fallback || [], latitude, longitude, category);
  }

  private normalizeOsmResults(
    items: Array<{ element: RawOsmElement; inferredCategory: EmergencyServiceCategory }>,
    userLat: number,
    userLon: number
  ): NormalizedEmergencyService[] {
    const seenIds = new Set<string>();
    const normalizedList: NormalizedEmergencyService[] = [];

    for (const { element, inferredCategory } of items) {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;

      if (lat == null || lon == null) continue;

      const id = `${element.type}-${element.id}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const tags = element.tags || {};
      const name =
        tags.name ||
        tags["name:en"] ||
        this.getDefaultCategoryName(inferredCategory, tags);

      // Build human-friendly address string from OSM address tags
      const addressParts = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:suburb"] || tags["addr:district"],
        tags["addr:city"],
      ].filter(Boolean);
      const address =
        addressParts.length > 0
          ? addressParts.join(", ")
          : tags.description || tags.operator || undefined;

      const phone = tags.phone || tags["contact:phone"] || tags["contact:mobile"] || undefined;
      const distanceKm = calculateHaversineDistanceKm(userLat, userLon, lat, lon);

      normalizedList.push({
        id,
        name,
        type: inferredCategory,
        latitude: lat,
        longitude: lon,
        address,
        phone,
        distanceKm,
        isOpen: tags.opening_hours === "24/7" ? true : undefined,
        source: "openstreetmap",
        metadata: {
          osmId: element.id,
          osmType: element.type,
          operator: tags.operator,
          website: tags.website || tags["contact:website"],
          wheelchair: tags.wheelchair,
          openingHours: tags.opening_hours,
        },
      });
    }

    return normalizedList;
  }

  private filterAndSort(
    services: NormalizedEmergencyService[],
    userLat: number,
    userLon: number,
    category?: EmergencyServiceCategory
  ): NormalizedEmergencyService[] {
    let result = services;
    if (category) {
      result = result.filter((s) => s.type === category);
    }

    // Recompute distances from current user position and sort nearest-first
    return result
      .map((s) => ({
        ...s,
        distanceKm: calculateHaversineDistanceKm(userLat, userLon, s.latitude, s.longitude),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  private getDefaultCategoryName(category: EmergencyServiceCategory, tags: Record<string, string>): string {
    switch (category) {
      case "POLICE":
        return tags.operator ? `${tags.operator} Police Station` : "Police Station";
      case "HOSPITAL":
        return tags.healthcare === "clinic" ? "Medical Clinic" : "Hospital / Emergency Care";
      case "AMBULANCE":
        return "Ambulance Station";
      case "WOMEN_SUPPORT":
        return "Women's Help & Support Center";
      case "NGO":
        return "Community Support NGO";
      case "PUBLIC_TRANSPORT":
        return tags.railway ? "Metro / Transit Station" : "Bus Station";
      default:
        return "Emergency Service";
    }
  }

  private async getCachedResults(
    cacheKey: string,
    userLat: number,
    userLon: number,
    allowExpired = false
  ): Promise<NormalizedEmergencyService[] | null> {
    const memory = this.memoryCache.get(cacheKey);
    const now = Date.now();

    if (memory) {
      const distanceMovedKm = calculateHaversineDistanceKm(
        userLat,
        userLon,
        memory.latitude,
        memory.longitude
      );
      if (distanceMovedKm < 0.5 && (allowExpired || now - memory.timestamp < CACHE_TTL_MS)) {
        return memory.services;
      }
    }

    try {
      const raw = await AsyncStorage.getItem(`${CACHE_STORAGE_KEY}_${cacheKey}`);
      if (!raw) return null;
      const parsed: CacheEntry = JSON.parse(raw);
      if (allowExpired || now - parsed.timestamp < CACHE_TTL_MS) {
        this.memoryCache.set(cacheKey, parsed);
        return parsed.services;
      }
    } catch {
      // Non-fatal cache read error
    }

    return null;
  }

  private async setCachedResults(
    cacheKey: string,
    latitude: number,
    longitude: number,
    services: NormalizedEmergencyService[]
  ): Promise<void> {
    const entry: CacheEntry = {
      latitude,
      longitude,
      timestamp: Date.now(),
      services,
    };
    this.memoryCache.set(cacheKey, entry);
    try {
      await AsyncStorage.setItem(
        `${CACHE_STORAGE_KEY}_${cacheKey}`,
        JSON.stringify(entry)
      );
    } catch {
      // Non-fatal cache write error
    }
  }
}

export const emergencyServicesService = new EmergencyServicesServiceClass();
