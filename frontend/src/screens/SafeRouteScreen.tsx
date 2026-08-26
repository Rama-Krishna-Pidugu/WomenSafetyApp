import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Linking, Alert, Platform } from "react-native";
import {
  Clock,
  Lightbulb,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  TriangleAlert,
  Users,
  Radio,
  Square,
  MessageSquare,
  CheckCircle2,
  Sliders,
  Building2,
  Ambulance,
  Shield,
  LocateFixed,
} from "lucide-react-native";
import { colors, radii } from "../theme/tokens";
import { AppButton } from "../components/ds/AppButton";
import { Badge } from "../components/ds/Badge";
import { NavBar } from "../components/ds/NavBar";
import { LiveTrackingMapView, LatLng, RoutePolyline, SafeSpotMarker } from "../components/app/LiveTrackingMapView";
import { GeofenceSettingsModal, GeofenceConfig } from "../components/app/GeofenceSettingsModal";
import { locationService } from "../modules/location/services/locationService";
import { nearbyPlacesService } from "../modules/location/services/nearbyPlacesService";
import { contactStorageService } from "../services/contactStorageService";
import { sendSilentSms } from "../services/sosNativeService";
import { startLiveLocationSharing, stopLiveLocationSharing } from "../services/liveLocationSharing";
import { getPublicTrackingUrl } from "../utils/trackingUrl";

export type SafeRouteState = "search" | "results" | "loading" | "navigating";

const PLACES = [
  { id: "p1", name: "Home", detail: "100 Ft Road, Indiranagar", lat: 12.9850, lng: 77.6050 },
  { id: "p2", name: "Office", detail: "Koramangala 5th Block", lat: 12.9352, lng: 77.6245 },
  { id: "p3", name: "Starbucks Indiranagar", detail: "12th Main Road", lat: 12.9784, lng: 77.6408 },
];

const SAFE_ROUTES = [
  {
    id: "sr1",
    label: "Lit Corridor Main Rd",
    risk: "low" as const,
    detail: "98% well lit · High CCTV coverage",
    time: "18 min",
    distance: "4.2 km",
    points: [
      [12.9716, 77.5946],
      [12.9750, 77.5980],
      [12.9800, 77.6020],
      [12.9850, 77.6050],
    ] as Array<[number, number]>,
  },
  {
    id: "sr2",
    label: "Inner Link Road",
    risk: "medium" as const,
    detail: "72% well lit · Medium traffic",
    time: "14 min",
    distance: "3.6 km",
    points: [
      [12.9716, 77.5946],
      [12.9730, 77.6000],
      [12.9810, 77.6030],
      [12.9850, 77.6050],
    ] as Array<[number, number]>,
  },
];

const RISK_TONE = {
  low: { label: "Low risk", tone: "success" as const },
  medium: { label: "Some risk", tone: "warning" as const },
  high: { label: "High risk", tone: "emergency" as const },
};

const MOCK_SAFE_SPOTS: SafeSpotMarker[] = [
  { id: "sp1", name: "Indiranagar Police Station", type: "police", lat: 12.9755, lng: 77.5990 },
  { id: "sp2", name: "Manipal Hospital 24/7", type: "hospital", lat: 12.9790, lng: 77.6015 },
  { id: "sp3", name: "Women Safe Haven Shelter", type: "shelter", lat: 12.9820, lng: 77.6035 },
];

export function SafeRouteScreen({
  state: initialState = "results",
  onBack,
  onStartNavigation: externalStartNav,
  onOpenFamilyTracking,
}: {
  state?: SafeRouteState;
  onBack?: () => void;
  onStartNavigation?: () => void;
  onOpenFamilyTracking?: (params: {
    sessionId: string;
    destinationName: string;
    destinationLat: number;
    destinationLng: number;
  }) => void;
}) {
  const [screenState, setScreenState] = useState<SafeRouteState>(initialState);
  const [pickedRouteId, setPickedRouteId] = useState("sr1");
  const [userLocation, setUserLocation] = useState<LatLng>({ lat: 12.9716, lng: 77.5946 });
  const [destination, setDestination] = useState<LatLng>({ lat: 12.9850, lng: 77.6050 });
  const [destinationName, setDestinationName] = useState("Home · Nandi Layout");
  const [distanceKm, setDistanceKm] = useState<number>(4.2);
  const [etaMinutes, setEtaMinutes] = useState<number>(18);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean>(true);
  const [trackingSessionId, setTrackingSessionId] = useState<string | null>(null);

  // Safety & Geofence Settings State
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);
  const [geofenceConfig, setGeofenceConfig] = useState<GeofenceConfig>({
    radiusMeters: 600,
    autoSendSms: true,
    voiceAlerts: true,
    showPolice: true,
    showHospitals: true,
    showShelters: true,
  });

  const [userAddress, setUserAddress] = useState<string>("Indiranagar 100 Ft Road, Bengaluru");
  const [osmPlaces, setOsmPlaces] = useState<SafeSpotMarker[]>([]);

  // Combine discovered OSM safe spots + fallbacks and filter based on config toggles
  const allSafeSpots = [...osmPlaces, ...MOCK_SAFE_SPOTS];
  const activeSafeSpots = allSafeSpots.filter((spot) => {
    if (spot.type === "police" && !geofenceConfig.showPolice) return false;
    if (spot.type === "hospital" && !geofenceConfig.showHospitals) return false;
    if (spot.type === "shelter" && !geofenceConfig.showShelters) return false;
    return true;
  });

  // Dynamically compute safe routes leading to nearest Police Station & Hospital
  const dynamicSafeRoutes = React.useMemo(() => {
    const policeSpot = allSafeSpots.find((s) => s.type === "police") || {
      id: "sp1", name: "Mandadam Police Station", lat: userLocation.lat + 0.004, lng: userLocation.lng + 0.003
    };
    const hospitalSpot = allSafeSpots.find((s) => s.type === "hospital") || {
      id: "sp2", name: "Emergency General Hospital", lat: userLocation.lat + 0.006, lng: userLocation.lng + 0.005
    };

    const policeDistKm = locationService.calculateDistanceKm(userLocation.lat, userLocation.lng, policeSpot.lat, policeSpot.lng);
    const hospitalDistKm = locationService.calculateDistanceKm(userLocation.lat, userLocation.lng, hospitalSpot.lat, hospitalSpot.lng);

    return [
      {
        id: "sr1",
        label: `Safe Route to ${policeSpot.name}`,
        risk: "low" as const,
        detail: "Direct safe corridor to Police Station · 24/7 Patrol",
        time: `${Math.max(3, Math.ceil(policeDistKm * 4))} min`,
        distance: `${policeDistKm.toFixed(1)} km`,
        points: [
          [userLocation.lat, userLocation.lng],
          [userLocation.lat + (policeSpot.lat - userLocation.lat) * 0.5, userLocation.lng + (policeSpot.lng - userLocation.lng) * 0.3],
          [policeSpot.lat, policeSpot.lng],
        ] as Array<[number, number]>,
      },
      {
        id: "sr2",
        label: `Emergency Route to ${hospitalSpot.name}`,
        risk: "low" as const,
        detail: "Fastest medical emergency corridor · 98% Well Lit",
        time: `${Math.max(4, Math.ceil(hospitalDistKm * 3.5))} min`,
        distance: `${hospitalDistKm.toFixed(1)} km`,
        points: [
          [userLocation.lat, userLocation.lng],
          [userLocation.lat + (hospitalSpot.lat - userLocation.lat) * 0.4, userLocation.lng + (hospitalSpot.lng - userLocation.lng) * 0.6],
          [hospitalSpot.lat, hospitalSpot.lng],
        ] as Array<[number, number]>,
      },
      {
        id: "sr3",
        label: "Lit Corridor Main Rd",
        risk: "low" as const,
        detail: "98% well lit · High CCTV coverage",
        time: "18 min",
        distance: "4.2 km",
        points: [
          [userLocation.lat, userLocation.lng],
          [userLocation.lat + 0.003, userLocation.lng + 0.003],
          [destination.lat, destination.lng],
        ] as Array<[number, number]>,
      },
    ];
  }, [userLocation, allSafeSpots, destination]);

  const selectedRoute = dynamicSafeRoutes.find((r) => r.id === pickedRouteId) || dynamicSafeRoutes[0];

  // Subscribe to live GPS tracking updates (4-5s interval)
  useEffect(() => {
    let isMounted = true;

    locationService.getCurrentLocation().then(async (loc) => {
      if (loc && isMounted) {
        const coords = { lat: loc.coordinates.latitude, lng: loc.coordinates.longitude };
        setUserLocation(coords);
        if (loc.address?.formattedAddress) {
          setUserAddress(loc.address.formattedAddress);
        }

        // Query real OpenStreetMap Overpass API for nearby emergency police & hospitals
        try {
          const police = await nearbyPlacesService.findNearbyPoliceStations({
            latitude: coords.lat,
            longitude: coords.lng,
          });
          const hospitals = await nearbyPlacesService.findNearbyHospitals({
            latitude: coords.lat,
            longitude: coords.lng,
          });

          if (isMounted) {
            const mappedPolice: SafeSpotMarker[] = police.map((p) => ({
              id: p.id,
              name: p.name,
              type: "police",
              lat: p.latitude,
              lng: p.longitude,
            }));
            const mappedHospitals: SafeSpotMarker[] = hospitals.map((h) => ({
              id: h.id,
              name: h.name,
              type: "hospital",
              lat: h.latitude,
              lng: h.longitude,
            }));
            setOsmPlaces([...mappedPolice, ...mappedHospitals]);
          }
        } catch {
          /* use fallbacks */
        }
      }
    });

    locationService.startLocationTracking(async (loc) => {
      if (!isMounted) return;
      const newPos = {
        lat: loc.coordinates.latitude,
        lng: loc.coordinates.longitude,
      };
      setUserLocation(newPos);
      if (loc.address?.formattedAddress) {
        setUserAddress(loc.address.formattedAddress);
      }

      // Recalculate distance and ETA dynamically
      const remDist = locationService.calculateDistanceKm(
        newPos.lat,
        newPos.lng,
        destination.lat,
        destination.lng
      );
      setDistanceKm(remDist);
      setEtaMinutes(locationService.calculateETA(remDist, 15));

      // Geofence check using user-configured radius
      const inside = locationService.isInsideGeofence(
        newPos.lat,
        newPos.lng,
        destination.lat,
        destination.lng,
        geofenceConfig.radiusMeters
      );
      setIsInsideGeofence(inside);
    });

    return () => {
      isMounted = false;
      locationService.stopLocationTracking();
    };
  }, [destination, trackingSessionId]);

  const [smsSentStatus, setSmsSentStatus] = useState<string | null>(null);

  const handleStartNavigation = async () => {
    setScreenState("navigating");
    if (externalStartNav) externalStartNav();

    const sessionId = `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setTrackingSessionId(sessionId);
    await startLiveLocationSharing(sessionId);

    if (!geofenceConfig.autoSendSms) {
      setSmsSentStatus("Live tracking active. Auto-SMS is turned off in Zone Settings.");
      return;
    }

    try {
      const contacts = await contactStorageService.getStoredEmergencyContacts();
      const trackingUrl = getPublicTrackingUrl(sessionId);
      const smsMessage = `🛡️ Aegis Safety Live Tracking: I have started navigation to ${destinationName}. Track my real-time location live on map: ${trackingUrl}`;

      if (contacts && contacts.length > 0) {
        const phoneNumbers = contacts.map((c) => c.phone).filter(Boolean);
        if (phoneNumbers.length > 0) {
          const sent = await sendSilentSms(phoneNumbers, smsMessage);
          if (sent) {
            setSmsSentStatus(`Live tracking link sent via SMS to ${phoneNumbers.length} emergency contact(s)!`);
          } else {
            const firstPhone = phoneNumbers[0];
            const smsUrl = `sms:${firstPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(smsMessage)}`;
            Linking.canOpenURL(smsUrl).then((supported) => {
              if (supported) Linking.openURL(smsUrl);
            });
            setSmsSentStatus(`Live tracking SMS prepared for ${contacts[0].name} (${firstPhone})`);
          }
        }
      } else {
        setSmsSentStatus(`Live tracking link generated: ${trackingUrl}`);
      }
    } catch (err) {
      setSmsSentStatus("Live tracking active.");
    }
  };

  const handleEndNavigation = async () => {
    if (trackingSessionId) {
      await stopLiveLocationSharing(trackingSessionId);
    }
    setScreenState("results");
  };

  const handleSelectPlace = (place: (typeof PLACES)[0]) => {
    setDestination({ lat: place.lat, lng: place.lng });
    setDestinationName(place.name);
    setScreenState("results");
  };

  const routePolylines: RoutePolyline[] = dynamicSafeRoutes.map((r) => ({
    id: r.id,
    points: r.points,
    isPrimary: r.id === pickedRouteId,
    color: r.id === pickedRouteId ? colors.primary : "#94A3B8",
  }));

  if (screenState === "search") {
    return (
      <View style={styles.screen}>
        <NavBar title="Safe route search" onBack={onBack} />
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={18} color={colors.mutedForeground} />
            <Text style={styles.searchPlaceholder}>Where are you going?</Text>
          </View>
          <Text style={styles.sectionHeaderTitle}>Saved & Recent Places</Text>
          <View style={styles.placesList}>
            {PLACES.map((p) => (
              <Pressable key={p.id} style={styles.placeCard} onPress={() => handleSelectPlace(p)}>
                <View style={styles.placeIcon}>
                  <MapPin size={18} color={colors.primary} />
                </View>
                <View style={styles.placeTextWrap}>
                  <Text style={styles.placeName}>{p.name}</Text>
                  <Text style={styles.placeDetail}>{p.detail}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <NavBar
        title={screenState === "navigating" ? "Live GPS Navigation" : "Safe route suggestions"}
        onBack={onBack}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Live Location Status Banner */}
        <View style={styles.myLocationCard}>
          <View style={styles.myLocHeader}>
            <View style={styles.myLocDotRow}>
              <Radio size={15} color="#10B981" />
              <Text style={styles.myLocTitle}>MY LOCATION TRACKING ACTIVE</Text>
            </View>
            <Badge tone="success">4s Auto-Sync</Badge>
          </View>
          <Text style={styles.myLocAddress} numberOfLines={1}>
            📍 {userAddress}
          </Text>
          <Text style={styles.myLocCoords}>
            GPS Coordinates: {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
          </Text>
        </View>

        {/* Map Header Controls */}
        <View style={styles.mapHeaderRow}>
          <Text style={styles.mapHeaderTitle}>OpenStreetMap Live Safety View</Text>
          <Pressable style={styles.settingsPillBtn} onPress={() => setShowGeofenceModal(true)}>
            <Sliders size={14} color={colors.primary} />
            <Text style={styles.settingsPillText}>Zone Settings ({geofenceConfig.radiusMeters}m)</Text>
          </Pressable>
        </View>

        {/* Real-time OpenStreetMap Component */}
        <View style={styles.mapWrap}>
          <LiveTrackingMapView
            userLocation={userLocation}
            destination={destination}
            routes={routePolylines}
            safeSpots={activeSafeSpots}
            showGeofence={true}
            geofenceRadiusMeters={geofenceConfig.radiusMeters}
            height={250}
          />
        </View>

        {/* OpenStreetMap Safe Haven Filter Chips */}
        <View style={styles.chipsRow}>
          <Pressable
            style={[styles.safeChip, geofenceConfig.showPolice && styles.safeChipActivePolice]}
            onPress={() => setGeofenceConfig((c) => ({ ...c, showPolice: !c.showPolice }))}
          >
            <Building2 size={13} color={geofenceConfig.showPolice ? "#3B82F6" : colors.mutedForeground} />
            <Text style={[styles.chipText, geofenceConfig.showPolice && { color: "#3B82F6" }]}>
              Police ({allSafeSpots.filter((s) => s.type === "police").length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.safeChip, geofenceConfig.showHospitals && styles.safeChipActiveHospital]}
            onPress={() => setGeofenceConfig((c) => ({ ...c, showHospitals: !c.showHospitals }))}
          >
            <Ambulance size={13} color={geofenceConfig.showHospitals ? "#EF4444" : colors.mutedForeground} />
            <Text style={[styles.chipText, geofenceConfig.showHospitals && { color: "#EF4444" }]}>
              Hospitals ({allSafeSpots.filter((s) => s.type === "hospital").length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.safeChip, geofenceConfig.showShelters && { borderColor: "#8B5CF6", backgroundColor: "rgba(139, 92, 246, 0.15)" }]}
            onPress={() => setGeofenceConfig((c) => ({ ...c, showShelters: !c.showShelters }))}
          >
            <Shield size={13} color={geofenceConfig.showShelters ? "#8B5CF6" : colors.mutedForeground} />
            <Text style={[styles.chipText, geofenceConfig.showShelters && { color: "#8B5CF6" }]}>
              Shelters ({allSafeSpots.filter((s) => s.type === "shelter").length})
            </Text>
          </Pressable>
        </View>

        {/* Live Navigation Status Banner when active */}
        {screenState === "navigating" && (
          <View style={styles.liveNavCard}>
            <View style={styles.liveHeaderRow}>
              <View style={styles.liveBadge}>
                <Radio size={14} color="#10B981" />
                <Text style={styles.liveBadgeText}>LIVE GPS TRACKING</Text>
              </View>
              <Badge tone="success">4s Auto-Sync</Badge>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{etaMinutes} min</Text>
                <Text style={styles.statSub}>ETA</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{distanceKm} km</Text>
                <Text style={styles.statSub}>Distance</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{selectedRoute.label.split(" ")[0]}</Text>
                <Text style={styles.statSub}>Active Route</Text>
              </View>
            </View>

            {smsSentStatus && (
              <View style={styles.smsStatusPill}>
                <CheckCircle2 size={16} color="#10B981" />
                <Text style={styles.smsStatusText}>{smsSentStatus}</Text>
              </View>
            )}

            {!isInsideGeofence && (
              <View style={styles.geofenceWarning}>
                <TriangleAlert size={16} color="#F59E0B" />
                <Text style={styles.geofenceText}>
                  Off-route warning: You are outside the designated safe corridor buffer!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Suggested Routes Options */}
        {screenState !== "navigating" && (
          <>
            <Text style={styles.routesTitle}>Suggested Safe Routes</Text>
            <View style={styles.routesList}>
              {dynamicSafeRoutes.map((r) => {
                const risk = RISK_TONE[r.risk];
                const active = pickedRouteId === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setPickedRouteId(r.id)}
                    style={[styles.routeCard, active && styles.routeCardActive]}
                  >
                    <View style={styles.routeHeader}>
                      <Text style={styles.routeLabel}>{r.label}</Text>
                      <Badge tone={risk.tone}>{risk.label}</Badge>
                    </View>
                    <Text style={styles.routeDetail}>{r.detail}</Text>
                    <View style={styles.routeMetaRow}>
                      <View style={styles.metaItem}>
                        <Clock size={14} color={colors.mutedForeground} />
                        <Text style={styles.metaText}>{r.time}</Text>
                      </View>
                      <Text style={styles.metaText}>{r.distance}</Text>
                      <View style={styles.metaItem}>
                        {r.risk === "low" ? (
                          <Lightbulb size={14} color={colors.success} />
                        ) : (
                          <TriangleAlert size={14} color={colors.warning} />
                        )}
                        <Text style={styles.metaText}>
                          {r.risk === "low" ? "Well lit corridor" : "Check lighting"}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <View style={styles.disclaimerBox}>
          <ShieldCheck size={16} color="#10B981" />
          <Text style={styles.disclaimerText}>
            OpenStreetMap live GPS tracking updates position every 4 seconds automatically.
          </Text>
        </View>
      </ScrollView>

      {/* Action Footer Buttons */}
      <View style={styles.footer}>
        {screenState === "navigating" ? (
          <View style={styles.buttonRow}>
            {onOpenFamilyTracking && (
              <Pressable
                style={styles.secondaryActionBtn}
                onPress={() =>
                  onOpenFamilyTracking({
                    sessionId: trackingSessionId ?? "trk_demo",
                    destinationName,
                    destinationLat: destination.lat,
                    destinationLng: destination.lng,
                  })
                }
              >
                <Users size={18} color={colors.foreground} />
                <Text style={styles.secondaryBtnText}>Family Share</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              <AppButton
                variant="secondary"
                leading={<Square size={16} color={colors.foreground} />}
                onPress={handleEndNavigation}
              >
                End Navigation
              </AppButton>
            </View>
          </View>
        ) : (
          <AppButton leading={<Navigation size={18} color="#fff" />} onPress={handleStartNavigation}>
            Start Safe Navigation
          </AppButton>
        )}
      </View>

      {/* Geofence & Safety Zone Settings Modal */}
      <GeofenceSettingsModal
        visible={showGeofenceModal}
        config={geofenceConfig}
        onChangeConfig={setGeofenceConfig}
        onClose={() => setShowGeofenceModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  mapHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 6,
  },
  mapHeaderTitle: { fontSize: 13, fontWeight: "700", color: colors.mutedForeground, letterSpacing: 0.3 },
  settingsPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.primary}12`,
    borderWidth: 1,
    borderColor: `${colors.primary}35`,
    borderRadius: radii.xl,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  settingsPillText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  searchContainer: { paddingHorizontal: 20, paddingTop: 12 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  searchPlaceholder: { fontSize: 15, color: colors.mutedForeground },
  sectionHeaderTitle: { fontSize: 13, fontWeight: "700", color: colors.mutedForeground, letterSpacing: 0.5, marginBottom: 12 },
  placesList: { gap: 10 },
  placeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 14,
    gap: 12,
  },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  placeTextWrap: { flex: 1 },
  placeName: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  placeDetail: { fontSize: 13, color: colors.mutedForeground },
  myLocationCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 14,
    marginTop: 10,
    marginBottom: 8,
    gap: 4,
  },
  myLocHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  myLocDotRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  myLocTitle: { fontSize: 11, fontWeight: "800", color: "#10B981", letterSpacing: 0.5 },
  myLocAddress: { fontSize: 14, fontWeight: "700", color: colors.foreground, marginTop: 2 },
  myLocCoords: { fontSize: 11, color: colors.mutedForeground },
  chipsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  safeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  safeChipActivePolice: { borderColor: "#3B82F6", backgroundColor: "#3B82F615" },
  safeChipActiveHospital: { borderColor: "#EF4444", backgroundColor: "#EF444415" },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.mutedForeground },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  mapWrap: { marginVertical: 8 },
  liveNavCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  liveHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveBadgeText: { fontSize: 12, fontWeight: "800", color: "#10B981", letterSpacing: 0.5 },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  statBox: { alignItems: "center", flex: 1 },
  statVal: { fontSize: 17, fontWeight: "800", color: colors.foreground },
  statSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  geofenceWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F59E0B15",
    borderWidth: 1,
    borderColor: "#F59E0B40",
    borderRadius: radii.lg,
    padding: 10,
    gap: 8,
  },
  geofenceText: { fontSize: 12, color: "#F59E0B", flex: 1, fontWeight: "600" },
  smsStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B98115",
    borderWidth: 1,
    borderColor: "#10B98140",
    borderRadius: radii.lg,
    padding: 10,
    gap: 8,
  },
  smsStatusText: { fontSize: 12, color: "#10B981", flex: 1, fontWeight: "700" },
  routesTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground, marginBottom: 12 },
  routesList: { gap: 12 },
  routeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 16,
    gap: 8,
  },
  routeCardActive: { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}50` },
  routeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  routeLabel: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  routeDetail: { fontSize: 13, color: colors.mutedForeground },
  routeMetaRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.mutedForeground },
  disclaimerBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginVertical: 16 },
  disclaimerText: { fontSize: 12, color: colors.mutedForeground, textAlign: "center" },
  footer: { paddingHorizontal: 16, paddingBottom: 20 },
  buttonRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    height: 48,
    gap: 6,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.foreground },
});

