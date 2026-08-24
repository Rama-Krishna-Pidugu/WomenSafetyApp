import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Alert } from "react-native";
import {
  Battery,
  Clock,
  MapPin,
  Navigation,
  Shield,
  Share2,
  AlertTriangle,
  Radio,
  User,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react-native";
import { colors, radii } from "../theme/tokens";
import { NavBar } from "../components/ds/NavBar";
import { Badge } from "../components/ds/Badge";
import { AppButton } from "../components/ds/AppButton";
import { LiveTrackingMapView, LatLng } from "../components/app/LiveTrackingMapView";
import { getLiveLocation, stopLiveLocationSharing } from "../services/liveLocationSharing";
import { locationService } from "../modules/location/services/locationService";
import { getPublicTrackingUrl } from "../utils/trackingUrl";

export function FamilyLiveTrackingScreen({
  sessionId = "trk_demo",
  destinationName = "Home · Nandi Layout",
  destinationLat = 12.985,
  destinationLng = 77.605,
  onBack,
  onEmergencyAlert,
}: {
  sessionId?: string;
  destinationName?: string;
  destinationLat?: number;
  destinationLng?: number;
  onBack?: () => void;
  onEmergencyAlert?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Priya Sharma");
  const [userLocation, setUserLocation] = useState<LatLng>({ lat: 12.9716, lng: 77.5946 });
  const [distanceKm, setDistanceKm] = useState(3.4);
  const [etaMinutes, setEtaMinutes] = useState(14);
  const [batteryLevel, setBatteryLevel] = useState(88);
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [signalLost, setSignalLost] = useState(false);
  const [userConfirmedSafe, setUserConfirmedSafe] = useState(false);
  const destinationLocation: LatLng = { lat: destinationLat, lng: destinationLng };

  // Fetch live tracking feed from Firebase RTDB every 4 seconds
  useEffect(() => {
    let interval: any;

    const fetchLiveFeed = async () => {
      if (userConfirmedSafe) return;

      const data = await getLiveLocation(sessionId);
      if (data) {
        setSignalLost(false);
        setUserName(data.userName || "User");
        setUserLocation({ lat: data.lat, lng: data.lng });
        setBatteryLevel(data.batteryLevel ?? 85);
        setIsLiveActive(data.active);
        setLastUpdated(
          new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        );

        const remDist = locationService.calculateDistanceKm(
          data.lat,
          data.lng,
          destinationLocation.lat,
          destinationLocation.lng
        );
        setDistanceKm(remDist);
        setEtaMinutes(locationService.calculateETA(remDist, 15));
      } else {
        setSignalLost(true);
      }
      setLoading(false);
    };

    fetchLiveFeed();
    interval = setInterval(fetchLiveFeed, 4000);

    return () => clearInterval(interval);
  }, [sessionId, userConfirmedSafe]);

  const handleStopLiveTracking = async () => {
    setUserConfirmedSafe(true);
    setIsLiveActive(false);
    await stopLiveLocationSharing(sessionId);
  };

  const handleShareTrackingLink = async () => {
    try {
      const trackingUrl = getPublicTrackingUrl(sessionId);
      await Share.share({
        message: `🛡️ Live Safety Tracking: ${userName} is currently traveling to ${destinationName}. Track live location on map: ${trackingUrl}`,
      });
    } catch (error) {
      /* ignore */
    }
  };

  return (
    <View style={styles.screen}>
      <NavBar title="Live Family Tracking" onBack={onBack} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Live Status Header */}
        <View style={styles.liveBanner}>
          <View style={styles.liveStatusRow}>
            <View style={styles.liveIndicator}>
              <Radio size={16} color="#10B981" />
              <Text style={styles.liveText}>{isLiveActive ? "LIVE TRACKING ACTIVE" : "SESSION ENDED"}</Text>
            </View>
            <Badge tone="success">4s Auto-Sync</Badge>
          </View>
          <Text style={styles.userInfoTitle}>Tracking {userName}</Text>
          <Text style={styles.lastSyncText}>
            {signalLost ? `Location signal lost — last seen at ${lastUpdated}` : `Last updated: ${lastUpdated}`}
          </Text>
        </View>

        {/* OpenStreetMap Component */}
        <View style={styles.mapContainer}>
          <LiveTrackingMapView
            userLocation={userLocation}
            destination={destinationLocation}
            isFamilyView={true}
            showGeofence={true}
            geofenceRadiusMeters={400}
            height={260}
          />
        </View>

        {/* Realtime Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Clock size={20} color={colors.primary} />
            <Text style={styles.metricValue}>{etaMinutes} min</Text>
            <Text style={styles.metricLabel}>Estimated Arrival</Text>
          </View>

          <View style={styles.metricCard}>
            <Navigation size={20} color="#3B82F6" />
            <Text style={styles.metricValue}>{distanceKm} km</Text>
            <Text style={styles.metricLabel}>Distance Left</Text>
          </View>

          <View style={styles.metricCard}>
            <Battery size={20} color="#10B981" />
            <Text style={styles.metricValue}>{batteryLevel}%</Text>
            <Text style={styles.metricLabel}>Battery</Text>
          </View>
        </View>

        {/* Route Details Card */}
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <MapPin size={18} color={colors.primary} />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Destination</Text>
              <Text style={styles.detailValue}>{destinationName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Shield size={18} color="#10B981" />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Safety Status</Text>
              <Text style={styles.detailValue}>On Safe Corridor · Lit Main Road</Text>
            </View>
          </View>
        </View>

        {/* Safe Confirmation Banner */}
        {userConfirmedSafe ? (
          <View style={styles.safeBanner}>
            <CheckCircle2 size={24} color="#10B981" />
            <View style={styles.safeBannerTextWrap}>
              <Text style={styles.safeBannerTitle}>User Confirmed Safe</Text>
              <Text style={styles.safeBannerSub}>Live location tracking stream has been stopped.</Text>
            </View>
          </View>
        ) : (
          <Pressable style={styles.stopTrackingCard} onPress={handleStopLiveTracking}>
            <ShieldCheck size={22} color="#10B981" />
            <View style={styles.emergencyTextWrap}>
              <Text style={styles.stopTrackingTitle}>I'm Safe — Stop Live Location</Text>
              <Text style={styles.emergencySub}>Close live stream and confirm user safe arrival</Text>
            </View>
          </Pressable>
        )}

        {/* Emergency Assistance Button */}
        <Pressable style={styles.emergencyCard} onPress={onEmergencyAlert}>
          <AlertTriangle size={22} color="#EF4444" />
          <View style={styles.emergencyTextWrap}>
            <Text style={styles.emergencyTitle}>Trigger Emergency Assistance</Text>
            <Text style={styles.emergencySub}>Alert emergency contacts and dispatch police immediately</Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Footer Share Action */}
      <View style={styles.footer}>
        <AppButton leading={<Share2 size={18} color="#fff" />} onPress={handleShareTrackingLink}>
          Share Tracking Link
        </AppButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  liveBanner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 16,
    marginVertical: 12,
    gap: 6,
  },
  liveStatusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveIndicator: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveText: { fontSize: 12, fontWeight: "800", color: "#10B981", letterSpacing: 0.5 },
  userInfoTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground, marginTop: 4 },
  lastSyncText: { fontSize: 12, color: colors.mutedForeground },
  mapContainer: { marginBottom: 16 },
  metricsGrid: { flexDirection: "row", gap: 10, marginBottom: 16 },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  metricValue: { fontSize: 16, fontWeight: "800", color: colors.foreground },
  metricLabel: { fontSize: 11, color: colors.mutedForeground, textAlign: "center" },
  detailCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailTextWrap: { flex: 1 },
  detailLabel: { fontSize: 12, color: colors.mutedForeground },
  detailValue: { fontSize: 14, fontWeight: "700", color: colors.foreground },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  stopTrackingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B98115",
    borderWidth: 1,
    borderColor: "#10B98140",
    borderRadius: radii.xl,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  stopTrackingTitle: { fontSize: 15, fontWeight: "800", color: "#10B981" },
  safeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B98120",
    borderWidth: 1,
    borderColor: "#10B98160",
    borderRadius: radii.xl,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  safeBannerTextWrap: { flex: 1 },
  safeBannerTitle: { fontSize: 16, fontWeight: "800", color: "#10B981" },
  safeBannerSub: { fontSize: 12, color: colors.foreground, marginTop: 2 },
  emergencyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF444415",
    borderWidth: 1,
    borderColor: "#EF444440",
    borderRadius: radii.xl,
    padding: 16,
    gap: 12,
  },
  emergencyTextWrap: { flex: 1 },
  emergencyTitle: { fontSize: 15, fontWeight: "800", color: "#EF4444" },
  emergencySub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  footer: { paddingHorizontal: 16, paddingBottom: 20 },
});
