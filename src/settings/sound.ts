import { readStorage, writeStorage } from './storage';

/**
 * Sound on/off, saved in localStorage so the choice survives a refresh.
 *
 * It is a tiny store: React reads it with useSyncExternalStore (the HUD
 * button) and the game's SoundPlayer subscribes to it, so both always agree.
 */

const STORAGE_KEY = 'sound:v1';

let muted =
  readStorage(STORAGE_KEY, (value) => (typeof value === 'boolean' ? value : null)) ?? false;
const listeners = new Set<() => void>();

export const soundSettings = {
  isMuted(): boolean {
    return muted;
  },

  setMuted(value: boolean): void {
    if (value === muted) return;
    muted = value;
    writeStorage(STORAGE_KEY, value);
    listeners.forEach((listener) => listener());
  },

  toggle(): void {
    soundSettings.setMuted(!muted);
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
