import { useSyncExternalStore } from 'react';
import type { MouseEvent } from 'react';
import type { MatchSnapshot } from '../game/session/MatchStore';
import { soundSettings } from '../settings/sound';
import { formatTime } from './format';

const HUD_PATH = '/assets/png/default/ui/hud';
const CONTROLS_PATH = '/assets/png/default/ui/controls';

interface HudProps {
  match: MatchSnapshot;
  onPause: () => void;
  /** Hidden on touch screens, where the on-screen buttons are shown instead. */
  showKeyboardHint: boolean;
}

/**
 * Score, time left and health on top of the arena, plus the pause button
 * and the controls reminder. It is plain React (semantic HTML), so screen
 * readers can read it, and it only re-renders when a value changes.
 */
export function Hud({ match, onPause, showKeyboardHint }: HudProps) {
  return (
    <>
      <section className="hud" aria-label="Match status">
        <HudCounter icon={`${HUD_PATH}/icon_score.png`} label="Score" value={String(match.score)} />
        <HudCounter
          icon={`${HUD_PATH}/icon_time.png`}
          label="Time left"
          value={formatTime(match.timeLeft)}
        />
        <HudCounter
          icon={`${HUD_PATH}/icon_heart.png`}
          label="Health"
          value={`${Math.ceil(match.health)}/${match.maxHealth}`}
        />
        <button
          type="button"
          className="round-button"
          onClick={onPause}
          disabled={match.status !== 'running'}
          aria-label="Pause (Esc)"
        >
          <img src={`${CONTROLS_PATH}/icon_pause.png`} alt="" />
        </button>
        <SoundButton />
      </section>

      {showKeyboardHint && (
        <p className="controls-hint">
          <kbd>W</kbd>/<kbd>↑</kbd> sail · <kbd>A</kbd> <kbd>D</kbd> turn · <kbd>Space</kbd> bow
          cannon · <kbd>Q</kbd> <kbd>E</kbd> broadsides · <kbd>Esc</kbd> pause · <kbd>M</kbd> sound
        </p>
      )}

      {/* Announced to screen readers only when the status changes, never per frame. */}
      <p className="visually-hidden" role="status" aria-live="polite">
        {statusMessage(match)}
      </p>
    </>
  );
}

function HudCounter({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="hud-counter">
      <img src={icon} alt="" />
      <span className="visually-hidden">{label}: </span>
      <span className="hud-value">{value}</span>
    </div>
  );
}

function statusMessage(match: MatchSnapshot): string {
  switch (match.status) {
    case 'paused':
      return 'Game paused.';
    case 'ended':
      return `Match over. Final score: ${match.score}.`;
    case 'running':
      return 'Match in progress.';
    default:
      return '';
  }
}

/** Sound on/off. Works at any moment of the match; the choice is saved. */
function SoundButton() {
  const muted = useSyncExternalStore(soundSettings.subscribe, soundSettings.isMuted);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    soundSettings.toggle();
    // After a mouse click, give focus back to the game: otherwise pressing
    // Space (bow cannon) would "click" this button again.
    if (event.detail > 0) event.currentTarget.blur();
  }

  return (
    <button
      type="button"
      className="round-button"
      onClick={handleClick}
      aria-pressed={muted}
      aria-label="Mute sound (M)"
    >
      <SpeakerIcon muted={muted} />
    </button>
  );
}

/** Simple speaker drawing (the challenge assets have no sound icon). */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg className="sound-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 9h4l5-4v14l-5-4H3z" />
      {muted ? (
        <path d="M16 9l5 6M21 9l-5 6" fill="none" />
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" />
      )}
    </svg>
  );
}
