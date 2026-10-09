import type { MatchSnapshot } from '../game/session/MatchStore';
import { formatTime } from './format';

const HUD_PATH = '/assets/png/default/ui/hud';
const CONTROLS_PATH = '/assets/png/default/ui/controls';

interface HudProps {
  match: MatchSnapshot;
  onPause: () => void;
}

/**
 * Score, time left and health on top of the arena, plus the pause button
 * and the controls reminder. It is plain React (semantic HTML), so screen
 * readers can read it, and it only re-renders when a value changes.
 */
export function Hud({ match, onPause }: HudProps) {
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
      </section>

      <p className="controls-hint">
        <kbd>W</kbd>/<kbd>↑</kbd> sail · <kbd>A</kbd> <kbd>D</kbd> turn · <kbd>Space</kbd> bow
        cannon · <kbd>Q</kbd> <kbd>E</kbd> broadsides · <kbd>Esc</kbd> pause
      </p>

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
