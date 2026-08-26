/**
 * Module 8: Fake Call Generator Types
 */

export interface CallerProfile {
  id: string;
  name: string;
  phoneNumber: string;
  avatarUrl?: string | null;
  voicePresetId?: string;
}

export interface VoicePreset {
  id: string;
  label: string;
  audioAsset: string | null;
}

export interface FakeCallConfig {
  callerName: string;
  phoneNumber?: string;
  ringtone: string;
  vibrate: boolean;
  autoPlayVoice: boolean;
  delayMinutes: number;
  delaySeconds?: number;
  enabled?: boolean;
}

export interface FakeCallState {
  isCallActive: boolean;
  isRinging: boolean;
  scheduledTime: number | null;
  activeProfile: CallerProfile | null;
  durationSeconds: number;
}
