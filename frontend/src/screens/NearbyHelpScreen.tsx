import React, { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import {
  Hospital,
  ShieldCheck,
  HeartHandshake,
  Navigation,
  PhoneCall,
  Map as MapIcon,
  List,
  MapPin,
  Ambulance,
  Bus,
  ShieldAlert,
  Building2,
  RefreshCw,
} from "lucide-react-native";
import { colors, radii } from "../theme/tokens";
import { Badge } from "../components/ds/Badge";
import { Card } from "../components/ds/Card";
import { Chip } from "../components/ds/Chip";
import { NavBar } from "../components/ds/NavBar";
import {
  LiveTrackingMapView,
  LatLng,
  SafeSpotMarker,
} from "../components/app/LiveTrackingMapView";
import {
  emergencyServicesService,
  EmergencyServiceCategory,
  NormalizedEmergencyService,
} from "../services/emergency";
import * as Location from "expo-location";
import { locationService } from "../modules/location/services/locationService";


export type NearbyState = "list" | "map" | "loading";

const CATEGORY_CHIPS: Array<{ id: "ALL" | EmergencyServiceCategory; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "POLICE", label: "Police" },
  { id: "HOSPITAL", label: "Hospitals" },
  { id: "AMBULANCE", label: "Ambulance" },
  { id: "WOMEN_SUPPORT", label: "Women Support" },
  { id: "NGO", label: "NGOs" },
  { id: "PUBLIC_TRANSPORT", label: "Transport" },
];

const EMERGENCY_HOTLINES = [
  { id: "e1", label: "National Emergency", number: "112", tag: "24/7 Police & Rescue" },
  { id: "e2", label: "Women's Helpline", number: "1091", tag: "Priority Toll-Free" },
  { id: "e3", label: "Ambulance Emergency", number: "108", tag: "Medical Dispatch" },
];

// Used only when the device location cannot be obtained.
const DEFAULT_USER_LOCATION: LatLng = {
  lat: 16.5062,
  lng: 80.6480,
};

export function NearbyHelpScreen({
  state: initialState = "list",
  onBack,
  onNavigateHome,
  onNavigateMap,
}: {
  state?: NearbyState;
  onBack?: () => void;
  onNavigateHome?: () => void;
  onNavigateMap?: () => void;
}) {
  const [view, setView] = useState<"list" | "map">(initialState === "map" ? "map" : "list");
  const [selectedCategory, setSelectedCategory] = useState<EmergencyServiceCategory | "ALL">("ALL");
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [services, setServices] = useState<NormalizedEmergencyService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestIdRef = useRef(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      try {
        const loc = await locationService.getCurrentLocation();

        if (loc?.coordinates) {
          console.log(
            "[NearbyHelpScreen] Using device GPS:",
            loc.coordinates.latitude,
            loc.coordinates.longitude
          );

          setUserLocation({
            lat: loc.coordinates.latitude,
            lng: loc.coordinates.longitude,
          });
        } else {
          console.warn(
            "[NearbyHelpScreen] GPS unavailable. Using Vijayawada fallback."
          );

          setUserLocation(DEFAULT_USER_LOCATION);
        }
      } catch (err) {
        console.warn(
          "[NearbyHelpScreen] Location acquire error. Using Vijayawada fallback:",
          err
        );

        setUserLocation(DEFAULT_USER_LOCATION);
      } finally {
        setLocationReady(true);
      }
    })();
  }, []);

  const loadServices = async (force = false) => {
    if (!userLocation) {
      return;
    }

    const requestId = ++requestIdRef.current;

    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      console.log(
        `[NearbyHelpScreen] Loading ${selectedCategory} services at`,
        userLocation.lat,
        userLocation.lng
      );

      const results = await emergencyServicesService.getNearbyServices({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        radiusMeters: 5000,
        category:
          selectedCategory === "ALL" ? undefined : selectedCategory,
        forceRefresh: force,
      });

      // A newer request has already started.
      // Ignore this older request's result.
      if (requestId !== requestIdRef.current) {
        console.log(
          "[NearbyHelpScreen] Ignoring stale service request:",
          requestId
        );
        return;
      }

      console.log(
        `[NearbyHelpScreen] Received ${results.length} services for ${selectedCategory}`
      );

      setServices(results);
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      console.warn(
        "[NearbyHelpScreen] Failed to load services:",
        err
      );

      setServices([]);
    } finally {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!locationReady || !userLocation) {
      return;
    }

    loadServices(false);
  }, [locationReady, userLocation, selectedCategory]);

  const handleCall = (phone?: string) => {
    if (!phone) return;
    const cleanNumber = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanNumber}`).catch((err) =>
      console.warn("[NearbyHelpScreen] Dialer error:", err)
    );
  };

  const handleDirections = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch((err) =>
      console.warn("[NearbyHelpScreen] Map directions error:", err)
    );
  };

  const getCategoryIcon = (type: EmergencyServiceCategory) => {
    switch (type) {
      case "POLICE":
        return <ShieldCheck size={18} color={colors.primary} />;
      case "HOSPITAL":
        return <Hospital size={18} color={colors.emergency} />;
      case "AMBULANCE":
        return <Ambulance size={18} color={colors.emergency} />;
      case "WOMEN_SUPPORT":
        return <HeartHandshake size={18} color={colors.primary} />;
      case "NGO":
        return <Building2 size={18} color={colors.accent} />;
      case "PUBLIC_TRANSPORT":
        return <Bus size={18} color={colors.mutedForeground} />;
    }
  };

  const safeSpotMarkers: SafeSpotMarker[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type === "POLICE" ? "police" : s.type === "HOSPITAL" ? "hospital" : "shelter",
    lat: s.latitude,
    lng: s.longitude,
    phone: s.phone,
  }));

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavBar
          title="Nearby help"
          onBack={onBack}
          action={
            <Pressable
              onPress={() => setView(view === "map" ? "list" : "map")}
              accessibilityLabel="Toggle view"
              style={styles.toggleBtn}
            >
              {view === "map" ? (
                <List size={18} color={colors.foreground} />
              ) : (
                <MapIcon size={18} color={colors.foreground} />
              )}
            </Pressable>
          }
        />
      </View>
      <View style={styles.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {CATEGORY_CHIPS.map((f) => (
            <Chip
              key={f.id}
              active={selectedCategory === f.id}
              onPress={() => setSelectedCategory(f.id)}
            >
              {f.label}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {view === "map" ? (
        <View style={styles.mapContainer}>
        {userLocation && (
              <LiveTrackingMapView
                userLocation={userLocation}
                safeSpots={safeSpotMarkers}
                isFullScreen={true}
              />
        )}
          {services[0] && (
            <Card style={styles.mapBottomCard}>
              <View style={styles.placeIconWrap}>
                {getCategoryIcon(services[0].type)}
              </View>
              <View style={styles.placeTextWrap}>
                <Text style={styles.placeTitle} numberOfLines={1}>
                  {services[0].name}
                </Text>
                <Text style={styles.placeDetail}>
                  {services[0].distanceKm.toFixed(1)} km · {services[0].address || "Verified Location"}
                </Text>
              </View>
              <Pressable
                onPress={() => handleDirections(services[0].latitude, services[0].longitude)}
                style={styles.mapNavCircle}
                accessibilityLabel="Get directions"
              >
                <Navigation size={18} color={colors.primaryForeground} />
              </Pressable>
            </Card>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadServices(true)} />}
        >
          {/* Emergency Hotlines Section */}
          <Text style={styles.sectionHeading}>DIRECT HELPLINES</Text>
          <View style={styles.hotlinesGrid}>
            {EMERGENCY_HOTLINES.map((h) => (
              <Card key={h.id} style={styles.hotlineCard}>
                <View style={styles.hotlineHeader}>
                  <Text style={styles.hotlineLabel} numberOfLines={2}>
                    {h.label}
                  </Text>

                  <Text style={styles.hotlineNumber}>
                    {h.number}
                  </Text>
                </View>
                <Text style={styles.hotlineTag}>{h.tag}</Text>
                <Pressable
                  onPress={() => handleCall(h.number)}
                  style={styles.callHotlineBtn}
                  accessibilityLabel={`Call ${h.label} ${h.number}`}
                >
                  <PhoneCall size={14} color={colors.emergencyForeground} />
                  <Text style={styles.callHotlineBtnText}>Call {h.number}</Text>
                </Pressable>
              </Card>
            ))}
          </View>

          {/* Nearby Services List Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>
              NEARBY LOCATIONS{!loading ? ` (${services.length})` : ""}
            </Text>

            {loading && (
              <View style={styles.loadingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingIndicatorText}>Finding nearby help...</Text>
              </View>
            )}
          </View>

          {services.length === 0 && !loading ? (
            <Card style={styles.emptyCard}>
              <MapPin size={28} color={colors.mutedForeground} />
              <Text style={styles.emptyCardTitle}>No services found in this category</Text>
              <Text style={styles.emptyCardSub}>
                Try selecting "All" or pull down to refresh OpenStreetMap data.
              </Text>
            </Card>
          ) : (
            <View style={styles.servicesList}>
              {services.map((item) => (
                <Card key={item.id} style={styles.serviceCard}>
                  <View style={styles.serviceCardTopRow}>
                    <View style={styles.serviceIconCircle}>{getCategoryIcon(item.type)}</View>
                    <View style={styles.serviceInfoWrap}>
                      <Text style={styles.serviceName}>{item.name}</Text>
                      {item.address ? (
                        <Text style={styles.serviceAddress} numberOfLines={2}>
                          {item.address}
                        </Text>
                      ) : null}
                      <Text style={styles.serviceDistance}>
                        {item.distanceKm.toFixed(1)} km away
                        {item.isOpen ? " · Open 24/7" : ""}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.serviceActionsRow}>
                    <Pressable
                      onPress={() => handleDirections(item.latitude, item.longitude)}
                      style={styles.actionBtnSecondary}
                      accessibilityLabel="Get Directions"
                    >
                      <Navigation size={14} color={colors.foreground} />
                      <Text style={styles.actionBtnSecondaryText}>Directions</Text>
                    </Pressable>

                    {item.phone ? (
                      <Pressable
                        onPress={() => handleCall(item.phone)}
                        style={styles.actionBtnPrimary}
                        accessibilityLabel="Call Service"
                      >
                        <PhoneCall size={14} color={colors.primaryForeground} />
                        <Text style={styles.actionBtnPrimaryText}>Call</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filtersRow: { paddingVertical: 10 },
  filtersScroll: { paddingHorizontal: 20, gap: 8 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  hotlinesGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  hotlineCard: {
    flex: 1,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    minHeight: 160,
  },

  hotlineHeader: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
  },

  hotlineLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    color: colors.mutedForeground,
  },

  hotlineNumber: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.emergency,
  },

  hotlineTag: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.mutedForeground,
    marginVertical: 2,
  },

  callHotlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.emergency,
    paddingVertical: 8,
    borderRadius: radii.sm,
    marginTop: "auto",
  },

  callHotlineBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.emergencyForeground,
  },
  servicesList: { gap: 10 },
  serviceCard: {
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },

  serviceCardTopRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  serviceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceInfoWrap: { flex: 1 },
  serviceName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.foreground,
  },

  serviceAddress: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  serviceDistance: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 3,
  },

  serviceActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.foreground,
  },

  actionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  actionBtnPrimaryText: { fontSize: 12, fontWeight: "600", color: colors.primaryForeground },
    emptyCard: {
      paddingVertical: 28,
      paddingHorizontal: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },

    emptyCardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
      textAlign: "center",
    },

    emptyCardSub: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.mutedForeground,
      textAlign: "center",
      maxWidth: 300,
    },
  placeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  placeTextWrap: { flex: 1 },
  placeTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground },
  placeDetail: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  mapNavCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
    loadingIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    loadingIndicatorText: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
});
