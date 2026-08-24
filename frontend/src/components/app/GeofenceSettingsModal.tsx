import React from "react";
import { View, Text, Modal, Pressable, StyleSheet, Switch, ScrollView } from "react-native";
import { X, Shield, Bell, MapPin, Volume2, Sliders } from "lucide-react-native";
import { colors, radii } from "../../theme/tokens";
import { AppButton } from "../ds/AppButton";

export interface GeofenceConfig {
  radiusMeters: number;
  autoSendSms: boolean;
  voiceAlerts: boolean;
  showPolice: boolean;
  showHospitals: boolean;
  showShelters: boolean;
}

interface GeofenceSettingsModalProps {
  visible: boolean;
  config: GeofenceConfig;
  onChangeConfig: (newConfig: GeofenceConfig) => void;
  onClose: () => void;
}

const RADIUS_OPTIONS = [
  { label: "300m · Strict", value: 300 },
  { label: "500m · Standard", value: 500 },
  { label: "800m · Flexible", value: 800 },
  { label: "1km · Wide", value: 1000 },
];

export function GeofenceSettingsModal({
  visible,
  config,
  onChangeConfig,
  onClose,
}: GeofenceSettingsModalProps) {
  const updateSetting = <K extends keyof GeofenceConfig>(key: K, value: GeofenceConfig[K]) => {
    onChangeConfig({ ...config, [key]: value });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Sliders size={20} color={colors.primary} />
              <Text style={styles.title}>Safety Zone & Geofence Settings</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Geofence Radius Selector */}
            <Text style={styles.sectionTitle}>Geofence Safety Radius</Text>
            <Text style={styles.sectionSubtitle}>
              Triggers an instant off-route alert if you move beyond this buffer distance from your safe corridor.
            </Text>
            <View style={styles.radiusGrid}>
              {RADIUS_OPTIONS.map((opt) => {
                const active = config.radiusMeters === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.radiusPill, active && styles.radiusPillActive]}
                    onPress={() => updateSetting("radiusMeters", opt.value)}
                  >
                    <Text style={[styles.radiusText, active && styles.radiusTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* Safety Automation Toggles */}
            <Text style={styles.sectionTitle}>Safety Automations</Text>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Auto-SMS Tracking Link</Text>
                <Text style={styles.toggleSub}>
                  Automatically send live tracking URL to emergency contacts on starting navigation
                </Text>
              </View>
              <Switch
                testID="autoSendSmsSwitch"
                value={config.autoSendSms}
                onValueChange={(val) => updateSetting("autoSendSms", val)}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Voice Safety Prompts</Text>
                <Text style={styles.toggleSub}>
                  Spoken warning notifications if straying off safe route or entering low-light zones
                </Text>
              </View>
              <Switch
                value={config.voiceAlerts}
                onValueChange={(val) => updateSetting("voiceAlerts", val)}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={styles.divider} />

            {/* Map Safe Haven Overlays */}
            <Text style={styles.sectionTitle}>Map Safe Spot Overlays</Text>
            <Text style={styles.sectionSubtitle}>Display nearby verified safe havens on OpenStreetMap</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Police Stations (Blue)</Text>
              <Switch
                value={config.showPolice}
                onValueChange={(val) => updateSetting("showPolice", val)}
                trackColor={{ false: colors.border, true: "#3B82F6" }}
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>24/7 Hospitals (Red)</Text>
              <Switch
                value={config.showHospitals}
                onValueChange={(val) => updateSetting("showHospitals", val)}
                trackColor={{ false: colors.border, true: "#EF4444" }}
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Women Shelters & Help Desks (Purple)</Text>
              <Switch
                value={config.showShelters}
                onValueChange={(val) => updateSetting("showShelters", val)}
                trackColor={{ false: colors.border, true: "#8B5CF6" }}
              />
            </View>
          </ScrollView>

          {/* Footer Save */}
          <View style={styles.footer}>
            <AppButton onPress={onClose}>Save & Apply Settings</AppButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    maxHeight: "85%",
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl2,
    borderTopRightRadius: radii.xl2,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 17, fontWeight: "800", color: colors.foreground },
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
  scrollContent: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground, marginTop: 8 },
  sectionSubtitle: { fontSize: 12, color: colors.mutedForeground, marginTop: 4, marginBottom: 12 },
  radiusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  radiusPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
  },
  radiusPillActive: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  radiusText: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground },
  radiusTextActive: { color: colors.primary, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 8,
    gap: 12,
  },
  toggleTextWrap: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  toggleSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  footer: { paddingTop: 8 },
});
