import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameConfig } from '../game/config';
import { GameCanvas } from '../game/GameCanvas';
import { useSubmission } from '../api/useMatchSubmission';
import { TouchInput } from '../game/input/TouchInput';
import { MatchStore } from '../game/session/MatchStore';
import type { MatchSummary } from '../settings/lastResult';
import { optionsFromConfig } from '../settings/options';
import { Hud } from './Hud';
import { PauseDialog } from './PauseDialog';
import { ResultDialog } from './ResultDialog';
import { TouchControls } from './TouchControls';
import { useMediaQuery, useTouchControls } from './useMediaQuery';

interface GameScreenProps {
  config: GameConfig;
  /** Starts a brand new match (the parent remounts this screen). */
  onPlayAgain: () => void;
  /** Leaves the match. If it was not finished, it is simply abandoned. */
  onMainMenu: () => void;
  /**
   * Called exactly once, when the match finishes (by time or by death).
   * Returns the id the match was registered with.
   */
  onMatchEnded: (summary: MatchSummary) => string;
  /** Tries again to register a match that could not be saved. */
  onRetrySubmission: (matchId: string) => void;
}

/**
 * The combat screen: PixiJS arena + React HUD and dialogs on top.
 *
 * The parent gives this component a new `key` for every match, so React
 * throws the old one away completely. That guarantees a clean restart:
 * new store, new simulation, new canvas, and the old ones destroyed.
 */
export function GameScreen({
  config,
  onPlayAgain,
  onMainMenu,
  onMatchEnded,
  onRetrySubmission,
}: GameScreenProps) {
  // One store per match, created once when the screen mounts.
  const [store] = useState(() => new MatchStore());
  // State of the on-screen buttons, shared by the buttons (write) and the game loop (read).
  const [touch] = useState(() => new TouchInput());
  const showTouchControls = useTouchControls();
  // Supported orientation on phones: landscape. In portrait the match pauses
  // and asks the player to rotate; the rules of the match do not change.
  const isPortraitPhone = useMediaQuery('(orientation: portrait) and (pointer: coarse)');
  // Re-renders only when the store says something changed.
  const match = useSyncExternalStore(store.subscribe, store.getSnapshot);

  // Report the result once. The ref guarantees a single report even if
  // React runs this effect again (Strict Mode, re-renders).
  const reportedRef = useRef(false);
  // Id of this match once it has been reported (used to show its save status).
  const [matchId, setMatchId] = useState<string | null>(null);
  const submission = useSubmission(matchId);

  useEffect(() => {
    if (match.status !== 'ended' || !match.endReason || reportedRef.current) return;
    reportedRef.current = true;
    const id = onMatchEnded({
      score: match.score,
      timePlayed: match.timePlayed,
      endReason: match.endReason,
      endedAt: new Date().toISOString(),
      options: optionsFromConfig(config),
    });
    setMatchId(id);
  }, [match, config, onMatchEnded]);

  useEffect(() => {
    if (isPortraitPhone) store.pause();
  }, [isPortraitPhone, match.status, store]);

  const inMatch = match.status === 'running' || match.status === 'paused' || match.status === 'ended';

  return (
    <main className="game-screen">
      <h1 className="visually-hidden">Pirate Battle</h1>
      <GameCanvas config={config} store={store} touch={touch} />

      {match.status === 'loading' && (
        <div className="overlay" role="status">
          <p>Loading assets… {Math.round(match.loadingProgress * 100)}%</p>
          <progress value={match.loadingProgress} max={1} aria-label="Loading progress" />
        </div>
      )}

      {match.status === 'error' && (
        <div className="overlay" role="alert">
          <p>{match.errorMessage}</p>
          <button type="button" className="menu-button primary" onClick={onPlayAgain}>
            Try Again
          </button>
        </div>
      )}

      {inMatch && (
        <Hud match={match} onPause={() => store.pause()} showKeyboardHint={!showTouchControls} />
      )}

      {match.status === 'running' && showTouchControls && <TouchControls touch={touch} />}

      {isPortraitPhone && (
        <div className="rotate-notice" role="status">
          <p>Rotate your device to landscape to play.</p>
        </div>
      )}

      {match.status === 'paused' && (
        <PauseDialog onResume={() => store.resume()} onMainMenu={onMainMenu} />
      )}

      {match.status === 'ended' && (
        <ResultDialog
          match={match}
          submission={submission}
          onRetrySave={() => matchId && onRetrySubmission(matchId)}
          onPlayAgain={onPlayAgain}
          onMainMenu={onMainMenu}
        />
      )}
    </main>
  );
}
