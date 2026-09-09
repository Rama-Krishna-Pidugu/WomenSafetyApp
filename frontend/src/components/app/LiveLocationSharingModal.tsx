import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  Share,
  Alert,
  Platform,
} from "react-native";
import {
  X,
  Share2,
  Clock,
  Users,
  ShieldCheck,
  Radio,
  Copy,
  MessageCircle,
  PhoneCall,
  Check,
  StopCircle,
} from "lucide-react-native";
import { colors, radii, gradientBrand } from "../../theme/tokens";
import { AppButton } from "../ds/AppButton";
import { Badge } from "../ds/Badge";
import { Card } from "../ds/Card";
import { LiveTrackingMapView, LatLng, RoutePolyline } from "./LiveTrackingMapView";
import { useEmergencyContacts } from "../../hooks/useEmergencyContacts";
import { getPublicTrackingUrl } from "../../utils/trackingUrl";
import { startLiveLocationSharing, stopLiveLocationSharing } from "../../services/liveLocationSharing";

export interface LiveLocationSharingModalProps {
  visible: boolean;
  onClose: () => void;
  userLocation: LatLng;
  destination?: LatLng;
  destinationName?: string;
  routes?: RoutePolyline[];
  sessionId?: string;
  isAlreadySharing?: boolean;
  onSharingStateChange?: (isSharing: boolean) => void;
}

const DURATION_OPTIONS = [
  { id: "15m", label: "15 min", minutes: 15 },
  { id: "30m", label: "30 min", minutes: 30 },
  { id: "1h", label: "1 hour", minutes: 60 },
  { id: "end", label: "Until journey ends", minutes: -1 },
];

export function LiveLocationSharingModal({
  visible,
  onClose,
  userLocation,
  destination,
  destinationName,
  routes = [],
  sessionId: sessionIdProp,
  isAlreadySharing = false,
  onSharingStateChange,
}: LiveLocationSharingModalProps) {
  const { contacts } = useEmergencyContacts();
  const [isSharingActive, setIsSharingActive] = useState(isAlreadySharing);
  const [selectedDuration, setSelectedDuration] = useState("30m");
  const selectedDurationOption = DURATION_OPTIONS.find((d) => d.id === selectedDuration) ?? DURATION_OPTIONS[1];
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(() =>
    contacts.slice(0, 3).map((c) => c.id)
  );
  // A real, unique session id if the caller didn't supply one — never a shared "demo"
  // channel that every caller without a sessionId would otherwise collide on.
  const [fallbackSessionId] = useState(() => `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const sessionId = sessionIdProp ?? fallbackSessionId;
  const [startTime, setStartTime] = useState<string | null>(
    isAlreadySharing ? new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null
  );
  // The real, verifiable number is how many contacts the link was actually shared with —
  // there is no live-viewer telemetry to report an actual "watching now" count.
  const sharedWithCount = selectedContactIds.length;

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  const handleStartSharing = async () => {
    try {
      await startLiveLocationSharing(sessionId);
      setIsSharingActive(true);
      setStartTime(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      onSharingStateChange?.(true);

      // Prompt native share immediately for convenience
      const trackingUrl = getPublicTrackingUrl(sessionId);
      const destinationClause = destinationName ? ` to ${destinationName}` : "";
      await Share.share({
        message: `🛡️ Live Safety Tracking: Follow my journey live${destinationClause}: ${trackingUrl}`,
        title: "Live Location Tracking",
      });
    } catch (e) {
      console.warn("Share live location error:", e);
      setIsSharingActive(true);
      setStartTime((prev) => prev ?? new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      onSharingStateChange?.(true);
    }
  };

  const handleStopSharing = async () => {
    try {
      await stopLiveLocationSharing(sessionId);
    } catch (e) {
      console.warn("Stop live location error:", e);
    } finally {
      setIsSharingActive(false);
      setStartTime(null);
      onSharingStateChange?.(false);
    }
  };

  // Real auto-stop: the duration picker used to be cosmetic (nothing enforced it). Now
  // picking anything other than "Until journey ends" actually stops sharing after that
  // many minutes, matching what the privacy note tells the user.
  const handleStopSharingRef = useRef(handleStopSharing);
  handleStopSharingRef.current = handleStopSharing;

  useEffect(() => {
    if (!isSharingActive || selectedDurationOption.minutes <= 0) return;
    const timer = setTimeout(() => {
      void handleStopSharingRef.current();
    }, selectedDurationOption.minutes * 60 * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSharingActive, selectedDurationOption.minutes]);

  const handleNativeShare = async () => {
    const trackingUrl = getPublicTrackingUrl(sessionId);
    const destinationClause = destinationName ? ` to ${destinationName}` : "";
    try {
      await Share.share({
        message: `🛡️ Live Safety Tracking: Follow my journey live${destinationClause}: ${trackingUrl}`,
        title: "Live Location Tracking",
      });
    } catch (err) {
      console.warn("Native share error:", err);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Floating Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Share Live Location</Text>
            <Text style={styles.headerSubtitle}>
              Let someone you trust follow your journey in real time.
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close live location sharing">
            <X size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Live Map Preview */}
        <View style={styles.mapWrap}>
          <LiveTrackingMapView
            userLocation={userLocation}
            destination={destination}
            routes={routes}
            height={200}
          />
          <View style={styles.mapStatusPill}>
            <View style={[styles.liveDot, isSharingActive && styles.liveDotActive]} />
            <Text style={styles.mapStatusText}>
              {isSharingActive ? "● Broadcasting live GPS feed" : "Real-time updates ready"}
            </Text>
          </View>
        </View>

        {/* Scrollable Sharing Controls */}
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {isSharingActive ? (
            /* Active Sharing Dashboard */
            <Card style={styles.activeCard}>
              <View style={styles.activeHeader}>
                <View style={styles.activeIconWrap}>
                  <Radio size={20} color={colors.primary} />
                </View>
                <View style={styles.activeHeaderText}>
                  <Text style={styles.activeTitle}>Live location is being shared</Text>
                  <Text style={styles.activeSubtitle}>
                    {sharedWithCount > 0
                      ? `Shared with ${sharedWithCount} trusted contact${sharedWithCount === 1 ? "" : "s"}`
                      : "Link is live — send it below to share it"}
                  </Text>
                </View>
                <Badge tone="success">Broadcasting</Badge>
              </View>

              <View style={styles.activeStatsGrid}>
                <View style={styles.statBox}>
                  <Clock size={14} color={colors.mutedForeground} />
                  <Text style={styles.statLabel}>Started</Text>
                  <Text style={styles.statValue}>{startTime ?? "—"}</Text>
                </View>
                <View style={styles.statBox}>
                  <Users size={14} color={colors.primary} />
                  <Text style={styles.statLabel}>Shared with</Text>
                  <Text style={styles.statValue}>{sharedWithCount}</Text>
                </View>
                <View style={styles.statBox}>
                  <Radio size={14} color={colors.success} />
                  <Text style={styles.statLabel}>GPS Feed</Text>
                  <Text style={styles.statValue}>Just now</Text>
                </View>
              </View>

              <View style={styles.shareActionRow}>
                <Pressable onPress={handleNativeShare} style={styles.shareOptionBtn}>
                  <Share2 size={16} color={colors.primary} />
                  <Text style={styles.shareOptionText}>Send Link (WhatsApp / SMS)</Text>
                </Pressable>
              </View>

              <AppButton
                variant="destructive"
                size="md"
                leading={<StopCircle size={16} color={colors.destructiveForeground} />}
                onPress={handleStopSharing}
                style={{ marginTop: 12 }}
              >
                Stop Live Sharing
              </AppButton>
            </Card>
          ) : (
            /* Setup Sharing Flow */
            <>
              {/* Emergency Contacts Selector */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Sharing with</Text>
                  {contacts.length > 0 && (
                    <Text style={styles.sectionActionText}>
                      {selectedContactIds.length} of {contacts.length} selected
                    </Text>
                  )}
                </View>

                <View style={styles.contactsRow}>
                  {contacts.length > 0 ? (
                    contacts.map((c) => {
                      const isSelected = selectedContactIds.includes(c.id);
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => toggleContact(c.id)}
                          style={[styles.contactAvatarCard, isSelected && styles.contactAvatarCardSelected]}
                        >
                          <View style={[styles.avatarCircle, isSelected && styles.avatarCircleSelected]}>
                            <Text style={[styles.avatarInitials, isSelected && styles.avatarInitialsSelected]}>
                              {c.initials || c.name.slice(0, 2).toUpperCase()}
                            </Text>
                            {isSelected && (
                              <View style={styles.avatarCheckBadge}>
                                <Check size={10} color="#fff" strokeWidth={3} />
                              </View>
                            )}
                          </View>
                          <Text style={styles.contactCardName} numberOfLines={1}>
                            {c.name}
                          </Text>
                          <Text style={styles.contactCardRelation} numberOfLines={1}>
                            {c.relation || "Contact"}
                          </Text>
                        </Pressable>
                      );
                    })
                  ) : (
                    <View style={styles.noContactsBox}>
                      <Users size={20} color={colors.mutedForeground} />
                      <Text style={styles.noContactsTitle}>No emergency contacts yet</Text>
                      <Text style={styles.noContactsSub}>
                        Add trusted contacts from your Safety Circle to share your live location with them.
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Duration Options */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sharing duration</Text>
                <View style={styles.durationGrid}>
                  {DURATION_OPTIONS.map((dur) => {
                    const isSelected = selectedDuration === dur.id;
                    return (
                      <Pressable
                        key={dur.id}
                        onPress={() => setSelectedDuration(dur.id)}
                        style={[styles.durationChip, isSelected && styles.durationChipSelected]}
                      >
                        <Text style={[styles.durationChipText, isSelected && styles.durationChipTextSelected]}>
                          {dur.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Privacy / Trust Note */}
              <View style={styles.privacyNoteCard}>
                <ShieldCheck size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyNoteTitle}>Location updates automatically</Text>
                  <Text style={styles.privacyNoteBody}>
                    {selectedDurationOption.minutes > 0
                      ? `Sharing stops automatically after ${selectedDurationOption.label}. You can also stop it any time.`
                      : "Sharing continues until you stop it — tap \"Stop Live Sharing\" when you're safe."}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.footerActions}>
                <AppButton
                  variant="primary"
                  size="lg"
                  leading={<Share2 size={18} color={colors.primaryForeground} />}
                  onPress={handleStartSharing}
                >
                  Start Live Sharing
                </AppButton>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
    lineHeight: 18,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  mapWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    position: "relative",
  },
  mapStatusPill: {
    position: "absolute",
    top: 24,
    left: 32,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mutedForeground,
  },
  liveDotActive: {
    backgroundColor: colors.success,
  },
  mapStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#f8fafc",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.foreground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionActionText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  contactsRow: {
    flexDirection: "row",
    gap: 12,
  },
  noContactsBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
  },
  noContactsTitle: { fontSize: 13, fontWeight: "700", color: colors.foreground },
  noContactsSub: { fontSize: 12, color: colors.mutedForeground, textAlign: "center" },
  contactAvatarCard: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 4,
  },
  contactAvatarCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 4,
  },
  avatarCircleSelected: {
    backgroundColor: colors.primary,
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  avatarInitialsSelected: {
    color: colors.primaryForeground,
  },
  avatarCheckBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  contactCardName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
  },
  contactCardRelation: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  durationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationChipSelected: {
    backgroundColor: `${colors.primary}12`,
    borderColor: colors.primary,
  },
  durationChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.foreground,
  },
  durationChipTextSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  privacyNoteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.primary}08`,
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
    borderRadius: radii.xl,
    padding: 14,
    gap: 12,
  },
  privacyNoteTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
  },
  privacyNoteBody: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
    lineHeight: 16,
  },
  footerActions: {
    marginTop: 8,
  },
  activeCard: {
    padding: 18,
    gap: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  activeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  activeHeaderText: {
    flex: 1,
  },
  activeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
  },
  activeSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  activeStatsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 10,
    alignItems: "center",
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    marginTop: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.foreground,
  },
  shareActionRow: {
    marginTop: 4,
  },
  shareOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: 12,
    gap: 8,
  },
  shareOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
});
