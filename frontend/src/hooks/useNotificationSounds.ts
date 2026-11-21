/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { soundSynthesizer, type SoundType } from '@/lib/sound-effects';

const STORAGE_KEY_MUTE = 'notification_sounds_muted';
const STORAGE_KEY_VOLUME = 'notification_sounds_volume';

export function useNotificationSounds() {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(30); // 0-100
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    const savedMute = localStorage.getItem(STORAGE_KEY_MUTE) === 'true';
    const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);

    setIsMuted(savedMute);
    if (savedVolume) {
      const vol = Math.max(0, Math.min(100, parseInt(savedVolume, 10)));
      setVolume(vol);
      soundSynthesizer.setVolume(vol / 100);
    } else {
      soundSynthesizer.setVolume(30 / 100);
    }

    setIsInitialized(true);
  }, []);

  // Update synthesizer when volume or mute changes
  useEffect(() => {
    soundSynthesizer.setVolume(isMuted ? 0 : volume / 100);
  }, [volume, isMuted]);

  // Persist mute state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MUTE, String(isMuted));
  }, [isMuted]);

  // Persist volume
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VOLUME, String(volume));
  }, [volume]);

  /**
   * Play sound with automatic gesture handling
   */
  const playSound = useCallback(
    (type: SoundType) => {
      if (isMuted) return;

      // Ensure AudioContext is initialized on first user gesture
      try {
        soundSynthesizer.play(type);
      } catch (error) {
        console.debug('Failed to play sound:', error);
      }
    },
    [isMuted]
  );

  /**
   * Play success sound (milestone release, proposal accepted)
   */
  const playSuccess = useCallback(() => {
    playSound('success');
  }, [playSound]);

  /**
   * Play alert sound (dispute, rejection)
   */
  const playAlert = useCallback(() => {
    playSound('alert');
  }, [playSound]);

  /**
   * Play ping sound (message received)
   */
  const playPing = useCallback(() => {
    playSound('ping');
  }, [playSound]);

  /**
   * Play subtle click sound (button click)
   */
  const playClick = useCallback(() => {
    playSound('click');
  }, [playSound]);

  /**
   * Play subtle tick sound (copy action)
   */
  const playTick = useCallback(() => {
    playSound('tick');
  }, [playSound]);

  /**
   * Update volume (0-100)
   */
  const setNotificationVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(100, vol));
    setVolume(clamped);
  }, []);

  /**
   * Toggle mute state
   */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  return {
    playSuccess,
    playAlert,
    playPing,
    playClick,
    playTick,
    isMuted,
    toggleMute,
    volume,
    setNotificationVolume,
    isInitialized,
  };
}
