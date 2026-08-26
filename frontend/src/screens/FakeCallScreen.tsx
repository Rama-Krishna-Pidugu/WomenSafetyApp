import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { Phone, Clock, Bell, Volume2, ShieldCheck, Play } from "lucide-react-native";
import { colors, radii } from "../theme/tokens";
import { NavBar } from "../components/ds/NavBar";
import { Card } from "../components/ds/Card";
import { fakeCallService } from "../services/fakeCallService";
import { FakeCallConfig } from "../types/fakeCall";

const DELAY_OPTIONS = [
  { label: "Instant", seconds: 0 },
  { label: "10s", seconds: 10 },
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "2m", seconds: 120 },
  { label: "5m", seconds: 300 },
];

const PRESET_CALLERS = ["Mom", "Dad", "Police", "Boss", "Friend"];
const RINGTONES = ["Marimba", "Classic", "Silent"];

export function FakeCallScreen({
  onBack,
}: {
  onBack?: () => void;
}) {
  const [config, setConfig] = useState<FakeCallConfig | null>(null);
  const [customCaller, setCustomCaller] = useState("");

  useEffect(() => {
    async function load() {
      const cfg = await fakeCallService.getConfig();
      setConfig(cfg);
    }
    load();
  }, []);

  const saveSetting = async (updates: Partial<FakeCallConfig>) => {
    if (!config) return;
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    await fakeCallService.saveConfig(newConfig);
  };

  const handleTestCall = async () => {
    if (!config) return;
    const delay = config.delaySeconds ?? (config.delayMinutes ? config.delayMinutes * 60 : 0);
    if (delay <= 0) {
      await fakeCallService.triggerImmediateFakeCall();
    } else {
      await fakeCallService.scheduleFakeCall(delay);
      const displayTime = delay >= 60 ? `${Math.floor(delay / 60)} minute(s)` : `${delay} seconds`;
      Alert.alert("Fake Call Scheduled", `A fake call from ${config.callerName} will appear in ${displayTime}.`);
    }
  };

  if (!config) {
    return (
      <View style={styles.screen}>
        <NavBar title="Fake Call Generator" onBack={onBack} />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  const selectedDelaySec = config.delaySeconds ?? (config.delayMinutes ? config.delayMinutes * 60 : 0);

  return (
    <View style={styles.screen}>
      <NavBar title="Fake Call Generator" onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.bannerCard}>
          <View style={styles.bannerIconCircle}>
            <Phone size={22} color={colors.primary} />
          </View>
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerTitle}>Quick Settings Tile Ready</Text>
            <Text style={styles.bannerSub}>
              Settings saved here automatically configure your Android Quick Settings Tile. Tap the tile anytime to trigger this call—even when the app is closed.
            </Text>
          </View>
        </Card>

        {/* 1. Predefined / Custom Caller */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CALLER IDENTITY</Text>
          <View style={styles.optionsRow}>
            {PRESET_CALLERS.map((name) => (
              <TouchableOpacity
                key={name}
                style={[styles.optionBtn, config.callerName === name && styles.optionBtnActive]}
                onPress={() => saveSetting({ callerName: name })}
              >
                <Text style={[styles.optionText, config.callerName === name && styles.optionTextActive]}>
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 2. Delay Trigger */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SCHEDULED DELAY</Text>
          <View style={styles.optionsRow}>
            {DELAY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[
                  styles.optionBtn,
                  selectedDelaySec === opt.seconds && styles.optionBtnActive,
                ]}
                onPress={() => saveSetting({ delaySeconds: opt.seconds, delayMinutes: Math.floor(opt.seconds / 60) })}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedDelaySec === opt.seconds && styles.optionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 3. Ringtone Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RINGTONE</Text>
          <View style={styles.optionsRow}>
            {RINGTONES.map((tone) => (
              <TouchableOpacity
                key={tone}
                style={[styles.optionBtn, config.ringtone === tone && styles.optionBtnActive]}
                onPress={() => saveSetting({ ringtone: tone })}
              >
                <Text style={[styles.optionText, config.ringtone === tone && styles.optionTextActive]}>
                  {tone}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 4. Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          <Card style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Vibration</Text>
                <Text style={styles.toggleSub}>Vibrate phone during incoming call</Text>
              </View>
              <Switch
                value={config.vibrate}
                onValueChange={(val) => saveSetting({ vibrate: val })}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Auto-Play Voice</Text>
                <Text style={styles.toggleSub}>Play simulated ambient audio on answer</Text>
              </View>
              <Switch
                value={config.autoPlayVoice}
                onValueChange={(val) => saveSetting({ autoPlayVoice: val })}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          </Card>
        </View>

        {/* 5. Trigger / Preview Button */}
        <TouchableOpacity
          style={styles.testBtn}
          onPress={handleTestCall}
          accessibilityLabel="Test Fake Call"
        >
          <Play size={18} color={colors.primaryForeground} />
          <Text style={styles.testBtnText}>
            {selectedDelaySec > 0 ? `Schedule Test Call (${selectedDelaySec}s)` : "Trigger Test Call Now"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  loadingText: { textAlign: "center", marginTop: 40, color: colors.mutedForeground },
  bannerCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    marginVertical: 14,
  },
  bannerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}20`,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { fontSize: 14, fontWeight: "700", color: colors.foreground },
  bannerSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2, lineHeight: 17 },
  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.mutedForeground,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 70,
    alignItems: "center",
  },
  optionBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: { fontSize: 13, fontWeight: "600", color: colors.foreground },
  optionTextActive: { color: colors.primaryForeground },
  toggleCard: {
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  toggleTextWrap: { flex: 1, paddingRight: 12 },
  toggleLabel: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  toggleSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radii.lg,
    marginTop: 28,
  },
  testBtnText: { fontSize: 15, fontWeight: "700", color: colors.primaryForeground },
});
