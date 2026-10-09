import { useEffect, useRef } from 'react';
import type { GameConfig } from './config';
import { GameSession } from './session/GameSession';
import type { MatchStore } from './session/MatchStore';

interface GameCanvasProps {
  /** Snapshot of the configuration for this match. */
  config: GameConfig;
  /** Where the game publishes score, time and status for the interface. */
  store: MatchStore;
}

/**
 * React component that hosts the game.
 * React only provides the <div>; the GameSession draws inside it with PixiJS
 * and runs its own loop, so React does not re-render on every frame.
 */
export function GameCanvas({ config, store }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const session = new GameSession(container, config, store);
    session.start().catch((error: unknown) => {
      console.error('Failed to start game', error);
      store.update({
        status: 'error',
        errorMessage: 'The game could not start on this device or browser.',
      });
    });

    // Leaving the screen (or restarting) destroys everything the match created.
    return () => session.destroy();
  }, [config, store]);

  // Hidden from screen readers: the HUD describes the match in text instead.
  return <div ref={containerRef} className="game-canvas" aria-hidden="true" />;
}
