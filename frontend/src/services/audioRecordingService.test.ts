import {
  startSosAudioRecording,
  stopSosAudioRecording,
  isAudioRecordingActive,
  syncAudioEvidenceToCloud,
} from "./audioRecordingService";

jest.mock("expo-crypto", () => ({
  digestStringAsync: jest.fn().mockResolvedValue("mocked-sha256-hash-0123456789abcdef"),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///mock/documents/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 24500 }),
  readAsStringAsync: jest.fn().mockResolvedValue("bW9ja2VkLWJhc2U2NC1hdWRpby1ieXRlcw=="),
  EncodingType: { Base64: "base64" },
}));

jest.mock("../data/evidence", () => ({
  uploadEvidenceFile: jest.fn().mockResolvedValue({
    id: "evi-mock-123",
    incident_id: "sos-test-1",
    type: "audio",
    file_name: "sos-audio-test.m4a",
  }),
}));

describe("audioRecordingService (Module 6)", () => {
  beforeEach(async () => {
    if (isAudioRecordingActive()) {
      await stopSosAudioRecording();
    }
  });

  it("starts audio recording for an active SOS incident", async () => {
    expect(isAudioRecordingActive()).toBe(false);

    const uri = await startSosAudioRecording("sos-inc-1");
    expect(uri).toContain("sos-audio-sos-inc-1");
    expect(isAudioRecordingActive()).toBe(true);
  });

  it("returns existing URI if already recording", async () => {
    const uri1 = await startSosAudioRecording("sos-inc-2");
    const uri2 = await startSosAudioRecording("sos-inc-2");
    expect(uri1).toBe(uri2);
  });

  it("stops audio recording and generates duration & tamper-proof seal", async () => {
    await startSosAudioRecording("sos-inc-3");
    expect(isAudioRecordingActive()).toBe(true);

    const result = await stopSosAudioRecording();
    expect(result).not.toBeNull();
    expect(result?.incidentId).toBe("sos-inc-3");
    expect(result?.tamperSeal).toContain("seal:mocked-s…cdef");
    expect(result?.durationSeconds).toBeGreaterThanOrEqual(1);
    expect(isAudioRecordingActive()).toBe(false);
  });

  it("syncs recorded audio evidence to cloud", async () => {
    await startSosAudioRecording("sos-inc-4");
    const result = await stopSosAudioRecording();

    expect(result).not.toBeNull();
    if (result) {
      const evidence = await syncAudioEvidenceToCloud(result);
      expect(evidence?.id).toBe("evi-mock-123");
    }
  });
});
