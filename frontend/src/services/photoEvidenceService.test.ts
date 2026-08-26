import {
  captureEvidencePhoto,
  startSosPhotoCapture,
  startSosVideoRecording,
  stopSosVideoRecording,
  syncPhotoEvidenceToCloud,
  syncVideoEvidenceToCloud,
  getLocalEvidenceQueue,
  syncPendingEvidenceQueue,
} from "./photoEvidenceService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { uploadEvidenceFile } from "../data/evidence";

jest.mock("expo-crypto", () => ({
  digestStringAsync: jest.fn().mockResolvedValue("mocked-photo-sha256-hash-1234567890"),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///mock/documents/",
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: "base64" },
}));

jest.mock("../data/evidence", () => ({
  uploadEvidenceFile: jest.fn().mockResolvedValue({
    id: "evi-photo-123",
    incident_id: "sos-test-photo",
    type: "image",
    file_name: "photo_test.jpg",
  }),
}));

describe("photoEvidenceService (Module 7)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it("captures evidence photo of surroundings and computes SHA-256 integrity hash", async () => {
    const photo = await captureEvidencePhoto("sos-inc-1", "front");

    expect(photo.incidentId).toBe("sos-inc-1");
    expect(photo.facing).toBe("front");
    expect(photo.sha256).toBe("mocked-photo-sha256-hash-1234567890");
    expect(photo.uri).toContain("photo_sos-inc-1_front");
    expect(photo.details).toContain("Evidence photo of surroundings");
    expect(photo.uploadStatus).toBe("PENDING_UPLOAD");

    // Verify local storage queue
    const queue = await getLocalEvidenceQueue();
    expect(queue.length).toBeGreaterThanOrEqual(1);
    expect(queue[0].uploadStatus).toBe("PENDING_UPLOAD");
    expect(queue[0].sha256).toBe("mocked-photo-sha256-hash-1234567890");
  });

  it("captures both front and rear photos upon SOS activation", async () => {
    const photos = await startSosPhotoCapture("sos-inc-2");

    expect(photos.length).toBe(2);
    expect(photos[0].facing).toBe("front");
    expect(photos[1].facing).toBe("back");
  });

  it("starts and stops video recording, generating duration and SHA-256 hash", async () => {
    const videoUri = await startSosVideoRecording("sos-inc-3");
    expect(videoUri).toContain("video_sos-inc-3");

    const result = await stopSosVideoRecording();
    expect(result).not.toBeNull();
    expect(result?.incidentId).toBe("sos-inc-3");
    expect(result?.durationSeconds).toBeGreaterThanOrEqual(1);
    expect(result?.sha256).toBe("mocked-photo-sha256-hash-1234567890");

    const queue = await getLocalEvidenceQueue();
    const videoItem = queue.find((item) => item.mediaType === "video");
    expect(videoItem).toBeDefined();
    expect(videoItem?.incidentId).toBe("sos-inc-3");
  });

  it("syncs captured photo evidence to cloud storage and updates uploadStatus to UPLOADED", async () => {
    const photo = await captureEvidencePhoto("sos-inc-4", "front");
    const evidence = await syncPhotoEvidenceToCloud(photo);

    expect(evidence).not.toBeNull();
    expect(evidence?.id).toBe("evi-photo-123");
    expect(photo.uploadStatus).toBe("UPLOADED");
  });

  it("handles offline state gracefully and retries pending uploads via syncPendingEvidenceQueue", async () => {
    // 1. Simulate upload failure (offline)
    (uploadEvidenceFile as jest.Mock).mockRejectedValueOnce(new Error("Network offline"));

    const photo = await captureEvidencePhoto("sos-inc-5", "front");
    const evidence = await syncPhotoEvidenceToCloud(photo);

    expect(evidence).toBeNull();
    expect(photo.uploadStatus).toBe("PENDING_UPLOAD");

    // 2. Connectivity restored: retry syncing queue
    (uploadEvidenceFile as jest.Mock).mockResolvedValue({
      id: "evi-synced-after-retry",
      incident_id: "sos-inc-5",
      type: "image",
    });

    await syncPendingEvidenceQueue();

    const queue = await getLocalEvidenceQueue();
    const record = queue.find((q) => q.incidentId === "sos-inc-5");
    expect(record?.uploadStatus).toBe("UPLOADED");
  });
});
