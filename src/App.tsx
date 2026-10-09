import { useCallback, useState } from 'react';
import type { GameConfig } from './game/config';
import { loadLastResult, saveLastResult } from './settings/lastResult';
import type { MatchResult } from './settings/lastResult';
import { createMatchConfig, loadOptions, saveOptions } from './settings/options';
import type { GameOptions } from './settings/options';
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
 * Options and the last result are read from localStorage once, on start.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [options, setOptions] = useState<GameOptions>(loadOptions);
  const [lastResult, setLastResult] = useState<MatchResult | null>(loadLastResult);
  const [match, setMatch] = useState<CurrentMatch | null>(null);

  /**
   * Starts a new match with a snapshot of the current options.
   * The new number gives GameScreen a new key, so React mounts a fresh match.
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

  // Stable function (useCallback with no dependencies), so GameScreen's
  // effect does not run again just because App re-rendered.
  const handleMatchEnded = useCallback((result: MatchResult) => {
    saveLastResult(result);
    setLastResult(result);
  }, []);

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
      />
    );
  }

  return (
    <MainMenu
      lastResult={lastResult}
      onPlay={startMatch}
      onOptions={() => setScreen('options')}
    />
  );
}
