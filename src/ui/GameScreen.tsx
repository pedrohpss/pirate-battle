import { useState, useSyncExternalStore } from 'react';
import type { GameConfig } from '../game/config';
import { GameCanvas } from '../game/GameCanvas';
import { MatchStore } from '../game/session/MatchStore';
import { Hud } from './Hud';
import { PauseDialog } from './PauseDialog';
import { ResultDialog } from './ResultDialog';

interface GameScreenProps {
  config: GameConfig;
  /** Starts a brand new match (the parent remounts this screen). */
  onPlayAgain: () => void;
  onMainMenu?: () => void;
}

/**
 * The combat screen: PixiJS arena + React HUD and dialogs on top.
 *
 * The parent gives this component a new `key` for every match, so React
 * throws the old one away completely. That guarantees a clean restart:
 * new store, new simulation, new canvas, and the old ones destroyed.
 */
export function GameScreen({ config, onPlayAgain, onMainMenu }: GameScreenProps) {
  // One store per match, created once when the screen mounts.
  const [store] = useState(() => new MatchStore());
  // Re-renders only when the store says something changed.
  const match = useSyncExternalStore(store.subscribe, store.getSnapshot);

  const inMatch = match.status === 'running' || match.status === 'paused' || match.status === 'ended';

  return (
    <main className="game-screen">
      <h1 className="visually-hidden">Pirate Battle</h1>
      <GameCanvas config={config} store={store} />

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

      {inMatch && <Hud match={match} onPause={() => store.pause()} />}

      {match.status === 'paused' && (
        <PauseDialog onResume={() => store.resume()} onMainMenu={onMainMenu} />
      )}

      {match.status === 'ended' && (
        <ResultDialog match={match} onPlayAgain={onPlayAgain} onMainMenu={onMainMenu} />
      )}
    </main>
  );
}
