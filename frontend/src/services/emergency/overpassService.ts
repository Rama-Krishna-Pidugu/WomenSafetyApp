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
  ): Promise<Array<{
    element: RawOsmElement;
    inferredCategory: EmergencyServiceCategory;
  }>> {
    const categoriesToQuery: EmergencyServiceCategory[] = category
      ? [category]
      : [
          "POLICE",
          "HOSPITAL",
          "AMBULANCE",
          "WOMEN_SUPPORT",
          "NGO",
          "PUBLIC_TRANSPORT",
        ];

    const queryCategory = async (
      cat: EmergencyServiceCategory
    ): Promise<Array<{
      element: RawOsmElement;
      inferredCategory: EmergencyServiceCategory;
    }>> => {
      const qlBody = CATEGORY_FILTERS[cat]
        .replace(/{{radius}}/g, String(radiusMeters))
        .replace(/{{lat}}/g, String(lat))
        .replace(/{{lon}}/g, String(lon));

      const query = `[out:json][timeout:10];(${qlBody});out center tags;`;

      try {
        const startTime = Date.now();

        const elements = await this.executeOverpassQuery(query);

        const elapsed = Date.now() - startTime;

        console.log(
          `[OverpassService] ${cat} completed in ${elapsed}ms | ${elements.length} results`
        );

        return elements.map((element) => ({
          element,
          inferredCategory: cat,
        }));
      }  catch (err) {
           console.warn(
             `[OverpassService] ${cat} query failed:`,
             err
           );

           return [];
         }
       };

    // If one category was requested, execute only that category.
    if (category) {
      return queryCategory(category);
    }

    // For ALL, execute all categories concurrently.
    const results = await Promise.allSettled(
      categoriesToQuery.map((cat) => queryCategory(cat))
    );

    return results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );
  }
  private static async executeOverpassQuery(query: string): Promise<RawOsmElement[]> {
    const requestFromEndpoint = async (
      endpoint: string
    ): Promise<RawOsmElement[]> => {
      const controller = new AbortController();

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 8000);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data && Array.isArray(data.elements)) {
          return data.elements;
        }

        throw new Error("Invalid Overpass response");
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const requests = OVERPASS_ENDPOINTS.map((endpoint) =>
      requestFromEndpoint(endpoint)
    );

    try {
      return await Promise.any(requests);
    } catch (err) {
      console.warn(
        "[OverpassService] All Overpass endpoints failed:",
        err
      );

      return [];
    }
  }
}
