import { useCallback, useSyncExternalStore } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { describeError } from './client';
import { registerMatch } from './matchesApi';
import { queryKeys } from './queries';
import { submissionQueue } from './submissions';
import type { Submission } from './submissions';

/** Every submission of this session (re-renders only when the queue changes). */
export function useSubmissions(): Submission[] {
  return useSyncExternalStore(submissionQueue.subscribe, submissionQueue.getSnapshot);
}

/** The submission of one match, or null. */
export function useSubmission(matchId: string | null): Submission | null {
  const submissions = useSubmissions();
  return submissions.find((submission) => submission.record.matchId === matchId) ?? null;
}

/**
 * Returns a function that sends a queued match to the server.
 * Used by the App component, which is always mounted, so the request
 * finishes even if the player leaves the result screen.
 */
export function useSubmitMatch(): (matchId: string) => void {
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationKey: ['register-match'],
    mutationFn: registerMatch,
    onSuccess: (_response, record) => {
      submissionQueue.setState(record.matchId, 'saved');
      // Both tabs show this match now: mark their data as old so they reload.
      void queryClient.invalidateQueries({ queryKey: queryKeys.allRankings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allHistories });
    },
    onError: (error, record) => {
      submissionQueue.setState(record.matchId, 'failed', describeError(error));
    },
  });

  return useCallback(
    (matchId: string) => {
      const submission = submissionQueue.get(matchId);
      // Repeated clicks while a request is running, or after it succeeded, do nothing.
      if (!submission || submission.state === 'saving' || submission.state === 'saved') return;
      // Marked synchronously, so a second call in the same instant is ignored too.
      submissionQueue.setState(matchId, 'saving');
      mutate(submission.record);
    },
    [mutate],
  );
}
