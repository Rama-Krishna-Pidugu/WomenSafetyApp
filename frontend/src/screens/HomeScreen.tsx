import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bell,
  ShieldCheck,
  ChevronRight,
  UserRoundPlus,
  Route as RouteIcon,
  Ambulance,
  Sparkles,
  Flag,
  Users,
  Siren,
  AlertTriangle,
  Clock,
  MapPin,
  PhoneCall,
  Map,
  Share2,
} from "lucide-react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { colors, gradientBrand, radii } from "../theme/tokens";
import { Card } from "../components/ds/Card";
import { SectionHeader } from "../components/ds/SectionHeader";
import { BottomNav, type TabKey } from "../components/app/BottomNav";
import { Dialog } from "../components/ds/Dialog";
import { AppButton } from "../components/ds/AppButton";
import { getMyProfile } from "../services/profileService";
import { locationService } from "../modules/location/services/locationService";
import { SosCountdownOverlay } from "../components/app/SosCountdownOverlay";
import {
  startShakeDetection,
  stopShakeDetection,
  addShakeTriggerListener,
} from "../services/sosNativeService";
import type { SOSTriggerSource } from "../services/sosOrchestratorService";

export type HomeState = "default" | "monitoring" | "caution" | "loading";

const QUICK_ACTIONS = [
  { label: "Safe Route", icon: RouteIcon },
  { label: "Live Map", icon: Map },
  { label: "Share Live", icon: Share2 },
  { label: "Nearby Help", icon: ShieldCheck },
  { label: "AI Assistant", icon: Sparkles },
  { label: "Report Area", icon: Flag },
  { label: "Contacts", icon: Users },
  { label: "Fake Call", icon: PhoneCall },
  { label: "Register Face", icon: UserRoundPlus },
];

const RECENT_ACTIVITY = [
  { id: "1", kind: "journey", title: "Safe walk completed", detail: "Indiranagar to Koramangala • 18 min", time: "22m ago" },
  { id: "2", kind: "sos", title: "Test SOS pulse", detail: "All 3 emergency contacts responded", time: "2h ago" },
  { id: "3", kind: "report", title: "Area safety update", detail: "Street lighting issue reported in Sector 4", time: "1d ago" },
];

function HeroSos({ pressed, onPress }: { pressed: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.3] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  return (
    <View style={styles.sosContainer}>
      <Pressable
        onPress={onPress}
        accessibilityLabel="Press and hold to send SOS"
        style={styles.sosTouchable}
      >
        <Animated.View
          style={[
            styles.sosPulseOuter,
            { transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
        <View style={styles.sosPulseInner} />
        <View style={[styles.sosCore, pressed && styles.sosCorePressed]}>
          <Text style={styles.sosText}>SOS</Text>
        </View>
      </Pressable>
      <Text style={styles.sosSubtext}>
        {pressed ? "Keep holding…" : "Press and hold for 3 seconds"}
      </Text>
    </View>
  );
}

export function HomeScreen({
  state = "default",
  onSos,
  onNotifications,
  onSafetyMode,
  onAssistant,
  onQuickAction,
  onQuickActionLongPress,
  onTab,
  locationPermissionGranted = true,
  notificationPermissionGranted = true,
}: {
  state?: HomeState;
  onSos?: () => void;
  onNotifications?: () => void;
  onSafetyMode?: () => void;
  onAssistant?: () => void;
  onQuickAction?: (actionLabel: string) => void;
  onQuickActionLongPress?: (actionLabel: string) => void;
  onTab?: (t: TabKey) => void;
  locationPermissionGranted?: boolean;
  notificationPermissionGranted?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const loading = state === "loading";

  // ── Profile User Name & Initials lookup ─────────────────────
  const [userName, setUserName] = useState<string>("User");
  const [userInitials, setUserInitials] = useState<string>("U");

  useEffect(() => {
    let isMounted = true;
    getMyProfile()
      .then((profile) => {
        if (!isMounted || !profile) return;
        const rawName = profile.full_name || (profile as any).name || "User";
        const parts = rawName.trim().split(" ");
        const firstName = parts[0] || rawName;
        const initials = parts.map((p: string) => p[0]).join("").toUpperCase().slice(0, 2) || "U";
        setUserName(firstName);
        setUserInitials(initials);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Real-time area name lookup ────────────────────────────────
  const [userAreaName, setUserAreaName] = useState<string>("Mandadam");

  useEffect(() => {
    locationService
      .getCurrentLocation()
      .then((loc) => {
        if (loc?.address) {
          const area =
            loc.address.city ||
            loc.address.street ||
            loc.address.region;
          if (area) {
            setUserAreaName(area);
            return;
          }
        }
        if (loc?.coordinates) {
          setUserAreaName(`${loc.coordinates.latitude.toFixed(4)}, ${loc.coordinates.longitude.toFixed(4)}`);
        }
      })
      .catch(() => {});
  }, []);

  // ── Countdown overlay state ───────────────────────────────────
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdownSource, setCountdownSource] = useState<SOSTriggerSource>("BUTTON");

  const showCountdown = useCallback(
    (source: SOSTriggerSource) => {
      setCountdownSource(source);
      setCountdownVisible(true);
    },
    []
  );

  const handleCountdownFire = useCallback(() => {
    setCountdownVisible(false);
    setPressed(true);
    onSos?.();
  }, [onSos]);

  const handleCountdownCancel = useCallback(() => {
    setCountdownVisible(false);
    setPressed(false);
  }, []);

  // ── Start native shake-detection service on mount ────────────
  useEffect(() => {
    startShakeDetection();
    const sub = addShakeTriggerListener(() => {
      showCountdown("SHAKE");
    });
    return () => {
      sub.remove();
      stopShakeDetection();
    };
  }, [showCountdown]);

  const handleSosTrigger = useCallback(async () => {
    try {
      if (typeof Location?.requestForegroundPermissionsAsync === "function") {
        await Location.requestForegroundPermissionsAsync();
      }
      if (typeof Notifications?.requestPermissionsAsync === "function") {
        await Notifications.requestPermissionsAsync();
      }
    } catch (err) {
      console.warn("Native SOS permission request error:", err);
    }
    showCountdown("BUTTON");
  }, [showCountdown]);

  const status =
    state === "monitoring"
      ? { tone: "brand", title: "Safety Mode is on", sub: `${userAreaName} • arriving 9:36 PM` }
      : state === "caution"
      ? { tone: "warning", title: "Extra care tonight", sub: `3 recent reports in ${userAreaName}` }
      : { tone: "success", title: "You're in a safe area", sub: `${userAreaName} • updated just now` };

  return (
    <View style={styles.screen}>
      {/* SOS Countdown Overlay — appears over everything for 4 s before firing */}
      <SosCountdownOverlay
        visible={countdownVisible}
        triggerSource={countdownSource}
        onFire={handleCountdownFire}
        onCancel={handleCountdownCancel}
      />

      <View style={styles.header}>
        <LinearGradient colors={gradientBrand as unknown as [string, string, ...string[]]} style={styles.avatar}>
          <Text style={styles.avatarText}>{userInitials}</Text>
        </LinearGradient>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>Good evening,</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
        <Pressable
          onPress={onNotifications}
          accessibilityLabel="Notifications"
          style={styles.bellButton}
        >
          <Bell size={20} color={colors.foreground} strokeWidth={1.8} />
          <View style={styles.bellBadge} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Pill */}
        <View
          style={[
            styles.statusPill,
            status.tone === "success" && styles.statusSuccess,
            status.tone === "warning" && styles.statusWarning,
            status.tone === "brand" && styles.statusBrand,
          ]}
        >
          <View style={styles.statusDotOuter}>
            <View
              style={[
                styles.statusDotInner,
                {
                  backgroundColor:
                    status.tone === "success"
                      ? colors.success
                      : status.tone === "warning"
                      ? colors.warning
                      : colors.primary,
                },
              ]}
            />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>{status.title}</Text>
            <Text style={styles.statusSub}>{status.sub}</Text>
          </View>
        </View>

        {/* SOS Button */}
        <HeroSos
          pressed={pressed}
          onPress={handleSosTrigger}
        />

        {/* Safety Mode Banner */}
        <Pressable onPress={onSafetyMode} style={styles.safetyModeCard}>
          <LinearGradient colors={gradientBrand as unknown as [string, string, ...string[]]} style={styles.safetyModeIcon}>
            <ShieldCheck size={22} color={colors.primaryForeground} strokeWidth={2} />
          </LinearGradient>
          <View style={styles.safetyModeText}>
            <Text style={styles.safetyModeTitle}>
              {state === "monitoring" ? "Journey in progress" : "Start Safety Mode"}
            </Text>
            <Text style={styles.safetyModeSub}>
              {state === "monitoring"
                ? "2 contacts watching • tap to view"
                : "We watch over your journey until you arrive"}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.mutedForeground} />
        </Pressable>

        {/* Quick Actions Grid */}
        <View style={styles.section}>
          <SectionHeader title="Quick actions" />
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
              <Pressable
                key={label}
                onPress={() => onQuickAction?.(label)}
                onLongPress={() => onQuickActionLongPress?.(label)}
                delayLongPress={300}
                style={styles.actionItem}
              >
                <Icon size={22} color={colors.primary} strokeWidth={1.8} />
                <Text style={styles.actionLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <SectionHeader title="Recent activity" action="See all" />
          {loading ? (
            <Text style={styles.loadingText}>Loading activity...</Text>
          ) : (
            <View style={styles.activityList}>
              {RECENT_ACTIVITY.map((item) => {
                const Icon =
                  item.kind === "journey"
                    ? RouteIcon
                    : item.kind === "sos"
                    ? Siren
                    : item.kind === "report"
                    ? Flag
                    : AlertTriangle;
                return (
                  <Card key={item.id} style={styles.activityCard}>
                    <View style={styles.activityIconWrap}>
                      <Icon size={18} color={colors.mutedForeground} strokeWidth={1.8} />
                    </View>
                    <View style={styles.activityTextWrap}>
                      <Text style={styles.activityTitle}>{item.title}</Text>
                      <Text style={styles.activityDetail}>{item.detail}</Text>
                    </View>
                    <View style={styles.activityTimeWrap}>
                      <Clock size={12} color={colors.mutedForeground} />
                      <Text style={styles.activityTime}>{item.time}</Text>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.footerNote}>
          <MapPin size={14} color={colors.mutedForeground} />
          <Text style={styles.footerNoteText}>Location is only used while you need it</Text>
        </View>
      </ScrollView>

      <BottomNav active="home" sos={false} onSelect={onTab} onAssistant={onAssistant} onSos={onSos} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 15 },
  headerText: { flex: 1 },
  greeting: { fontSize: 13, color: colors.mutedForeground },
  userName: { fontSize: 19, fontWeight: "700", letterSpacing: -0.2, color: colors.foreground },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.emergency,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 16,
  },
  statusSuccess: { backgroundColor: `${colors.success}15` },
  statusWarning: { backgroundColor: `${colors.warning}18` },
  statusBrand: { backgroundColor: `${colors.primary}15` },
  statusDotOuter: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statusDotInner: { width: 10, height: 10, borderRadius: 5 },
  statusTextContainer: { flex: 1 },
  statusTitle: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  statusSub: { fontSize: 13, color: colors.mutedForeground },
  sosContainer: { alignItems: "center", marginVertical: 16 },
  sosTouchable: { width: 180, height: 180, alignItems: "center", justifyContent: "center" },
  sosPulseOuter: {
    ...StyleSheet.absoluteFill,
    borderRadius: 90,
    backgroundColor: `${colors.emergency}25`,
  },
  sosPulseInner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 74,
    backgroundColor: `${colors.emergency}15`,
  },
  sosCore: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: colors.emergency,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  sosCorePressed: { transform: [{ scale: 0.95 }] },
  sosText: { fontSize: 32, fontWeight: "800", color: colors.emergencyForeground, letterSpacing: 1 },
  sosSubtext: { marginTop: 12, fontSize: 14, color: colors.mutedForeground },
  safetyModeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl2,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  safetyModeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  safetyModeText: { flex: 1 },
  safetyModeTitle: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  safetyModeSub: { fontSize: 13, color: colors.mutedForeground },
  section: { marginBottom: 24 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionItem: {
    width: "31%",
    height: 92,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  actionLabel: { fontSize: 12, fontWeight: "600", color: colors.foreground, textAlign: "center" },
  activityList: { gap: 10 },
  activityCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTextWrap: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  activityDetail: { fontSize: 12, color: colors.mutedForeground },
  activityTimeWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  activityTime: { fontSize: 12, color: colors.mutedForeground },
  loadingText: { fontSize: 14, color: colors.mutedForeground, textAlign: "center", paddingVertical: 12 },
  footerNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 },
  footerNoteText: { fontSize: 12, color: colors.mutedForeground },
});

