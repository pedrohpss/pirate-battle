import { parseMatchRecord } from './contracts';
import type { MatchRecord } from './contracts';
import { readStorage, writeStorage } from '../settings/storage';

/**
 * Finished matches waiting to be registered on the server.
 *
 * - A match enters the queue the moment it ends, BEFORE the request is sent.
 * - Unconfirmed matches are kept in localStorage, so a failure or a page
 *   refresh never loses them; they are sent again on the next start.
 * - A match leaves storage only when the server confirms it.
 * - Each match keeps its own matchId forever, so sending it again is safe.
 */

export type SubmissionState = 'pending' | 'saving' | 'saved' | 'failed';

export interface Submission {
  record: MatchRecord;
  state: SubmissionState;
  /** Why the last attempt failed (shown to the player). */
  errorMessage: string | null;
}

const STORAGE_KEY = 'pending-matches:v1';

function loadUnconfirmed(): MatchRecord[] {
  return (
    readStorage(STORAGE_KEY, (value) => {
      if (!Array.isArray(value)) return null;
      return value.map(parseMatchRecord).filter((record): record is MatchRecord => record !== null);
    }) ?? []
  );
}

export class SubmissionQueue {
  private submissions: Submission[];
  private readonly listeners = new Set<() => void>();

  constructor(initialRecords: MatchRecord[] = loadUnconfirmed()) {
    this.submissions = initialRecords.map((record) => ({
      record,
      state: 'pending',
      errorMessage: null,
    }));
  }

  /** For React's useSyncExternalStore. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** A new array only when something changed. */
  readonly getSnapshot = (): Submission[] => this.submissions;

  get(matchId: string): Submission | undefined {
    return this.submissions.find((submission) => submission.record.matchId === matchId);
  }

  /** Matches not confirmed yet (waiting or failed). */
  unconfirmed(): Submission[] {
    return this.submissions.filter((submission) => submission.state !== 'saved');
  }

  /** Adds a finished match. Adding the same match twice does nothing. */
  add(record: MatchRecord): void {
    if (this.get(record.matchId)) return;
    this.submissions = [...this.submissions, { record, state: 'pending', errorMessage: null }];
    this.commit();
  }

  setState(matchId: string, state: SubmissionState, errorMessage: string | null = null): void {
    this.submissions = this.submissions.map((submission) =>
      submission.record.matchId === matchId ? { ...submission, state, errorMessage } : submission,
    );
    this.commit();
  }

  /** Forgets everything (used by "Reset demo data"). */
  clear(): void {
    this.submissions = [];
    this.commit();
  }

  /** Saves unconfirmed matches and notifies listeners. */
  private commit(): void {
    writeStorage(STORAGE_KEY, this.unconfirmed().map((submission) => submission.record));
    this.listeners.forEach((listener) => listener());
  }
}

/** The one queue the app uses. */
export const submissionQueue = new SubmissionQueue();
