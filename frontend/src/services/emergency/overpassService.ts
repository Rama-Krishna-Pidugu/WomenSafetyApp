/**
 * overpassService.ts
 *
 * Module 13 — OpenStreetMap Overpass API Connector
 *
 * Queries OpenStreetMap data via Overpass QL for emergency POIs:
 * Police, Hospitals, Ambulance, Women Support, NGOs, and Public Transport.
 */

import { EmergencyServiceCategory } from "./emergencyServiceTypes";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const CATEGORY_FILTERS: Record<EmergencyServiceCategory, string> = {
  POLICE: `
    node["amenity"="police"](around:{{radius}},{{lat}},{{lon}});
    way["amenity"="police"](around:{{radius}},{{lat}},{{lon}});
  `,
  HOSPITAL: `
    node["amenity"="hospital"](around:{{radius}},{{lat}},{{lon}});
    node["amenity"="clinic"](around:{{radius}},{{lat}},{{lon}});
    way["amenity"="hospital"](around:{{radius}},{{lat}},{{lon}});
  `,
  AMBULANCE: `
    node["emergency"="ambulance_station"](around:{{radius}},{{lat}},{{lon}});
    way["emergency"="ambulance_station"](around:{{radius}},{{lat}},{{lon}});
  `,
  WOMEN_SUPPORT: `
    node["social_facility"="shelter"](around:{{radius}},{{lat}},{{lon}});
    node["social_facility:for"="woman"](around:{{radius}},{{lat}},{{lon}});
    node["amenity"="social_facility"](around:{{radius}},{{lat}},{{lon}});
    way["social_facility"="shelter"](around:{{radius}},{{lat}},{{lon}});
  `,
  NGO: `
    node["office"="ngo"](around:{{radius}},{{lat}},{{lon}});
    node["amenity"="community_centre"](around:{{radius}},{{lat}},{{lon}});
    way["office"="ngo"](around:{{radius}},{{lat}},{{lon}});
  `,
  PUBLIC_TRANSPORT: `
    node["highway"="bus_stop"](around:{{radius}},{{lat}},{{lon}});
    node["railway"="station"](around:{{radius}},{{lat}},{{lon}});
    node["railway"="subway_entrance"](around:{{radius}},{{lat}},{{lon}});
  `,
};

export interface RawOsmElement {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export class OverpassService {
  /**
   * Fetches POIs for a specific category or all emergency categories within a radius.
   */
  public static async queryEmergencyPois(
    lat: number,
    lon: number,
    radiusMeters: number = 4000,
    category?: EmergencyServiceCategory
  ): Promise<Array<{ element: RawOsmElement; inferredCategory: EmergencyServiceCategory }>> {
    const categoriesToQuery = category
      ? [category]
      : (["POLICE", "HOSPITAL", "AMBULANCE", "WOMEN_SUPPORT", "NGO", "PUBLIC_TRANSPORT"] as EmergencyServiceCategory[]);

    const results: Array<{ element: RawOsmElement; inferredCategory: EmergencyServiceCategory }> = [];

    for (const cat of categoriesToQuery) {
      const qlBody = CATEGORY_FILTERS[cat]
        .replace(/{{radius}}/g, String(radiusMeters))
        .replace(/{{lat}}/g, String(lat))
        .replace(/{{lon}}/g, String(lon));

      const query = `[out:json][timeout:15];(${qlBody});out center tags;`;

      try {
        const elements = await this.executeOverpassQuery(query);
        for (const el of elements) {
          results.push({ element: el, inferredCategory: cat });
        }
      } catch (err) {
        console.warn(`[OverpassService] Query failed for category ${cat}:`, err);
      }
    }

    return results;
  }

  private static async executeOverpassQuery(query: string): Promise<RawOsmElement[]> {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        if (data && Array.isArray(data.elements)) {
          return data.elements;
        }
      } catch {
        // Try next mirror
      }
    }

    return [];
  }
}
