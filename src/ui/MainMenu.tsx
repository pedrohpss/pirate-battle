import type { MatchSettings } from '../api/contracts';
import type { Submission } from '../api/submissions';
import type { MatchResult } from '../settings/lastResult';
import type { Player } from '../settings/player';
import { ControlsHelp } from './ControlsHelp';
import { formatTime } from './format';
import { HistoryTab } from './HistoryTab';
import { NetworkPanel } from './NetworkPanel';
import { RankingTab } from './RankingTab';
import { Tabs } from './Tabs';

interface MainMenuProps {
  player: Player;
  /** Current options: the ranking shows matches played with them. */
  settings: MatchSettings;
  lastResult: MatchResult | null;
  /** Matches not confirmed by the server yet. */
  unsavedMatches: Submission[];
  onRetryUnsaved: () => void;
  onPlay: () => void;
  onOptions: () => void;
}

const END_REASON_LABEL = { time: 'Survived', death: 'Sunk' } as const;

export function MainMenu({
  player,
  settings,
  lastResult,
  unsavedMatches,
  onRetryUnsaved,
  onPlay,
  onOptions,
}: MainMenuProps) {
  const isSaving = unsavedMatches.some((submission) => submission.state === 'saving');
  const count = unsavedMatches.length;

  return (
    <main className="menu-screen">
      <section className="menu-panel" aria-labelledby="game-title">
        <h1 id="game-title" className="game-title">
          <img src="/assets/png/default/ui/menu/title_pirate_battle.png" alt="Pirate Battle" />
        </h1>
        <p className="muted center">
          Playing as <strong>{player.name}</strong>
        </p>
        {/* Shown by CSS only on phones held upright. */}
        <p className="orientation-hint">Turn your phone sideways (landscape) to play.</p>

        <div className="dialog-actions">
          <button type="button" className="menu-button primary" onClick={onPlay} autoFocus>
            Play
          </button>
          <button type="button" className="menu-button secondary" onClick={onOptions}>
            Options
          </button>
        </div>

        {count > 0 && (
          <div className="unsaved-banner" role="status">
            <p>
              {count} {count === 1 ? 'match is' : 'matches are'} waiting to be saved
              {isSaving ? '. Saving now…' : '.'}
            </p>
            {!isSaving && (
              <button type="button" className="small-button" onClick={onRetryUnsaved}>
                Retry now
              </button>
            )}
          </div>
        )}

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

        <NetworkPanel />
      </section>

      <section className="menu-panel" aria-label="Leaderboards">
        <Tabs
          label="Leaderboards"
          tabs={[
            {
              id: 'ranking',
              label: 'Ranking',
              content: <RankingTab settings={settings} playerId={player.id} />,
            },
            {
              id: 'history',
              label: 'Match History',
              content: <HistoryTab playerId={player.id} />,
            },
          ]}
        />
      </section>
    </main>
  );
}
