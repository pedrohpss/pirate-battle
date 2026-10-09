import type { MatchSnapshot } from '../game/session/MatchStore';
import { formatTime } from './format';
import { useModalDialog } from './useModalDialog';

interface ResultDialogProps {
  match: MatchSnapshot;
  onPlayAgain: () => void;
  /** Optional until the main menu exists. */
  onMainMenu?: () => void;
}

const END_REASON_TEXT = {
  time: "Time's up! You survived until the end.",
  death: 'Your ship sank.',
} as const;

/** End-of-match summary: score, time played, why it ended and what to do next. */
export function ResultDialog({ match, onPlayAgain, onMainMenu }: ResultDialogProps) {
  const dialogRef = useModalDialog();

  return (
    <dialog
      ref={dialogRef}
      className="panel-dialog"
      aria-labelledby="result-title"
      // The match is over: Esc must not close the summary without a choice.
      onCancel={(event) => event.preventDefault()}
    >
      <h2 id="result-title">Match over</h2>
      <p>{match.endReason ? END_REASON_TEXT[match.endReason] : ''}</p>

      <dl className="result-list">
        <div>
          <dt>Score</dt>
          <dd>{match.score}</dd>
        </div>
        <div>
          <dt>Time played</dt>
          <dd>{formatTime(match.timePlayed)}</dd>
        </div>
      </dl>

      <div className="dialog-actions">
        <button type="button" className="menu-button primary" onClick={onPlayAgain} autoFocus>
          Play Again
        </button>
        {onMainMenu && (
          <button type="button" className="menu-button secondary" onClick={onMainMenu}>
            Main Menu
          </button>
        )}
      </div>
    </dialog>
  );
}
