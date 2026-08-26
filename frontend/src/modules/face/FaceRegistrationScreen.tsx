import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  X,
} from "lucide-react-native";

import { colors, radii } from "../../theme/tokens";
import { AppButton } from "../../components/ds/AppButton";
import { Card } from "../../components/ds/Card";
import { EmptyState } from "../../components/ds/EmptyState";

import { FaceCamera } from "./FaceCamera";
import { faceRepository } from "./faceRepository";
import type { TrustedFace } from "./face.types";

interface Props {
  onDone: () => void;
}

type RegistrationStep = "list" | "camera";

export function FaceRegistrationScreen({ onDone }: Props) {
  const [faces, setFaces] = useState<TrustedFace[]>([]);
  const [loading, setLoading] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTrustedFaces = async () => {
    try {
      setLoading(true);

      const response = await faceRepository.getTrustedFaces();

      if (response.success) {
        setFaces(response.faces);
      }
    } catch (error) {
      console.error("[FaceRegistration] Failed to load trusted faces:", error);

      Alert.alert(
        "Unable to load trusted faces",
        "Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrustedFaces();
  }, []);

  const handleAddFace = () => {
    setCapturedImageUri(null);
    setName("");
    setRelationship("");
    setCameraOpen(true);
  };

  const handleCapture = (uri: string) => {
    setCameraOpen(false);
    setCapturedImageUri(uri);

    // Ask for the person's details only after
    // a face has successfully been captured.
    setDetailsOpen(true);
  };

  const handleRegister = async () => {
    if (!capturedImageUri) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedRelationship = relationship.trim();

    if (!trimmedName || !trimmedRelationship) {
      Alert.alert(
        "Missing details",
        "Please enter both the person's name and relationship.",
      );
      return;
    }

    try {
      setSaving(true);

      await faceRepository.registerFace(
        capturedImageUri,
        trimmedName,
        trimmedRelationship,
      );

      setDetailsOpen(false);
      setCapturedImageUri(null);
      setName("");
      setRelationship("");

      await loadTrustedFaces();

      Alert.alert(
        "Face Registered",
        `${trimmedName} has been added as a trusted person.`,
      );
    } catch (error: any) {
      console.error("[FaceRegistration] Registration failed:", error);

      const errorMessage =
        error?.detail ||
        error?.message ||
        "The trusted face could not be registered. Please make sure your face is well-lit, centered, and try again.";

      Alert.alert(
        "Registration failed",
        errorMessage,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (face: TrustedFace) => {
    Alert.alert(
      "Remove trusted face?",
      `Remove ${face.name} from your trusted faces?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingId(face.id);

              await faceRepository.deleteTrustedFace(face.id);

              setFaces((current) =>
                current.filter((item) => item.id !== face.id),
              );
            } catch (error) {
              console.error(
                "[FaceRegistration] Delete failed:",
                error,
              );

              Alert.alert(
                "Unable to remove",
                "The trusted face could not be removed.",
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  if (cameraOpen) {
    return (
      <FaceCamera
        onCapture={async (uri) => {
          handleCapture(uri);
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <ShieldCheck
              size={28}
              color={colors.primary}
              strokeWidth={2}
            />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.title}>Trusted Faces</Text>
            <Text style={styles.subtitle}>
              People who can verify your identity during an emergency.
            </Text>
          </View>
        </View>

        <AppButton
          onPress={handleAddFace}
          style={styles.addButton}
        >
          <View style={styles.addButtonContent}>
            <UserPlus
              size={18}
              color={colors.primaryForeground}
              strokeWidth={2}
            />
            <Text style={styles.addButtonText}>
              Add Trusted Face
            </Text>
          </View>
        </AppButton>

        <Text style={styles.sectionTitle}>
          Registered Trusted People
        </Text>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : faces.length === 0 ? (
          <EmptyState
            title="No trusted faces"
            body="Add a trusted person to use face verification during emergencies."
          />
        ) : (
          <View style={styles.faceList}>
            {faces.map((face) => (
              <Card key={face.id} style={styles.faceCard}>
                <View style={styles.faceIcon}>
                  <ShieldCheck
                    size={22}
                    color={colors.primary}
                    strokeWidth={2}
                  />
                </View>

                <View style={styles.faceInfo}>
                  <Text style={styles.faceName}>{face.name}</Text>
                  <Text style={styles.faceRelationship}>
                    {face.relationship}
                  </Text>
                </View>

                <Pressable
                  onPress={() => handleDelete(face)}
                  disabled={deletingId === face.id}
                  style={styles.deleteButton}
                  accessibilityLabel={`Remove ${face.name}`}
                >
                  {deletingId === face.id ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.destructive}
                    />
                  ) : (
                    <Trash2
                      size={20}
                      color={colors.destructive}
                      strokeWidth={2}
                    />
                  )}
                </Pressable>
              </Card>
            ))}
          </View>
        )}

        <AppButton
          variant="ghost"
          onPress={onDone}
          style={styles.doneButton}
        >
          Done
        </AppButton>
      </ScrollView>

      <Modal
        visible={detailsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) {
            setDetailsOpen(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Register Trusted Face</Text>
                <Text style={styles.modalSubtitle}>
                  Enter the details of the person you just captured.
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  if (!saving) {
                    setDetailsOpen(false);
                  }
                }}
                disabled={saving}
                style={styles.closeButton}
              >
                <X size={22} color={colors.foreground} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Name</Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Mom"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
              editable={!saving}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Relationship</Text>

            <TextInput
              value={relationship}
              onChangeText={setRelationship}
              placeholder="e.g. Mother"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
              editable={!saving}
              autoCapitalize="words"
            />

            <View style={styles.modalActions}>
              <AppButton
                variant="ghost"
                onPress={() => setDetailsOpen(false)}
                disabled={saving}
                style={styles.modalCancel}
              >
                Cancel
              </AppButton>

              <AppButton
                onPress={handleRegister}
                loading={saving}
                disabled={saving}
                style={styles.modalRegister}
              >
                Register
              </AppButton>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },

  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.primary}15`,
    marginRight: 14,
  },

  headerText: {
    flex: 1,
  },

  title: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: "800",
  },

  subtitle: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },

  addButton: {
    marginBottom: 28,
  },

  sectionTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },

  loading: {
    paddingVertical: 50,
    alignItems: "center",
  },

  faceList: {
    gap: 10,
  },

  faceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },

  faceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.primary}15`,
    marginRight: 12,
  },

  faceInfo: {
    flex: 1,
  },

  faceName: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },

  faceRelationship: {
    color: colors.mutedForeground,
    fontSize: 14,
    marginTop: 3,
  },

  deleteButton: {
    padding: 10,
  },

  doneButton: {
    marginTop: 24,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 20,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 22,
  },

  modalTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "800",
  },

  modalSubtitle: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    paddingRight: 10,
  },

  closeButton: {
    padding: 4,
  },

  inputLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 7,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: colors.foreground,
    backgroundColor: colors.surface,
    marginBottom: 16,
    fontSize: 15,
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },

  modalCancel: {
    flex: 1,
  },

  modalRegister: {
    flex: 1,
  },

 addButtonContent: {
   flexDirection: "row",
   alignItems: "center",
   justifyContent: "center",
   gap: 8,
 },

 addButtonText: {
   color: colors.primaryForeground,
   fontSize: 15,
   fontWeight: "700",
 },
});