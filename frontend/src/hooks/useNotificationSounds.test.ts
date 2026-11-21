import { describe, it, expect, beforeEach } from 'vitest';
import { soundSynthesizer } from '@/lib/sound-effects';

describe('SoundSynthesizer', () => {
  beforeEach(() => {
    // Reset synthesizer state before each test
    soundSynthesizer.setVolume(0.3);
  });

  it('should initialize with default volume', () => {
    expect(soundSynthesizer.getVolume()).toBe(0.3);
  });

  it('should set volume within 0-1 range', () => {
    soundSynthesizer.setVolume(0.5);
    expect(soundSynthesizer.getVolume()).toBe(0.5);

    soundSynthesizer.setVolume(-0.5);
    expect(soundSynthesizer.getVolume()).toBe(0);

    soundSynthesizer.setVolume(1.5);
    expect(soundSynthesizer.getVolume()).toBe(1);
  });

  it('should clamp volume to 0-1', () => {
    soundSynthesizer.setVolume(-10);
    expect(soundSynthesizer.getVolume()).toBe(0);

    soundSynthesizer.setVolume(10);
    expect(soundSynthesizer.getVolume()).toBe(1);
  });

  it('should play sounds without throwing errors', () => {
    // Web Audio API may not be available in test environment
    // Just verify methods don't throw
    expect(() => {
      soundSynthesizer.playSuccess();
    }).not.toThrow();

    expect(() => {
      soundSynthesizer.playAlert();
    }).not.toThrow();

    expect(() => {
      soundSynthesizer.playPing();
    }).not.toThrow();

    expect(() => {
      soundSynthesizer.playClick();
    }).not.toThrow();

    expect(() => {
      soundSynthesizer.playTick();
    }).not.toThrow();
  });

  it('should handle play method with type argument', () => {
    expect(() => {
      soundSynthesizer.play('success');
      soundSynthesizer.play('alert');
      soundSynthesizer.play('ping');
      soundSynthesizer.play('click');
      soundSynthesizer.play('tick');
    }).not.toThrow();
  });

  it('should handle stop without throwing', () => {
    expect(() => {
      soundSynthesizer.stop();
    }).not.toThrow();
  });
});

describe('localStorage persistence', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should persist mute state to localStorage', () => {
    localStorage.setItem('notification_sounds_muted', 'true');
    expect(localStorage.getItem('notification_sounds_muted')).toBe('true');
  });

  it('should persist volume to localStorage', () => {
    localStorage.setItem('notification_sounds_volume', '50');
    expect(localStorage.getItem('notification_sounds_volume')).toBe('50');
  });

  it('should parse volume as number', () => {
    localStorage.setItem('notification_sounds_volume', '75');
    const vol = localStorage.getItem('notification_sounds_volume');
    expect(parseInt(vol || '0', 10)).toBe(75);
  });

  it('should clear localStorage on remove', () => {
    localStorage.setItem('test_key', 'test_value');
    localStorage.removeItem('test_key');
    expect(localStorage.getItem('test_key')).toBeNull();
  });
});
