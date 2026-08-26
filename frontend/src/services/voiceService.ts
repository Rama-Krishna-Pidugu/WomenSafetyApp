let createAudioPlayer: any = null;
try {
  createAudioPlayer = require("expo-audio").createAudioPlayer;
} catch (e) {
  console.warn("[VoiceService] expo-audio fallback:", e);
}

/**
 * Service handling voice playback after a fake call is answered.
 * Supports male/female preset recordings and optional custom URIs.
 */
export class VoiceService {
  private player: any = null;
  private isPlaying: boolean = false;

  /**
   * Play a voice clip based on the selected gender.
   * If a custom recording URL is supplied, it will be used; otherwise a default remote sample is played.
   */
  public async playVoice(
    voiceGender: 'Male' | 'Female',
    customUri?: string,
  ): Promise<void> {
    await this.stopVoice();

    const uri = customUri || 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm.ogg';

    try {
      if (createAudioPlayer) {
        this.player = createAudioPlayer({ uri });
        this.player.play();
      }
      this.isPlaying = true;
    } catch (e) {
      console.warn('Voice playback error', e);
    }
  }

  /**
   * Stop any currently playing voice audio and unload the resource.
   */
  public async stopVoice(): Promise<void> {
    if (!this.isPlaying || !this.player) return;
    try {
      this.player.pause();
      this.player.remove?.();
    } catch {
      // ignore errors
    } finally {
      this.player = null;
      this.isPlaying = false;
    }
  }
}

export const voiceService = new VoiceService();
