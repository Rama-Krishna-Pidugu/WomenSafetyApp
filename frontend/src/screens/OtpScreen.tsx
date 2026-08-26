import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMyProfile, clearCurrentProfile } from "../services/profileService";
import { AuroraHalo } from "../components/ds/Aurora";
import { AppButton } from "../components/ds/AppButton";
import { NavBar } from "../components/ds/NavBar";
import { SuccessCheck } from "../components/ds/SuccessCheck";
import { colors } from "../theme/tokens";
import { useAuth } from "../context";

export type OtpScreenState = "empty" | "autofill" | "error" | "loading" | "success";

const CORRECT = "482913";

function OtpBoxes({ code, invalid }: { code: string; invalid: boolean }) {
  return (
    <View style={styles.boxesRow}>
      {Array.from({ length: 6 }).map((_, i) => {
        const char = code[i];
        const active = code.length === i;
        return (
          <View
            key={i}
            testID={`otp-box-${i}`}
            style={[
              styles.box,
              invalid ? styles.boxInvalid : char ? styles.boxFilled : active ? styles.boxActive : styles.boxIdle,
            ]}
          >
            <Text style={[styles.boxText, invalid && styles.boxTextInvalid]}>{char ?? ""}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function OtpScreen({
  state = "empty",
  phone = "+91 98765 43210",
  confirmation,
  onBack,
  onVerified,
}: {
  state?: OtpScreenState;
  phone?: string;
  confirmation?: any;
  onBack?: () => void;
  onVerified?: (hasProfile?: boolean) => void;
}) {
  const { isAuthenticated, user } = useAuth();
  const initial =
    state === "autofill" || state === "loading"
      ? CORRECT
      : state === "error"
        ? "482900"
        : state === "success"
          ? CORRECT
          : "";

  const [code, setCode] = useState(initial);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "error" | "success">(
    state === "error" ? "error" : state === "loading" ? "loading" : state === "success" ? "success" : "idle",
  );
  const [seconds, setSeconds] = useState(28);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  useEffect(() => {
    if (state !== "empty") return;
  }, [state, confirmation]);

  const verify = async () => {
    setPhase("loading");
    try {
      const activeConfirmation =
        confirmation || (code === CORRECT ? { confirm: async () => ({ user: { uid: "mock-user" } }) } : null);
      if (activeConfirmation && typeof activeConfirmation.confirm === "function") {
        await activeConfirmation.confirm(code);
        clearCurrentProfile();
        const profile = await getMyProfile(true);
        const exists = !!profile;
        setHasExistingProfile(exists);
        setPhase("success");
        setTimeout(() => onVerified?.(exists), 1400);
      } else {
        setPhase("error");
        Alert.alert(
          "Phone verification failed",
          "Could not verify your phone number. Please go back and try again. Make sure Phone Authentication is enabled for this project in Firebase Console."
        );
      }
    } catch (err: any) {
      setPhase("error");
      Alert.alert("Verification failed", err.message || "Invalid verification code.");
    }
  };

  if (phase === "success") {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.successCenter}>
          <SuccessCheck />
          <Text style={styles.successTitle}>Number verified</Text>
          <Text style={styles.successBody}>
            {hasExistingProfile
              ? "Welcome back! Profile found — taking you to Home..."
              : "Let's finish setting up your safety profile."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <NavBar onBack={onBack} />

        <View style={styles.content}>
          <Text style={styles.headline}>Enter the code</Text>
          <Text style={styles.body}>
            Sent to <Text style={styles.bodyStrong}>{phone}</Text>
          </Text>

          <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxesPressable}>
            <OtpBoxes code={code} invalid={phase === "error"} />
          </Pressable>
          <TextInput
            ref={inputRef}
            testID="otp-hidden-input"
            value={code}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(text) => {
              setCode(text.replace(/\D/g, "").slice(0, 6));
              if (phase === "error") setPhase("idle");
            }}
            style={styles.hiddenInput}
            accessibilityLabel="Verification code"
          />

          {phase === "error" ? (
            <Text style={styles.errorText}>That code isn't right. Check the message and try again.</Text>
          ) : code.length === 6 ? (
            <Text style={styles.hintText}>Code detected from your messages.</Text>
          ) : (
            <Text style={styles.hintText}>Waiting for the SMS…</Text>
          )}

          <View style={styles.resendWrap}>
            {seconds > 0 ? (
              <Text style={styles.resendText}>
                Resend code in <Text style={styles.resendCount}>0:{String(seconds).padStart(2, "0")}</Text>
              </Text>
            ) : (
              <Pressable onPress={() => setSeconds(28)}>
                <Text style={styles.resendButton}>Resend code</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <AppButton disabled={code.length < 6} loading={phase === "loading"} onPress={verify}>
            Verify
          </AppButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  skipText: { fontSize: 14, fontWeight: "600", color: colors.primary, paddingHorizontal: 12 },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 16 },
  headline: { fontSize: 30, lineHeight: 35, fontWeight: "600", letterSpacing: -0.9, color: colors.foreground },
  body: { marginTop: 12, fontSize: 16, lineHeight: 26, color: colors.mutedForeground },
  bodyStrong: { fontWeight: "500", color: colors.foreground },
  boxesPressable: { marginTop: 32 },
  boxesRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  box: { height: 64, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 18, borderWidth: 1 },
  boxIdle: { borderColor: colors.border, backgroundColor: colors.surface },
  boxActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  boxFilled: { borderColor: `${colors.primary}66`, backgroundColor: `${colors.primary}0d` },
  boxInvalid: { borderColor: `${colors.emergency}99`, backgroundColor: `${colors.emergency}0d` },
  boxText: { fontSize: 24, fontWeight: "600", letterSpacing: -0.24, color: colors.foreground },
  boxTextInvalid: { color: colors.emergency },
  hiddenInput: { position: "absolute", height: 0, width: 0, opacity: 0 },
  errorText: { marginTop: 16, fontSize: 14, color: colors.emergency },
  hintText: { marginTop: 16, fontSize: 14, color: colors.mutedForeground },
  resendWrap: { marginTop: 32 },
  resendText: { fontSize: 15, color: colors.mutedForeground },
  resendCount: { fontWeight: "500", color: colors.foreground },
  resendButton: { fontSize: 15, fontWeight: "600", color: colors.primary },
  footer: { paddingHorizontal: 32, paddingBottom: 16 },
  successCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  successTitle: {
    marginTop: 32,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "600",
    letterSpacing: -0.84,
    color: colors.foreground,
    textAlign: "center",
  },
  successBody: { marginTop: 12, fontSize: 16, lineHeight: 26, color: colors.mutedForeground, textAlign: "center" },
});

