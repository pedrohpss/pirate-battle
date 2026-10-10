import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { describeError } from '../api/client';
import type { Page } from '../api/contracts';

interface QueryViewProps<T> {
  query: UseQueryResult<Page<T>>;
  /** What the list is, for messages ("the ranking"). */
  subject: string;
  emptyMessage: string;
  children: (page: Page<T>) => ReactNode;
}

/**
 * The four states of server data, in one place, so both tabs behave the same:
 * loading (first time), error (nothing to show), empty, and data.
 * With data on screen, a background refresh shows "Updating…" and a failed
 * refresh keeps the old data visible with a warning instead of hiding it.
 */
export function QueryView<T>({ query, subject, emptyMessage, children }: QueryViewProps<T>) {
  const { data, isPending, isError, error, isFetching, failureCount, refetch } = query;
  const retrying = failureCount > 0 ? ` (attempt ${failureCount + 1})` : '';

  if (isPending) {
    return (
      <p className="query-message" role="status">
        Loading {subject}…{retrying}
      </p>
    );
  }

  if (isError && !data) {
    return (
      <div className="query-message query-error" role="alert">
        <p>
          Could not load {subject}. {describeError(error)}
        </p>
        <button type="button" className="small-button" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <p className="query-updating" role="status">
        {isFetching ? `Updating…${retrying}` : ''}
      </p>
      {isError && (
        <div className="query-warning" role="alert">
          <p>Could not refresh {subject}. Showing the last data received.</p>
          <button type="button" className="small-button" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      )}
      {data.totalItems === 0 ? <p className="query-message">{emptyMessage}</p> : children(data)}
    </>
  );
}
