import { useCallback, useEffect, useState } from 'react';
import type { MatchRecord } from './api/contracts';
import { submissionQueue } from './api/submissions';
import { useSubmissions, useSubmitMatch } from './api/useMatchSubmission';
import type { GameConfig } from './game/config';
import { loadLastResult, saveLastResult } from './settings/lastResult';
import type { MatchResult, MatchSummary } from './settings/lastResult';
import { createMatchConfig, loadOptions, saveOptions } from './settings/options';
import type { GameOptions } from './settings/options';
import { loadOrCreatePlayer } from './settings/player';
import { GameScreen } from './ui/GameScreen';
import { MainMenu } from './ui/MainMenu';
import { OptionsScreen } from './ui/OptionsScreen';

type Screen = 'menu' | 'options' | 'game';

/** The match being played: a number (used as React key) and its config snapshot. */
interface CurrentMatch {
  number: number;
  config: GameConfig;
}

/**
 * Top-level navigation between the three screens.
 * It is always mounted, so it also owns match registration:
 * a request keeps going even if the player leaves the result screen.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [player] = useState(loadOrCreatePlayer);
  const [options, setOptions] = useState<GameOptions>(loadOptions);
  const [lastResult, setLastResult] = useState<MatchResult | null>(loadLastResult);
  const [match, setMatch] = useState<CurrentMatch | null>(null);

  const submitMatch = useSubmitMatch();
  const submissions = useSubmissions();
  const unsavedMatches = submissions.filter((submission) => submission.state !== 'saved');

  /** Sends every match that is not confirmed yet (e.g. left over from a refresh). */
  const retryUnsaved = useCallback(() => {
    for (const submission of submissionQueue.unconfirmed()) submitMatch(submission.record.matchId);
  }, [submitMatch]);

  // On start, resume matches that were waiting when the page was closed.
  // Running twice (React Strict Mode) is harmless: a match already "saving" is skipped.
  useEffect(() => {
    retryUnsaved();
  }, [retryUnsaved]);

  /**
   * Starts a new match with a snapshot of the current options.
   * The new number gives GameScreen a new key, so React mounts a fresh match.
   * A match waiting to be saved does not block this.
   */
  const startMatch = useCallback(() => {
    setMatch((previous) => ({
      number: (previous?.number ?? 0) + 1,
      config: createMatchConfig(options),
    }));
    setScreen('game');
  }, [options]);

  const handleSaveOptions = useCallback((newOptions: GameOptions) => {
    setOptions(newOptions);
    return saveOptions(newOptions);
  }, []);

  /**
   * A match finished: keep it locally, queue it and send it.
   * The id is created here, once, and reused by every retry.
   */
  const handleMatchEnded = useCallback(
    (summary: MatchSummary): string => {
      const matchId = crypto.randomUUID();
      const result: MatchResult = { ...summary, matchId };
      saveLastResult(result);
      setLastResult(result);

      const record: MatchRecord = {
        matchId,
        playerId: player.id,
        playerName: player.name,
        endedAt: summary.endedAt,
        score: summary.score,
        duration: summary.timePlayed,
        endReason: summary.endReason,
        settings: summary.options,
      };
      submissionQueue.add(record);
      submitMatch(matchId);
      return matchId;
    },
    [player, submitMatch],
  );

  if (screen === 'options') {
    return (
      <OptionsScreen
        options={options}
        onSave={handleSaveOptions}
        onBack={() => setScreen('menu')}
      />
    );
  }

  if (screen === 'game' && match) {
    return (
      <GameScreen
        key={match.number}
        config={match.config}
        onPlayAgain={startMatch}
        onMainMenu={() => setScreen('menu')}
        onMatchEnded={handleMatchEnded}
        onRetrySubmission={submitMatch}
      />
    );
  }

  return (
    <MainMenu
      player={player}
      settings={options}
      lastResult={lastResult}
      unsavedMatches={unsavedMatches}
      onRetryUnsaved={retryUnsaved}
      onPlay={startMatch}
      onOptions={() => setScreen('options')}
    />
  );
}
