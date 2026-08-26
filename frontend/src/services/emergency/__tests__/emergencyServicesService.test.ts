import {
  emergencyServicesService,
  calculateHaversineDistanceKm,
} from "../emergencyServicesService";
import { OverpassService } from "../overpassService";
import AsyncStorage from "@react-native-async-storage/async-storage";

describe("emergencyServicesService (Module 13)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    emergencyServicesService.clearCache();
    jest.clearAllMocks();
  });

  it("calculates accurate Haversine distance in kilometers", () => {
    // Bangalore Majestic (12.9778, 77.5727) to Indiranagar (12.9719, 77.6412) ~ 7.4 km
    const dist = calculateHaversineDistanceKm(12.9778, 77.5727, 12.9719, 77.6412);
    expect(dist).toBeGreaterThan(7.0);
    expect(dist).toBeLessThan(8.0);
  });

  it("queries Overpass, normalizes OSM POIs and sorts nearest first", async () => {
    const mockOsmElements = [
      {
        element: {
          id: 101,
          type: "node" as const,
          lat: 12.980,
          lon: 77.600,
          tags: {
            name: "Central Police Station",
            amenity: "police",
            "addr:street": "MG Road",
            phone: "+91 80 2294 2222",
          },
        },
        inferredCategory: "POLICE" as const,
      },
      {
        element: {
          id: 102,
          type: "node" as const,
          lat: 12.972,
          lon: 77.595,
          tags: {
            name: "City Care Hospital",
            amenity: "hospital",
            "addr:street": "Brigade Road",
            opening_hours: "24/7",
          },
        },
        inferredCategory: "HOSPITAL" as const,
      },
    ];

    jest.spyOn(OverpassService, "queryEmergencyPois").mockResolvedValue(mockOsmElements as any);

    const results = await emergencyServicesService.getNearbyServices({
      latitude: 12.9716,
      longitude: 77.5946,
      radiusMeters: 3000,
    });

    expect(results.length).toBe(2);
    // Nearest should be City Care Hospital (12.972, 77.595 is closer to 12.9716, 77.5946)
    expect(results[0].name).toBe("City Care Hospital");
    expect(results[0].type).toBe("HOSPITAL");
    expect(results[0].isOpen).toBe(true);
    expect(results[0].source).toBe("openstreetmap");

    expect(results[1].name).toBe("Central Police Station");
    expect(results[1].phone).toBe("+91 80 2294 2222");
    expect(results[1].address).toContain("MG Road");
  });

  it("filters results by category when specified", async () => {
    const mockOsmElements = [
      {
        element: {
          id: 201,
          type: "node" as const,
          lat: 12.975,
          lon: 77.598,
          tags: { name: "Women Support Center", amenity: "social_facility" },
        },
        inferredCategory: "WOMEN_SUPPORT" as const,
      },
      {
        element: {
          id: 202,
          type: "node" as const,
          lat: 12.976,
          lon: 77.599,
          tags: { name: "Metro Station", railway: "station" },
        },
        inferredCategory: "PUBLIC_TRANSPORT" as const,
      },
    ];

    jest.spyOn(OverpassService, "queryEmergencyPois").mockResolvedValue(mockOsmElements as any);

    const results = await emergencyServicesService.getNearbyServices({
      latitude: 12.9716,
      longitude: 77.5946,
      category: "WOMEN_SUPPORT",
    });

    expect(results.length).toBe(1);
    expect(results[0].type).toBe("WOMEN_SUPPORT");
    expect(results[0].name).toBe("Women Support Center");
  });
});
