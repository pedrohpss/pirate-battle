import { isRecord, readStorage, writeStorage } from './storage';

/** The person playing on this device. There is no login: the id is created once and kept. */
export interface Player {
  id: string;
  name: string;
}

const STORAGE_KEY = 'player:v1';

export function loadOrCreatePlayer(): Player {
  const saved = readStorage(STORAGE_KEY, (value) =>
    isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string'
      ? { id: value.id, name: value.name }
      : null,
  );
  if (saved) return saved;

  const player: Player = {
    id: crypto.randomUUID(),
    name: `Captain ${1000 + Math.floor(Math.random() * 9000)}`,
  };
  writeStorage(STORAGE_KEY, player);
  return player;
}
