import { useState } from 'react';
import { DEFAULT_GAME_CONFIG } from './game/config';
import { GameScreen } from './ui/GameScreen';

export default function App() {
  // Changing this number gives GameScreen a new key, which makes React
  // discard the old match entirely and mount a fresh one.
  const [matchNumber, setMatchNumber] = useState(1);

  return (
    <GameScreen
      key={matchNumber}
      config={DEFAULT_GAME_CONFIG}
      onPlayAgain={() => setMatchNumber((number) => number + 1)}
    />
  );
}
