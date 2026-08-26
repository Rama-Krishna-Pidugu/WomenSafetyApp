let createAudioPlayer: any = null;
try {
  createAudioPlayer = require("expo-audio").createAudioPlayer;
} catch (e) {
  console.warn("[SoundService] expo-audio fallback:", e);
}

export class SoundService {
  private soundPlayer: any = null;
  private voicePlayer: any = null;
  private isPlaying: boolean = false;
  private isVoicePlaying: boolean = false;

  /**
   * Play ringtone audio on loop when fake call is incoming
   */
  public async playRingtone(ringtoneName: string = "Marimba"): Promise<void> {
    try {
      await this.stopRingtone();

      if (ringtoneName === "Silent") {
        return;
      }

      let audioUri = "https://bigsoundbank.com/UPLOAD/mp3/0452.mp3";
      if (ringtoneName === "Classic") {
        audioUri = "https://bigsoundbank.com/UPLOAD/mp3/1111.mp3";
      }

      if (createAudioPlayer) {
        this.soundPlayer = createAudioPlayer({ uri: audioUri });
        this.soundPlayer.loop = true;
        this.soundPlayer.play();
      }
      this.isPlaying = true;
    } catch {
      this.isPlaying = true;
    }
  }

  /**
   * Stop ringtone audio immediately when call is answered or declined
   */
  public async stopRingtone(): Promise<void> {
    if (!this.isPlaying && !this.soundPlayer) return;

    try {
      if (this.soundPlayer) {
        this.soundPlayer.pause();
        this.soundPlayer.remove?.();
      }
    } catch {
      // Silently ignore unload errors
    } finally {
      this.soundPlayer = null;
      this.isPlaying = false;
    }
  }

  /**
   * Play prerecorded voice
   */
  public async playVoice(callerName: string): Promise<void> {
    try {
      await this.stopVoice();

      const text = callerName.includes('Mom') 
        ? "Hi! Where are you? I'm waiting outside. Come quickly." 
        : "I'm already nearby. Stay where you are.";

      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`;

      if (createAudioPlayer) {
        this.voicePlayer = createAudioPlayer({ uri: url });
        this.voicePlayer.play();
      }
      this.isVoicePlaying = true;
    } catch (e) {
      console.log("Failed to play voice", e);
    }
  }

  public async stopVoice(): Promise<void> {
    if (!this.isVoicePlaying && !this.voicePlayer) return;

    try {
      if (this.voicePlayer) {
        this.voicePlayer.pause();
        this.voicePlayer.remove?.();
      }
    } catch {
    } finally {
      this.voicePlayer = null;
      this.isVoicePlaying = false;
    }
  }
}

export const soundService = new SoundService();
