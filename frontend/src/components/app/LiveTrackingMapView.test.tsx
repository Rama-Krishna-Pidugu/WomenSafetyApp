import React from "react";
import { render, screen } from "@testing-library/react-native";
import {
  LiveTrackingMapView,
  LiveTrackingMapViewRef,
  RoutePolyline,
  SafeSpotMarker,
} from "./LiveTrackingMapView";

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        injectJavaScript: jest.fn(),
      }));
      return <View testID="mock-leaflet-webview" {...props} />;
    }),
  };
});

describe("LiveTrackingMapView (Module 4)", () => {
  const mockUserLocation = { lat: 12.9716, lng: 77.5946 };
  const mockDestination = { lat: 12.985, lng: 77.605 };
  const mockOrigin = { lat: 12.9352, lng: 77.6245 };
  const mockRoutes: RoutePolyline[] = [
    {
      id: "r1",
      points: [
        [12.9352, 77.6245],
        [12.9716, 77.5946],
        [12.985, 77.605],
      ],
      isPrimary: true,
      color: "#8b5cf6",
    },
  ];
  const mockSafeSpots: SafeSpotMarker[] = [
    { id: "sp1", name: "Police Station", type: "police", lat: 12.975, lng: 77.599 },
    { id: "sp2", name: "Hospital", type: "hospital", lat: 12.979, lng: 77.601 },
  ];

  it("renders the Leaflet OpenStreetMap WebView cleanly", async () => {
    await render(
      <LiveTrackingMapView
        userLocation={mockUserLocation}
        destination={mockDestination}
        origin={mockOrigin}
        routes={mockRoutes}
        safeSpots={mockSafeSpots}
        isFullScreen={true}
      />
    );

    expect(screen.getByTestId("mock-leaflet-webview")).toBeTruthy();
  });

  it("exposes imperative ref controls: recenter, zoomIn, zoomOut", async () => {
    const mapRef = React.createRef<LiveTrackingMapViewRef>();

    await render(
      <LiveTrackingMapView
        ref={mapRef}
        userLocation={mockUserLocation}
        destination={mockDestination}
        origin={mockOrigin}
        routes={mockRoutes}
        safeSpots={mockSafeSpots}
      />
    );

    expect(mapRef.current).not.toBeNull();
    expect(typeof mapRef.current?.recenter).toBe("function");
    expect(typeof mapRef.current?.zoomIn).toBe("function");
    expect(typeof mapRef.current?.zoomOut).toBe("function");

    // Execute imperative calls without throwing
    expect(() => mapRef.current?.recenter(12.9716, 77.5946)).not.toThrow();
    expect(() => mapRef.current?.zoomIn()).not.toThrow();
    expect(() => mapRef.current?.zoomOut()).not.toThrow();
  });
});
