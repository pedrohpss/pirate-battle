import type { Submission } from '../api/submissions';

interface SubmissionStatusProps {
  submission: Submission | null;
  onRetry: () => void;
}

/** Where the match registration stands, with a retry button when it failed. */
export function SubmissionStatus({ submission, onRetry }: SubmissionStatusProps) {
  return (
    <div className="submission-status" role="status">
      {renderContent(submission, onRetry)}
    </div>
  );
}

function renderContent(submission: Submission | null, onRetry: () => void) {
  switch (submission?.state) {
    case undefined:
    case 'pending':
    case 'saving':
      return <p>Saving to the ranking and history…</p>;
    case 'saved':
      return <p className="status-good">Saved to the ranking and history.</p>;
    case 'failed':
      return (
        <>
          <p className="status-bad">
            Not saved yet: {submission.errorMessage} Your result is kept on this device.
          </p>
          <button type="button" className="small-button" onClick={onRetry}>
            Retry saving
          </button>
        </>
      );
  }
}
