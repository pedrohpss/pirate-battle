/**
 * Small, safe wrappers around localStorage.
 *
 * localStorage can throw (private mode, storage full, blocked cookies) and
 * can contain anything (old versions, manual edits). So every read goes
 * through try/catch and a `parse` function that validates the data and
 * returns null when it is not usable.
 */

/** Prefix that keeps our keys apart from other sites' data on localhost. */
const KEY_PREFIX = 'pirate-battle:';

export function readStorage<T>(key: string, parse: (value: unknown) => T | null): T | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    if (raw === null) return null;
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Returns false if the browser refused to save. */
export function writeStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** True when `value` is a plain object (not null, not an array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
