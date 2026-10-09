import type { MatchResult } from '../settings/lastResult';
import { ControlsHelp } from './ControlsHelp';
import { formatTime } from './format';
import { Tabs } from './Tabs';

interface MainMenuProps {
  lastResult: MatchResult | null;
  onPlay: () => void;
  onOptions: () => void;
}

const END_REASON_LABEL = { time: 'Survived', death: 'Sunk' } as const;

export function MainMenu({ lastResult, onPlay, onOptions }: MainMenuProps) {
  return (
    <main className="menu-screen">
      <section className="menu-panel" aria-labelledby="game-title">
        <h1 id="game-title" className="game-title">
          <img src="/assets/png/default/ui/menu/title_pirate_battle.png" alt="Pirate Battle" />
        </h1>

        <div className="dialog-actions">
          <button type="button" className="menu-button primary" onClick={onPlay} autoFocus>
            Play
          </button>
          <button type="button" className="menu-button secondary" onClick={onOptions}>
            Options
          </button>
        </div>

        {lastResult && (
          <section className="last-result" aria-labelledby="last-result-title">
            <h2 id="last-result-title">Last match</h2>
            <p>
              <strong>{lastResult.score}</strong> points · {formatTime(lastResult.timePlayed)} ·{' '}
              {END_REASON_LABEL[lastResult.endReason]}
            </p>
            <p className="muted">{new Date(lastResult.endedAt).toLocaleString()}</p>
          </section>
        )}

        <section aria-labelledby="controls-title">
          <h2 id="controls-title">Controls</h2>
          <ControlsHelp />
        </section>
      </section>

      <section className="menu-panel" aria-label="Leaderboards">
        <Tabs
          label="Leaderboards"
          tabs={[
            {
              id: 'ranking',
              label: 'Ranking',
              content: <p className="muted">The ranking will appear here.</p>,
            },
            {
              id: 'history',
              label: 'Match History',
              content: <p className="muted">Your finished matches will appear here.</p>,
            },
          ]}
        />
      </section>
    </main>
  );
}
