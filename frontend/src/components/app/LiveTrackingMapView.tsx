import React, { useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "../../theme/tokens";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoutePolyline {
  id: string;
  points: Array<[number, number]>; // [lat, lng]
  color?: string;
  isPrimary?: boolean;
}

export interface SafeSpotMarker {
  id: string;
  name: string;
  type: "police" | "hospital" | "shelter";
  lat: number;
  lng: number;
  phone?: string;
}

export interface LiveTrackingMapViewRef {
  recenter: (lat?: number, lng?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export interface LiveTrackingMapViewProps {
  userLocation: LatLng;
  destination?: LatLng;
  origin?: LatLng;
  routes?: RoutePolyline[];
  safeSpots?: SafeSpotMarker[];
  geofenceRadiusMeters?: number;
  showGeofence?: boolean;
  isFamilyView?: boolean;
  userAvatarInitials?: string;
  heading?: number;
  height?: number | string;
  isFullScreen?: boolean;
  onMapReady?: () => void;
}

// Safely embeds a JS value as a string literal for injectJavaScript by JSON-encoding it
// twice: once to produce the payload, once to produce a JS string literal containing it.
// The injected side JSON.parses it back. Prevents string-escaping bugs from user/OSM data
// (place names, addresses) reaching the WebView bridge.
function toInjectedLiteral(value: unknown): string {
  return JSON.stringify(JSON.stringify(value ?? null));
}

export const LiveTrackingMapView = forwardRef<LiveTrackingMapViewRef, LiveTrackingMapViewProps>(
  (
    {
      userLocation,
      destination,
      origin,
      routes = [],
      safeSpots = [],
      geofenceRadiusMeters = 500,
      showGeofence = false,
      isFamilyView = false,
      userAvatarInitials = "PS",
      heading = 0,
      height = 280,
      isFullScreen = false,
      onMapReady,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      recenter: (lat, lng) => {
        const targetLat = lat ?? userLocation.lat;
        const targetLng = lng ?? userLocation.lng;
        webViewRef.current?.injectJavaScript(
          `if (window.recenterMap) { window.recenterMap(${targetLat}, ${targetLng}); } true;`
        );
      },
      zoomIn: () => {
        webViewRef.current?.injectJavaScript(`if (window.zoomInMap) { window.zoomInMap(); } true;`);
      },
      zoomOut: () => {
        webViewRef.current?.injectJavaScript(`if (window.zoomOutMap) { window.zoomOutMap(); } true;`);
      },
    }));

    // Built once per mount from whatever props were present on first render. All later prop
    // changes are pushed into the page through the window.update*() bridge below instead of
    // regenerating this HTML — regenerating it on every location tick used to hand WebView a
    // brand-new `source.html` string each time, which forces a full page reload (map resets
    // to its initial zoom/center, markers flash) instead of the smooth pan the bridge gives.
    const generateMapHtml = () => {
      const destJson = destination ? JSON.stringify(destination) : "null";
      const originJson = origin ? JSON.stringify(origin) : "null";
      const routesJson = JSON.stringify(routes);
      const safeSpotsJson = JSON.stringify(safeSpots);

      return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #0f172a; overflow: hidden; }

    .user-avatar-marker {
      position: relative;
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #6366F1, #8B5CF6);
      border: 2.5px solid #ffffff;
      border-radius: 50%;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 800;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.7), 0 4px 12px rgba(0, 0, 0, 0.35);
      transition: transform 0.3s ease;
    }

    .user-pulse-ring {
      position: absolute;
      top: -12px;
      left: -12px;
      width: 55px;
      height: 55px;
      border-radius: 50%;
      border: 2.5px solid #6366F1;
      animation: pulseGlow 2.2s infinite ease-out;
      pointer-events: none;
    }

    .heading-pointer {
      position: absolute;
      top: -6px;
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 8px solid #EC4899;
      pointer-events: none;
      transition: transform 0.25s ease;
    }

    @keyframes pulseGlow {
      0% { transform: scale(0.6); opacity: 0.95; }
      70% { transform: scale(1.35); opacity: 0.15; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    .dest-pin-marker {
      background: linear-gradient(135deg, #EC4899, #DB2777);
      border: 2px solid #ffffff;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 13px;
      font-weight: 800;
      box-shadow: 0 3px 12px rgba(236, 72, 153, 0.6);
    }

    .origin-pin-marker {
      background: #475569;
      border: 2px solid #ffffff;
      border-radius: 50%;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    }

    .safe-spot-pin {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
    }
    .spot-police { background: #3B82F6; }
    .spot-hospital { background: #EF4444; }
    .spot-shelter { background: #8B5CF6; }

    .cluster-badge {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #334155, #1e293b);
      border: 2.5px solid #ffffff;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 800;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5);
    }

    .leaflet-popup-content-wrapper {
      background: #1e293b;
      color: #f8fafc;
      border-radius: 12px;
      border: 1px solid #334155;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 4px 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .leaflet-popup-tip { background: #1e293b; }
    .popup-title { font-weight: 700; font-size: 13px; color: #f8fafc; margin-bottom: 2px; }
    .popup-subtitle { font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${userLocation.lat}, ${userLocation.lng}], 15);

    // OpenStreetMap standard tile layer (100% Free, No API Key Required)
    var osmTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    osmTiles.addTo(map);

    osmTiles.on('tileerror', function() {
      // Fallback to Humanitarian OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc'
      }).addTo(map);
    });

    // Custom user avatar & pulse marker
    var avatarHtml = '<div class="user-avatar-marker"><div class="heading-pointer" id="heading-pointer"></div><div>${userAvatarInitials}</div><div class="user-pulse-ring"></div></div>';
    var userIcon = L.divIcon({
      className: '',
      html: avatarHtml,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    var userMarker = L.marker([${userLocation.lat}, ${userLocation.lng}], { icon: userIcon }).addTo(map);
    userMarker.bindPopup('<div class="popup-title">${isFamilyView ? "Family Member" : "Your Live Location"}</div><div class="popup-subtitle">GPS Tracked · Real-time Mode</div>');

    function applyHeading(deg) {
      var el = document.getElementById('heading-pointer');
      if (el) { el.style.transform = 'rotate(' + deg + 'deg)'; }
    }
    applyHeading(${heading});

    function makeDestIcon() {
      return L.divIcon({
        className: '',
        html: '<div class="dest-pin-marker">🏁</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
    }

    function makeOriginIcon() {
      return L.divIcon({
        className: '',
        html: '<div class="origin-pin-marker">●</div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
    }

    function makeSafeSpotIcon(type) {
      var spotClass = type === 'police' ? 'spot-police' : type === 'hospital' ? 'spot-hospital' : 'spot-shelter';
      var emoji = type === 'police' ? '👮' : type === 'hospital' ? '🏥' : '🛡️';
      return L.divIcon({ className: '', html: '<div class="safe-spot-pin ' + spotClass + '">' + emoji + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
    }

    // Origin marker (redrawn in place, never recreates the map)
    var originMarker = null;
    function renderOrigin(o) {
      if (originMarker) { map.removeLayer(originMarker); originMarker = null; }
      if (o) {
        originMarker = L.marker([o.lat, o.lng], { icon: makeOriginIcon() }).addTo(map).bindPopup('<div class="popup-title">Start Point</div><div class="popup-subtitle">Trip Origin</div>');
      }
    }
    renderOrigin(${originJson});
    window.updateOrigin = function(originJsonStr) {
      renderOrigin(JSON.parse(originJsonStr));
    };

    // Destination marker
    var destMarker = null;
    function renderDestination(d) {
      if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
      if (d) {
        destMarker = L.marker([d.lat, d.lng], { icon: makeDestIcon() }).addTo(map).bindPopup('<div class="popup-title">Destination</div><div class="popup-subtitle">Safe Haven Target</div>');
      }
    }
    renderDestination(${destJson});
    window.updateDestination = function(destJsonStr) {
      renderDestination(JSON.parse(destJsonStr));
    };

    // Geofence circle
    var geofenceCircle = null;
    function renderGeofence(show, radius) {
      if (geofenceCircle) { map.removeLayer(geofenceCircle); geofenceCircle = null; }
      if (show) {
        geofenceCircle = L.circle(userMarker.getLatLng(), {
          color: '#6366F1',
          fillColor: '#6366F1',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '4, 6',
          radius: radius
        }).addTo(map);
      }
    }
    renderGeofence(${showGeofence}, ${geofenceRadiusMeters});
    window.updateGeofence = function(show, radius) {
      renderGeofence(show, radius);
    };

    // Route polylines, grouped so they can be cleared and redrawn without touching the map
    var routeLayer = L.layerGroup().addTo(map);
    function renderRoutes(routesData) {
      routeLayer.clearLayers();
      if (routesData && routesData.length > 0) {
        routesData.forEach(function(r) {
          L.polyline(r.points, {
            color: r.color || (r.isPrimary ? '#6366F1' : '#94A3B8'),
            weight: r.isPrimary ? 6 : 4,
            dashArray: r.isPrimary ? null : '6, 8',
            opacity: r.isPrimary ? 0.95 : 0.65
          }).addTo(routeLayer);
        });
        try {
          map.fitBounds(routesData[0].points, { padding: [40, 40], maxZoom: 16 });
        } catch(e) {}
      }
    }
    renderRoutes(${routesJson});
    window.updateRoutes = function(routesJsonStr) {
      renderRoutes(JSON.parse(routesJsonStr));
    };

    // Safe spots, clustered so a dense list of nearby results (police/hospital/shelter)
    // collapses into count bubbles instead of overlapping pins at city zoom levels.
    var safeSpotCluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: function(cluster) {
        return L.divIcon({
          html: '<div class="cluster-badge">' + cluster.getChildCount() + '</div>',
          className: '',
          iconSize: [36, 36]
        });
      }
    });
    map.addLayer(safeSpotCluster);

    function renderSafeSpots(spots) {
      safeSpotCluster.clearLayers();
      if (spots && spots.length > 0) {
        spots.forEach(function(spot) {
          var marker = L.marker([spot.lat, spot.lng], { icon: makeSafeSpotIcon(spot.type) });
          marker.bindPopup('<div class="popup-title">' + spot.name + '</div><div class="popup-subtitle">Safe Place (' + spot.type.toUpperCase() + ')</div>');
          safeSpotCluster.addLayer(marker);
        });
      }
    }
    renderSafeSpots(${safeSpotsJson});
    window.updateSafeSpots = function(spotsJsonStr) {
      renderSafeSpots(JSON.parse(spotsJsonStr));
    };

    // Dynamic JS Bridge Controls
    window.updateUserLocation = function(lat, lng) {
      var newPos = [lat, lng];
      userMarker.setLatLng(newPos);
      map.panTo(newPos, { animate: true, duration: 0.8 });
      if (geofenceCircle) {
        geofenceCircle.setLatLng(newPos);
      }
    };

    window.updateHeading = function(deg) {
      applyHeading(deg);
    };

    window.recenterMap = function(lat, lng) {
      map.setView([lat, lng], 16, { animate: true });
    };

    window.zoomInMap = function() {
      map.zoomIn();
    };

    window.zoomOutMap = function() {
      map.zoomOut();
    };
  </script>
</body>
</html>`;
    };

    // Empty deps: intentionally builds the page once from whichever props were present at
    // mount. Every later change is pushed via the window.update*() bridge (effects below)
    // instead of regenerating this string, which would hand WebView a new `source.html` and
    // force a full reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const mapHtml = useMemo(() => generateMapHtml(), []);

    useEffect(() => {
      webViewRef.current?.injectJavaScript(
        `if (window.updateUserLocation) { window.updateUserLocation(${userLocation.lat}, ${userLocation.lng}); } true;`
      );
    }, [userLocation.lat, userLocation.lng]);

    useEffect(() => {
      webViewRef.current?.injectJavaScript(
        `if (window.updateHeading) { window.updateHeading(${heading}); } true;`
      );
    }, [heading]);

    useEffect(() => {
      webViewRef.current?.injectJavaScript(
        `if (window.updateSafeSpots) { window.updateSafeSpots(${toInjectedLiteral(safeSpots)}); } true;`
      );
    }, [safeSpots]);

    useEffect(() => {
      webViewRef.current?.injectJavaScript(
        `if (window.updateRoutes) { window.updateRoutes(${toInjectedLiteral(routes)}); } true;`
      );
    }, [routes]);

    useEffect(() => {
      webViewRef.current?.injectJavaScript(
        `if (window.updateDestination) { window.updateDestination(${toInjectedLiteral(destination ?? null)}); } true;`
      );
    }, [destination?.lat, destination?.lng]);

    useEffect(() => {
      webViewRef.current?.injectJavaScript(
        `if (window.updateOrigin) { window.updateOrigin(${toInjectedLiteral(origin ?? null)}); } true;`
      );
    }, [origin?.lat, origin?.lng]);

    useEffect(() => {
      webViewRef.current?.injectJavaScript(
        `if (window.updateGeofence) { window.updateGeofence(${showGeofence}, ${geofenceRadiusMeters}); } true;`
      );
    }, [showGeofence, geofenceRadiusMeters]);

    return (
      <View style={[styles.container, isFullScreen ? styles.fullScreen : { height: height as any }]}>
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html: mapHtml }}
          style={styles.webView}
          scrollEnabled={false}
          onLoadEnd={onMapReady}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          startInLoadingState={true}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  fullScreen: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 0,
    borderWidth: 0,
    height: "100%",
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
});
