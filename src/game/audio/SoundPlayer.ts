import { soundSettings } from '../../settings/sound';
import type { MatchStatus } from '../session/MatchStore';
import type { EndReason, GameEvent } from '../simulation/types';

const SOUND_PATH = '/assets/sounds';

/**
 * Every sound the game uses, by name. Some have variants (picked at random)
 * so repeated shots and explosions do not sound identical.
 * All files are the challenge's own assets (public/assets/sounds).
 */
const SOUND_FILES = {
  start: ['game_start'],
  pause: ['game_pause'],
  resume: ['game_resume'],
  complete: ['game_complete'],
  over: ['game_over'],
  timeWarning: ['time_warning'],
  cannon: ['cannon_fire_1', 'cannon_fire_2', 'cannon_fire_3'],
  broadside: ['cannon_broadside'],
  waterHit: ['cannonball_water_hit_1', 'cannonball_water_hit_2'],
  woodHit: ['ship_wood_hit_1', 'ship_wood_hit_2'],
  explosion: ['ship_explosion_1', 'ship_explosion_2'],
  sinking: ['ship_sinking'],
  ambient: ['ocean_ambience_loop'],
} as const;

export type SoundName = keyof typeof SOUND_FILES;

/** Overall volume, and the ocean loop is kept low so it stays in the background. */
const MASTER_VOLUME = 0.6;
const AMBIENT_VOLUME = 0.35;

/**
 * Plays the match sounds with the Web Audio API.
 *
 * It listens to the same GameEvents the renderer uses (shots, impacts,
 * explosions) and to the match status (start, pause, end). The simulation
 * knows nothing about sound, so audio was added without touching the rules.
 *
 * Failures are silent on purpose: if the browser blocks audio or a file does
 * not load, the game simply plays without that sound.
 */
export class SoundPlayer {
  private readonly context: AudioContext | null;
  private readonly master: GainNode | null;
  private readonly buffers = new Map<SoundName, AudioBuffer[]>();
  private ambientSource: AudioBufferSourceNode | null = null;
  /** True while the ocean loop should be playing (it may still be loading). */
  private ambientWanted = false;
  private closed = false;
  private readonly unsubscribe: () => void;

  constructor() {
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
    } catch {
      context = null; // no Web Audio support: play without sound
    }
    this.context = context;
    this.master = context ? context.createGain() : null;
    if (context && this.master) {
      this.master.connect(context.destination);
      this.applyMute();
    }
    this.unsubscribe = soundSettings.subscribe(this.applyMute);

    // Browsers only allow audio after the player interacts with the page.
    // Clicking Play usually counts; these listeners cover the other cases
    // (for example iPhones, which need a touch on the game screen itself).
    window.addEventListener('pointerdown', this.unlock);
    window.addEventListener('keydown', this.unlock);
  }

  /** Downloads and decodes every sound in parallel. Never rejects. */
  async load(): Promise<void> {
    const context = this.context;
    if (!context) return;

    const entries = Object.entries(SOUND_FILES) as [SoundName, readonly string[]][];
    await Promise.all(
      entries.map(async ([name, files]) => {
        const decoded = await Promise.all(files.map((file) => this.decode(context, file)));
        const usable = decoded.filter((buffer): buffer is AudioBuffer => buffer !== null);
        if (usable.length > 0) this.buffers.set(name, usable);
      }),
    );

    // The match may have started before the ocean loop finished loading.
    if (this.ambientWanted) this.startAmbient();
  }

  /** Plays a short sound once. `volume` goes from 0 to 1. */
  play(name: SoundName, volume = 1): void {
    const context = this.context;
    const master = this.master;
    const variants = this.buffers.get(name);
    // Skip while audio is still blocked, so sounds do not pile up and play all at once later.
    if (!context || !master || !variants || this.closed || context.state !== 'running') return;

    const source = context.createBufferSource();
    source.buffer = variants[Math.floor(Math.random() * variants.length)];
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(master);
    source.start();
  }

  /** Sounds for what happened during one frame (several events can come at once). */
  handleEvents(events: readonly GameEvent[]): void {
    let playerShots = 0;
    let enemyShot = false;
    let waterHit = false;
    let islandHit = false;
    let shipHit = false;

    for (const event of events) {
      switch (event.type) {
        case 'shotFired':
          if (event.team === 'player') playerShots++;
          else enemyShot = true;
          break;
        case 'projectileImpact':
          if (event.surface === 'water') waterHit = true;
          else if (event.surface === 'island') islandHit = true;
          else shipHit = true;
          break;
        case 'shipDestroyed':
          if (event.kind === 'player') this.play('sinking', 0.9);
          else this.play('explosion', 0.8);
          break;
      }
    }

    // At most one sound of each kind per frame, so a 3-shot broadside is
    // one "boom", not three overlapping copies.
    if (playerShots >= 3) this.play('broadside', 0.6);
    else if (playerShots > 0) this.play('cannon', 0.5);
    if (enemyShot) this.play('cannon', 0.3);
    if (shipHit) this.play('woodHit', 0.6);
    if (waterHit) this.play('waterHit', 0.35);
    if (islandHit) this.play('waterHit', 0.2);
  }

  /** Sounds for the match status: start, pause, resume and end. */
  statusChanged(from: MatchStatus, to: MatchStatus, endReason: EndReason | null): void {
    if (to === 'running') {
      this.play(from === 'paused' ? 'resume' : 'start', 0.6);
      this.ambientWanted = true;
      this.startAmbient();
    } else if (to === 'paused') {
      this.play('pause', 0.6);
      this.stopAmbient();
    } else if (to === 'ended') {
      this.stopAmbient();
      this.play(endReason === 'death' ? 'over' : 'complete', 0.8);
    }
  }

  /** Stops every sound and releases the audio device. */
  destroy(): void {
    this.closed = true;
    this.stopAmbient();
    this.unsubscribe();
    window.removeEventListener('pointerdown', this.unlock);
    window.removeEventListener('keydown', this.unlock);
    this.context?.close().catch(() => {
      // already closed
    });
  }

  private startAmbient(): void {
    const context = this.context;
    const master = this.master;
    const buffer = this.buffers.get('ambient')?.[0];
    if (!context || !master || !buffer || this.closed || this.ambientSource) return;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = AMBIENT_VOLUME;
    source.connect(gain).connect(master);
    source.start();
    this.ambientSource = source;
  }

  private stopAmbient(): void {
    this.ambientWanted = false;
    if (!this.ambientSource) return;
    try {
      this.ambientSource.stop();
    } catch {
      // already stopped
    }
    this.ambientSource = null;
  }

  private async decode(context: AudioContext, file: string): Promise<AudioBuffer | null> {
    try {
      const response = await fetch(`${SOUND_PATH}/${file}.wav`);
      if (!response.ok) return null;
      return await context.decodeAudioData(await response.arrayBuffer());
    } catch {
      return null; // missing or unsupported file: that sound is skipped
    }
  }

  /** Resumes audio after a user interaction (browser autoplay rules). */
  private readonly unlock = (): void => {
    if (this.context?.state === 'suspended' && !this.closed) {
      this.context.resume().catch(() => {
        // still blocked: try again on the next interaction
      });
    }
  };

  /** Muted = master volume 0. Sounds keep "playing" silently, so unmuting is instant. */
  private readonly applyMute = (): void => {
    if (!this.context || !this.master) return;
    const volume = soundSettings.isMuted() ? 0 : MASTER_VOLUME;
    this.master.gain.setValueAtTime(volume, this.context.currentTime);
  };
}
