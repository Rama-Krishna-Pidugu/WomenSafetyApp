import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, TextInput, Alert, Linking } from "react-native";
import {
  Settings as SettingsIcon,
  Users,
  HeartPulse,
  Watch,
  Lock,
  CircleHelp,
  Info,
  LogOut,
  Moon,
  Globe,
  Bell,
  ShieldCheck,
  Trash2,
  Plus,
  UserRound,
  Check,
  Search,
  PhoneCall,
  HeartHandshake,
  Siren,
  KeyRound,
  Eye,
  EyeOff,
  Bug,
} from "lucide-react-native";
import * as Sentry from "@sentry/react-native";
import { colors, radii } from "../theme/tokens";
import { AppButton } from "../components/ds/AppButton";
import { Badge } from "../components/ds/Badge";
import { Card } from "../components/ds/Card";
import { Dialog } from "../components/ds/Dialog";
import { NavBar } from "../components/ds/NavBar";
import { ProfileCard } from "../components/ds/ProfileCard";
import { SectionHeader } from "../components/ds/SectionHeader";
import { SettingRow } from "../components/ds/SettingRow";
import { Toggle } from "../components/ds/Toggle";
import { EmptyState } from "../components/ds/EmptyState";
import { BottomSheet } from "../components/ds/BottomSheet";
import { ListItem } from "../components/ds/ListItem";
import { AppInput, FieldLabel } from "../components/ds/Field";
import { PHONE_CONTACTS, type PhoneContact } from "../data/mock";
import { useEmergencyContacts } from "../hooks/useEmergencyContacts";
import {
  ContactDetailsSheet,
  formatContactSubtitle,
  nextAvailablePriority,
} from "../components/app/ContactDetailsSheet";
import { contactStorageService } from "../services/contactStorageService";
import { auth, clearPasswordSessionToken, getAuthHeader } from "../services/firebaseConfig";
import { getMyProfile, saveProfile, parseMedicalNotes, formatMedicalNotes, type UserProfile, clearCurrentProfile } from "../services/profileService";
import { BottomNav, type TabKey } from "../components/app/BottomNav";
import { API_BASE_URL } from "../api/config";

export type ProfileState = "default" | "updated";

export function ProfileScreen({
  onTab,
  onSettings,
  onPrivacy,
  onAssistant,
  onSos,
  onManageContacts,
  onLoggedOut,
}: {
  onTab?: (t: TabKey) => void;
  onSettings?: () => void;
  onPrivacy?: () => void;
  onAssistant?: () => void;
  onSos?: () => void;
  onManageContacts?: () => void;
  onLoggedOut?: () => void;
}) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [medicalOpen, setMedicalOpen] = useState(false);
  const [savingMedical, setSavingMedical] = useState(false);
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const { contacts } = useEmergencyContacts();

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const data = await getMyProfile();
      if (isMounted && data) {
        setProfile(data);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const name = profile?.full_name || "User";
  const initials = profile?.full_name
    ? profile.full_name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "U";
  const phone = profile?.phone || auth.currentUser?.phoneNumber || "Verified Phone";

  const medicalSubParts: string[] = [];
  if (profile?.blood_group) medicalSubParts.push(`Blood group ${profile.blood_group}`);
  if (profile?.medical_notes) medicalSubParts.push(profile.medical_notes);
  const medicalSub = medicalSubParts.length > 0 ? medicalSubParts.join(" • ") : "No medical info added";

  const openMedicalEditor = () => {
    const parsed = parseMedicalNotes(profile?.medical_notes);
    setAllergies(parsed.allergies);
    setConditions(parsed.conditions);
    setMedicalNotes(parsed.notes);
    setMedicalOpen(true);
  };

  const handleSaveMedical = async () => {
    if (!profile?.full_name) {
      Alert.alert("Profile not loaded", "Please wait for your profile to load, then try again.");
      return;
    }

    setSavingMedical(true);
    try {
      const updated = await saveProfile({
        full_name: profile.full_name,
        gender: profile.gender ?? undefined,
        blood_group: profile.blood_group ?? undefined,
        date_of_birth: profile.date_of_birth ?? undefined,
        medical_notes: formatMedicalNotes(allergies, conditions, medicalNotes),
      });
      if (updated) setProfile(updated);
      setMedicalOpen(false);
    } catch (err: any) {
      Alert.alert("Couldn't save medical info", err.message || "Please check your connection and try again.");
    } finally {
      setSavingMedical(false);
    }
  };

  const deviceSub = `${Platform.OS === "ios" ? "iOS Device" : "Android Device"} • registered`;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      if (auth.currentUser) {
        await auth.signOut().catch(() => {});
      }
      await clearPasswordSessionToken();
      await contactStorageService.clearEmergencyContacts();
      clearCurrentProfile();
      setLogoutOpen(false);
      onLoggedOut?.();
    } catch (err: any) {
      clearCurrentProfile();
      setLogoutOpen(false);
      onLoggedOut?.();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.screen}>
      <NavBar
        title="Profile"
        action={
          <Pressable onPress={onSettings} accessibilityLabel="Settings" style={styles.settingsIconBtn}>
            <SettingsIcon size={18} color={colors.foreground} />
          </Pressable>
        }
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ProfileCard initials={initials} name={name} meta={`${phone} • Verified`} />

        <View style={styles.statsGrid}>
          {[
            { label: "Journeys", value: "0" },
            { label: "Contacts", value: String(contacts.length) },
            { label: "Reports", value: "0" },
          ].map((s) => (
            <Card key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Safety profile" />
          <Card style={styles.listCard}>
            <SettingRow icon={<Users size={17} color={colors.primary} />} title="Emergency contacts" subtitle={`${contacts.length} of 5 added`} onPress={onManageContacts} />
            <SettingRow
              icon={<HeartPulse size={17} color={colors.primary} />}
              title="Medical information"
              subtitle={medicalSub}
              onPress={openMedicalEditor}
            />
            <SettingRow
              icon={<Watch size={17} color={colors.primary} />}
              title="Connected devices"
              subtitle={deviceSub}
              trailing={<Badge tone="success">Live</Badge>}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Preferences" />
          <Card style={styles.listCard}>
            <SettingRow icon={<SettingsIcon size={17} color={colors.primary} />} title="Settings" subtitle="Theme, language, notifications" onPress={onSettings} />
            <SettingRow icon={<Lock size={17} color={colors.primary} />} title="Data & privacy" subtitle="See what we keep — and wipe it" onPress={onPrivacy} />
            <SettingRow icon={<CircleHelp size={17} color={colors.primary} />} title="Support" subtitle="We reply within a day" />
            <SettingRow icon={<Info size={17} color={colors.primary} />} title="About Aegis" subtitle="Version 1.0.4" />
          </Card>
        </View>

        <View style={styles.section}>
          <Card style={styles.listCard}>
            <SettingRow
              icon={<LogOut size={17} color={colors.destructive} />}
              title="Log out"
              subtitle="Sign out of this device"
              tone="danger"
              onPress={() => setLogoutOpen(true)}
            />
          </Card>
        </View>
      </ScrollView>

      <BottomNav active="profile" onSelect={onTab} onAssistant={onAssistant} onSos={onSos} />

      <BottomSheet open={medicalOpen} onClose={() => setMedicalOpen(false)} title="Medical information">
        <View style={styles.medicalStack}>
          <View>
            <FieldLabel>Allergies</FieldLabel>
            <AppInput value={allergies} onChangeText={setAllergies} placeholder="Penicillin, peanuts" />
          </View>
          <View>
            <FieldLabel>Medical conditions</FieldLabel>
            <AppInput value={conditions} onChangeText={setConditions} placeholder="Asthma, diabetes" />
          </View>
          <View>
            <FieldLabel>Emergency notes</FieldLabel>
            <View style={styles.notesBox}>
              <TextInput
                value={medicalNotes}
                onChangeText={setMedicalNotes}
                multiline
                numberOfLines={3}
                placeholder="Anything a responder should know"
                placeholderTextColor={`${colors.mutedForeground}b3`}
                style={styles.notesInput}
              />
            </View>
          </View>
          <AppButton loading={savingMedical} onPress={handleSaveMedical}>
            Save medical info
          </AppButton>
        </View>
      </BottomSheet>

      <Dialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Log out of Aegis?"
        body="You'll need to verify your phone number again to sign back in."
        actions={
          <>
            <AppButton variant="destructive" loading={loggingOut} onPress={handleLogout}>
              Log out
            </AppButton>
            <AppButton variant="ghost" onPress={() => setLogoutOpen(false)}>
              Cancel
            </AppButton>
          </>
        }
      />
    </View>
  );
}

export function ManageContactsScreen({ onBack }: { onBack?: () => void }) {
  const {
    contacts,
    permissionStatus,
    deviceContacts,
    requestPermission,
    fetchDeviceContacts,
    pickNativeContact,
    addContact,
    updateContact,
    removeContact,
    isMaxReached,
    error,
  } = useEmergencyContacts();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsMode, setDetailsMode] = useState<"add" | "edit">("add");
  const [pendingContact, setPendingContact] = useState<PhoneContact | null>(null);

  const openAddDetails = (contact: PhoneContact) => {
    setPendingContact({ ...contact, priority: nextAvailablePriority(contacts) });
    setDetailsMode("add");
    setDetailsOpen(true);
    setSheetOpen(false);
  };

  const openEditDetails = (contact: PhoneContact) => {
    setPendingContact(contact);
    setDetailsMode("edit");
    setDetailsOpen(true);
  };

  const handleSaveDetails = async (relation: string, priority: number) => {
    if (!pendingContact) return;
    if (detailsMode === "add") {
      await addContact(pendingContact, relation, priority);
    } else {
      await updateContact(pendingContact.id, { relation, priority });
    }
    setDetailsOpen(false);
    setPendingContact(null);
  };

  const handleAddPress = async () => {
    if (permissionStatus !== "granted") {
      const granted = await requestPermission();
      if (!granted) return;
    }
    const picked = await pickNativeContact();
    if (picked) {
      openAddDetails(picked);
      return;
    }
    await fetchDeviceContacts();
    setSheetOpen(true);
  };

  const availableList = permissionStatus === "granted" ? deviceContacts : PHONE_CONTACTS;
  const filteredResults = availableList.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <View style={styles.screen}>
      <NavBar title="Emergency contacts" onBack={onBack} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {error ? <Text style={styles.contactsError}>{error}</Text> : null}

        {/* Official Emergency Helplines Integration */}
        <Text style={styles.helplinesSectionTitle}>OFFICIAL EMERGENCY HELPLINES</Text>
        <Card style={styles.helplineBox}>
          <Pressable
            style={styles.helplineRowItem}
            onPress={() => Linking.openURL("tel:1091")}
            accessibilityLabel="Call Women Helpline 1091"
          >
            <View style={[styles.helplineIconCircle, { backgroundColor: "#ec489915" }]}>
              <HeartHandshake size={20} color="#ec4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.helplineName}>Women Helpline</Text>
              <Text style={styles.helplineDesc}>24/7 National Distress Helpline</Text>
            </View>
            <Text style={styles.helplineNum}>1091</Text>
          </Pressable>

          <View style={styles.helplineDivider} />

          <Pressable
            style={styles.helplineRowItem}
            onPress={() => Linking.openURL("tel:112")}
            accessibilityLabel="Call Police Helpline 112"
          >
            <View style={[styles.helplineIconCircle, { backgroundColor: `${colors.emergency}15` }]}>
              <Siren size={20} color={colors.emergency} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.helplineName}>Police Helpline</Text>
              <Text style={styles.helplineDesc}>National Emergency Dispatch</Text>
            </View>
            <Text style={styles.helplineNum}>112 / 100</Text>
          </Pressable>
        </Card>

        <Text style={styles.helplinesSectionTitle}>PERSONAL EMERGENCY CONTACTS</Text>
        {contacts.length === 0 ? (
          <EmptyState
            illustration={<UserRound color={colors.primary} size={36} strokeWidth={1.4} />}
            title="No contacts yet"
            body="Choose trusted emergency contacts who will be notified during an emergency."
            action={
              <AppButton size="md" leading={<Plus size={18} color={colors.primaryForeground} />} onPress={handleAddPress}>
                Select Emergency Contacts
              </AppButton>
            }
          />
        ) : (
          <View style={styles.contactsList}>
            {contacts.map((c) => (
              <ListItem
                key={c.id}
                icon={<Text style={styles.contactInitials}>{c.initials}</Text>}
                title={c.name}
                subtitle={formatContactSubtitle(c)}
                onPress={() => openEditDetails(c)}
                trailing={
                  <Pressable
                    accessibilityLabel="Remove contact"
                    accessibilityRole="button"
                    onPress={() => removeContact(c.id)}
                    hitSlop={8}
                  >
                    <Trash2 size={18} color={`${colors.mutedForeground}b3`} />
                  </Pressable>
                }
              />
            ))}
            {isMaxReached ? (
              <Text style={styles.contactsMax}>You've reached the maximum of 5 contacts.</Text>
            ) : (
              <Pressable onPress={handleAddPress} style={styles.contactsAdd}>
                <Plus size={18} color={colors.primary} />
                <Text style={styles.contactsAddText}>Add a contact</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Import from contacts">
        <View style={styles.searchRow}>
          <Search size={18} color={colors.mutedForeground} />
          <View style={styles.searchInputWrap}>
            <AppInput value={query} onChangeText={setQuery} placeholder="Search contacts" />
          </View>
        </View>
        {filteredResults.length === 0 ? (
          <Text style={{ textAlign: "center", color: colors.mutedForeground, paddingVertical: 24, fontSize: 14 }}>
            No contacts found.
          </Text>
        ) : (
          filteredResults.map((c) => {
            const picked = contacts.some((x) => x.id === c.id || (x.phone && x.phone === c.phone));
            return (
              <ListItem
                key={c.id}
                icon={<Text style={styles.contactInitials}>{c.initials}</Text>}
                title={c.name}
                subtitle={c.phone}
                selected={picked}
                onPress={() => {
                  if (picked) {
                    const existing = contacts.find((x) => x.id === c.id || (x.phone && x.phone === c.phone));
                    if (existing) openEditDetails(existing);
                  } else {
                    openAddDetails(c);
                  }
                }}
                trailing={
                  <View style={[styles.checkCircle, picked ? styles.checkCirclePicked : styles.checkCircleIdle]}>
                    {picked ? <Check size={16} color={colors.background} /> : null}
                  </View>
                }
              />
            );
          })
        )}
      </BottomSheet>

      <ContactDetailsSheet
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setPendingContact(null);
        }}
        contact={pendingContact}
        mode={detailsMode}
        existingContacts={contacts}
        onSave={handleSaveDetails}
      />
    </View>
  );
}

export function SettingsScreen({
  onBack,
  onPrivacy,
}: {
  onBack?: () => void;
  onPrivacy?: () => void;
}) {
  const [dark, setDark] = useState(false);
  const [alerts, setAlerts] = useState(true);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordAlreadySet, setPasswordAlreadySet] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const authHeaders = await getAuthHeader();
        const response = await fetch(`${API_BASE_URL}/auth/password-status`, { headers: authHeaders });
        if (response.ok) {
          const data = await response.json();
          setPasswordAlreadySet(!!data.has_password);
        }
      } catch {
        setPasswordAlreadySet(false);
      }
    })();
  }, []);

  const openPasswordSheet = () => {
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSheetOpen(true);
  };

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Too short", "Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords don't match", "Please make sure both passwords are the same.");
      return;
    }
    setSavingPassword(true);
    try {
      if (!auth.currentUser) {
        throw new Error("You must be signed in with your phone number before setting a password.");
      }
      const authHeaders = await getAuthHeader(true);
      if (!authHeaders.Authorization) {
        throw new Error("Could not verify your session. Please sign out and sign in again with Phone OTP.");
      }
      const response = await fetch(`${API_BASE_URL}/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ new_password: newPassword }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const detail = errData.detail;
        const message =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(". ")
              : "Failed to update password on server.";
        throw new Error(message);
      }

      setPasswordAlreadySet(true);
      setPasswordSheetOpen(false);
      Alert.alert("Password saved", "Your app password has been saved to your account in the database. You can now use it to log in.");
    } catch (e: any) {
      Alert.alert("Error saving password", e.message || "Could not save the password. Please try again.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <View style={styles.screen}>
      <NavBar title="Settings" onBack={onBack} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <SectionHeader title="Appearance" />
        <Card style={styles.listCard}>
          <SettingRow
            icon={<Moon size={17} color={colors.primary} />}
            title="Dark mode"
            subtitle="Easier on the eyes at night"
            trailing={<Toggle on={dark} onChange={setDark} />}
          />
          <SettingRow icon={<Globe size={17} color={colors.primary} />} title="Language" subtitle="English (India)" />
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Notifications" />
          <Card style={styles.listCard}>
            <SettingRow
              icon={<Bell size={17} color={colors.primary} />}
              title="Area alerts"
              subtitle="When reports rise near you"
              trailing={<Toggle on={alerts} onChange={setAlerts} />}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Security" />
          <Card style={styles.listCard}>
            <SettingRow
              icon={<KeyRound size={17} color={colors.primary} />}
              title="App password"
              subtitle={passwordAlreadySet ? "Password set — tap to update" : "Not set yet — tap to create"}
              onPress={openPasswordSheet}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Privacy" />
          <Card style={styles.listCard}>
            <SettingRow icon={<Lock size={17} color={colors.primary} />} title="Data & privacy" subtitle="What we keep, and for how long" onPress={onPrivacy} />
            <SettingRow icon={<Trash2 size={17} color={colors.destructive} />} title="Delete account" subtitle="Removes everything, permanently" tone="danger" />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Diagnostics & Debugging" />
          <Card style={styles.listCard}>
            <SettingRow
              icon={<Bug size={17} color={colors.warning || colors.primary} />}
              title="Trigger Sentry Test Error"
              subtitle="Capture and transmit a test exception"
              onPress={() => {
                try {
                  throw new Error("Test Sentry Error: Aegis React Native test exception triggered from Settings UI.");
                } catch (error) {
                  Sentry.captureException(error);
                  Alert.alert(
                    "Sentry Test Triggered",
                    "A test exception has been captured and dispatched to your Sentry dashboard."
                  );
                }
              }}
            />
          </Card>
        </View>
      </ScrollView>

      <BottomSheet open={passwordSheetOpen} onClose={() => setPasswordSheetOpen(false)} title={passwordAlreadySet ? "Update app password" : "Set app password"}>
        <View style={styles.medicalStack}>
          <View style={styles.pwdInfoBox}>
            <ShieldCheck size={16} color={colors.primary} />
            <Text style={styles.pwdInfoText}>
              Once set, you can log back in with this password after logging out or removing the app.
            </Text>
          </View>

          <View>
            <FieldLabel>New password</FieldLabel>
            <View style={styles.passwordContainer}>
              <View style={{ flex: 1 }}>
                <AppInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="At least 6 characters"
                  secureTextEntry={!showNewPwd}
                />
              </View>
              <Pressable onPress={() => setShowNewPwd(!showNewPwd)} style={styles.eyeBtn}>
                {showNewPwd ? <EyeOff size={20} color={colors.mutedForeground} /> : <Eye size={20} color={colors.mutedForeground} />}
              </Pressable>
            </View>
          </View>

          <View>
            <FieldLabel>Confirm password</FieldLabel>
            <View style={styles.passwordContainer}>
              <View style={{ flex: 1 }}>
                <AppInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                  secureTextEntry={!showConfirmPwd}
                />
              </View>
              <Pressable onPress={() => setShowConfirmPwd(!showConfirmPwd)} style={styles.eyeBtn}>
                {showConfirmPwd ? <EyeOff size={20} color={colors.mutedForeground} /> : <Eye size={20} color={colors.mutedForeground} />}
              </Pressable>
            </View>
          </View>

          <AppButton loading={savingPassword} onPress={handleSavePassword} leading={<KeyRound size={18} color={colors.primaryForeground} />}>
            {passwordAlreadySet ? "Update password" : "Save password"}
          </AppButton>
        </View>
      </BottomSheet>
    </View>
  );
}

export function DataPrivacyScreen({
  state = "default",
  onBack,
}: {
  state?: "default" | "confirm" | "wiped";
  onBack?: () => void;
}) {
  return (
    <View style={styles.screen}>
      <NavBar title="Data & privacy" onBack={onBack} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.privacyHeroCard}>
          <Lock size={24} color={colors.primary} />
          <Text style={styles.privacyHeroTitle}>Your data is yours. Only yours.</Text>
          <Text style={styles.privacyHeroSub}>
            We never sell, share or advertise on your data. Your location is visible only to chosen contacts.
          </Text>
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Wipe your data" />
          <Card style={styles.wipeCard}>
            <Text style={styles.wipeText}>You can erase everything Aegis has collected at any time.</Text>
            <View style={styles.wipeButtons}>
              <AppButton variant="destructive" size="md">
                Wipe all my data
              </AppButton>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  settingsIconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  statsGrid: { flexDirection: "row", gap: 10, marginVertical: 16 },
  statCard: { flex: 1, padding: 14, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "700", color: colors.foreground },
  statLabel: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  section: { marginBottom: 20 },
  listCard: { padding: 4 },
  privacyHeroCard: { padding: 20, gap: 8, backgroundColor: `${colors.primary}10`, marginBottom: 16 },
  privacyHeroTitle: { fontSize: 20, fontWeight: "700", color: colors.foreground },
  privacyHeroSub: { fontSize: 14, color: colors.mutedForeground, lineHeight: 20 },
  wipeCard: { padding: 16, gap: 12 },
  wipeText: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
  wipeButtons: { marginTop: 4 },
  contactsError: { marginBottom: 12, fontSize: 13, color: colors.destructive },
  helplinesSectionTitle: { fontSize: 12, fontWeight: "700", color: colors.mutedForeground, letterSpacing: 0.5, marginTop: 12, marginBottom: 8 },
  helplineBox: { padding: 4, marginBottom: 16 },
  helplineRowItem: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12 },
  helplineIconCircle: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  helplineName: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  helplineDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
  helplineNum: { fontSize: 16, fontWeight: "700", color: colors.primary },
  helplineDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 12 },
  contactsList: { gap: 8 },
  contactInitials: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  contactsMax: { paddingHorizontal: 12, paddingTop: 8, fontSize: 14, color: colors.mutedForeground },
  contactsAdd: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  contactsAddText: { fontSize: 16, fontWeight: "500", color: colors.primary },
  searchRow: {
    marginHorizontal: 8,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  searchInputWrap: { flex: 1 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  checkCircleIdle: { borderWidth: 1, borderColor: colors.border },
  checkCirclePicked: { backgroundColor: colors.primary },
  medicalStack: { gap: 20, paddingBottom: 8, paddingTop: 4 },
  notesBox: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16 },
  notesInput: { fontSize: 17, lineHeight: 24, color: colors.foreground, textAlignVertical: "top" },
  passwordContainer: { flexDirection: "row", alignItems: "center" },
  eyeBtn: { position: "absolute", right: 16, padding: 8 },
  pwdInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1,
    borderColor: `${colors.primary}25`,
  },
  pwdInfoText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
});
