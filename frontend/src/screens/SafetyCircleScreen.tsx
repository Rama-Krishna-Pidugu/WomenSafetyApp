import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ShieldCheck, Plus, Trash2, Pencil, X, Bell, BellOff, MapPin } from "lucide-react-native";
import { colors, radii } from "../theme/tokens";
import { Badge } from "../components/ds/Badge";
import { Card } from "../components/ds/Card";
import { NavBar } from "../components/ds/NavBar";
import { AppButton } from "../components/ds/AppButton";
import { useSafetyCircle } from "../hooks/useSafetyCircle";
import { RELATIONSHIP_OPTIONS } from "../hooks/useEmergencyContacts";
import { TrustedContact } from "../types/safetyCircle";

export function SafetyCircleScreen({ onBack }: { onBack?: () => void }) {
  const { contacts, loading, error, add, update, remove, isMaxReached } = useSafetyCircle();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState<string>("FRIEND");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setName("");
    setPhone("");
    setRelation("FRIEND");
  };

  const startEdit = (contact: TrustedContact) => {
    setEditingId(contact.id);
    setName(contact.name);
    setPhone(contact.phone);
    setRelation(contact.relation);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Missing details", "Enter a name and phone number.");
      return;
    }
    setSaving(true);
    const ok = editingId
      ? await update(editingId, { name: name.trim(), phone: phone.trim(), relation })
      : await add({ name: name.trim(), phone: phone.trim(), relation });
    setSaving(false);
    if (ok) resetForm();
  };

  const handleRemove = (contact: TrustedContact) => {
    Alert.alert("Remove contact?", `${contact.name} will no longer be part of your Safety Circle.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => remove(contact.id) },
    ]);
  };

  const toggleNotifications = (contact: TrustedContact) => {
    update(contact.id, { notificationEnabled: !contact.notificationEnabled });
  };

  return (
    <View style={styles.screen}>
      <NavBar
        title="Your Safety Circle"
        onBack={onBack}
        action={
          !formOpen && !isMaxReached ? (
            <Pressable onPress={() => setFormOpen(true)} style={styles.addBtn} accessibilityLabel="Add trusted contact">
              <Plus size={18} color={colors.primaryForeground} />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introRow}>
          <ShieldCheck size={20} color={colors.primary} />
          <Text style={styles.introText}>
            These trusted contacts are notified when you trigger SOS, share your live location, or start Safety
            Mode.
          </Text>
        </View>

        {error ? (
          <Card tone="outline" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {formOpen ? (
          <Card style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <Text style={styles.formTitle}>{editingId ? "Edit contact" : "Add trusted contact"}</Text>
              <Pressable onPress={resetForm} accessibilityLabel="Close form">
                <X size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor={colors.mutedForeground}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relationRow}>
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setRelation(opt)}
                  style={[styles.relationChip, relation === opt && styles.relationChipActive]}
                >
                  <Text style={[styles.relationChipText, relation === opt && styles.relationChipTextActive]}>
                    {opt}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <AppButton variant="primary" size="md" onPress={handleSave} loading={saving} style={{ marginTop: 8 }}>
              {editingId ? "Save changes" : "Add to Safety Circle"}
            </AppButton>
          </Card>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : contacts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <ShieldCheck size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>Your Safety Circle is empty</Text>
            <Text style={styles.emptySub}>
              Add people you trust so they can be reached the moment something goes wrong.
            </Text>
            {!formOpen && (
              <AppButton variant="primary" size="md" onPress={() => setFormOpen(true)} style={{ marginTop: 12 }}>
                Add your first contact
              </AppButton>
            )}
          </Card>
        ) : (
          <View style={styles.list}>
            {contacts.map((contact) => (
              <Card key={contact.id} style={styles.contactCard}>
                <View style={styles.contactTopRow}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{contact.initials}</Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactMeta}>{contact.phone}</Text>
                  </View>
                  <Badge tone="brand">{contact.relation}</Badge>
                </View>

                <View style={styles.contactActionsRow}>
                  <Pressable onPress={() => toggleNotifications(contact)} style={styles.prefToggle}>
                    {contact.notificationEnabled ? (
                      <Bell size={14} color={colors.primary} />
                    ) : (
                      <BellOff size={14} color={colors.mutedForeground} />
                    )}
                    <Text style={styles.prefToggleText}>
                      {contact.notificationEnabled ? "Notifications on" : "Notifications off"}
                    </Text>
                    <Switch
                      value={contact.notificationEnabled}
                      onValueChange={() => toggleNotifications(contact)}
                      trackColor={{ true: colors.primary, false: colors.border }}
                    />
                  </Pressable>
                </View>

                <View style={styles.contactActionsRow}>
                  <View style={styles.liveLocationPill}>
                    <MapPin size={12} color={contact.liveLocationEnabled ? colors.primary : colors.mutedForeground} />
                    <Text style={styles.liveLocationPillText}>
                      {contact.liveLocationEnabled ? "Sees live location" : "Live location off"}
                    </Text>
                  </View>
                  <Pressable onPress={() => startEdit(contact)} style={styles.iconBtn} accessibilityLabel="Edit contact">
                    <Pencil size={16} color={colors.foreground} />
                  </Pressable>
                  <Pressable onPress={() => handleRemove(contact)} style={styles.iconBtn} accessibilityLabel="Remove contact">
                    <Trash2 size={16} color={colors.emergency} />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  introRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  introText: { flex: 1, fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
  errorCard: { padding: 12, borderColor: colors.warning },
  errorText: { fontSize: 12, color: colors.warning },
  formCard: { gap: 10 },
  formHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  formTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  relationRow: { gap: 8, paddingVertical: 4 },
  relationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  relationChipActive: { backgroundColor: `${colors.primary}12`, borderColor: colors.primary },
  relationChipText: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground },
  relationChipTextActive: { color: colors.primary },
  loadingWrap: { paddingVertical: 40, alignItems: "center" },
  emptyCard: { alignItems: "center", padding: 28, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground, marginTop: 8 },
  emptySub: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 18 },
  list: { gap: 12 },
  contactCard: { gap: 12 },
  contactTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: "700", color: colors.foreground },
  contactMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  contactActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 8,
  },
  prefToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  prefToggleText: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.foreground },
  liveLocationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  liveLocationPillText: { fontSize: 11, color: colors.mutedForeground },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
