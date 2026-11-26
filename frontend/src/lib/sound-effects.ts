/**
 * Web Audio API Synthesizer for notification sounds
 * Generates harmonic chimes without external audio assets
 */

export const SOUND_MUTE_KEY = 'notification_sounds_muted';
export const SOUND_VOLUME_KEY = 'notification_sounds_volume';

export type SoundType = 'success' | 'alert' | 'ping';

interface ChimeConfig {
  frequencies: number[];
  duration: number;
}

export class SoundSynthesizer {
  private audioContext: AudioContext | null = null;
  private volume: number = 0.3;

  constructor() {
    // AudioContext will be created on first user gesture
  }

  /**
   * Initialize AudioContext (requires user gesture)
   */
  private ensureAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextClass: typeof AudioContext =
        window.AudioContext || ((window as any).webkitAudioContext as typeof AudioContext);
      this.audioContext = new AudioContextClass();
    }
    return this.audioContext;
  }

  /**
   * Set global volume (0-1)
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Play a success chime (major chord: C-E-G)
   */
  playSuccess(): void {
    this.playChime('success', {
      frequencies: [261.63, 329.63, 392.0], // C4, E4, G4
      duration: 0.6,
    });
  }

  /**
   * Play an alert chime (diminished chord: C-Eb-Gb)
   */
  playAlert(): void {
    this.playChime('alert', {
      frequencies: [261.63, 311.13, 369.99], // C4, Eb4, Gb4
      duration: 0.8,
    });
  }

  /**
   * Play a ping chime (simple high tone)
   */
  playPing(): void {
    this.playChime('ping', {
      frequencies: [523.25], // C5
      duration: 0.3,
    });
  }

  async playCopyTick(): Promise<void> {
    try {
      if (localStorage.getItem(SOUND_MUTE_KEY) === 'true') return;
      const volume = Number(localStorage.getItem(SOUND_VOLUME_KEY) ?? 30);
      if (!Number.isFinite(volume) || volume <= 0) return;

      const context = this.ensureAudioContext();
      if (context.state === 'suspended') await context.resume();
      if (context.state !== 'running') return;

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.setValueAtTime(720, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(Math.min(volume, 100) * 0.0005, now + 0.006);
      gain.gain.linearRampToValueAtTime(0, now + 0.055);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => gain.disconnect();
      oscillator.start(now);
      oscillator.stop(now + 0.055);
    } catch {
      // Audio feedback is optional on browsers without a usable audio context.
    }
  }

  /**
   * Play generic chime with custom frequencies
   */
  private playChime(type: SoundType, config: ChimeConfig): void {
    try {
      const ctx = this.ensureAudioContext();

      // Resume context if suspended (common in browsers)
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {
          // Silently fail if user hasn't interacted with page yet
        });
      }

      if (ctx.state !== 'running') {
        return; // Context not ready
      }

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.setValueAtTime(this.volume, now);

      // Play each frequency in the chord
      config.frequencies.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.connect(masterGain);
        osc.connect(gain);

        // ADSR envelope
        const attackTime = 0.05;
        const decayTime = 0.1;
        const sustainLevel = 0.7;
        const releaseTime = 0.3;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1, now + attackTime);
        gain.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
        gain.gain.setValueAtTime(sustainLevel, now + config.duration - releaseTime);
        gain.gain.linearRampToValueAtTime(0, now + config.duration);

        osc.start(now);
        osc.stop(now + config.duration);
      });
    } catch (error) {
      // Silently fail if Web Audio API not available
      console.debug('Audio playback unavailable:', error);
    }
  }

  /**
   * Play sound by type
   */
  play(type: SoundType): void {
    switch (type) {
      case 'success':
        this.playSuccess();
        break;
      case 'alert':
        this.playAlert();
        break;
      case 'ping':
        this.playPing();
        break;
    }
  }

  /**
   * Stop all sounds (pause AudioContext)
   */
  stop(): void {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend().catch(() => {
        // Silently fail
      });
    }
  }

  /**
   * Get current volume (0-1)
   */
  getVolume(): number {
    return this.volume;
  }
}

// Singleton instance
export const soundSynthesizer = new SoundSynthesizer();
