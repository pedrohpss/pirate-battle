import { useModalDialog } from './useModalDialog';

interface PauseDialogProps {
  onResume: () => void;
  /** Optional until the main menu exists. */
  onMainMenu?: () => void;
}

/**
 * Shown while the match is paused (manually or because the tab lost focus).
 * Resuming always needs an explicit action: the button or the Esc key.
 */
export function PauseDialog({ onResume, onMainMenu }: PauseDialogProps) {
  // If the browser closes the dialog by itself, treat it as "Resume".
  const dialogRef = useModalDialog(onResume);

  return (
    <dialog
      ref={dialogRef}
      className="panel-dialog"
      aria-labelledby="pause-title"
      onCancel={(event) => {
        // Esc inside the dialog: resume instead of just closing it.
        event.preventDefault();
        onResume();
      }}
    >
      <h2 id="pause-title">Paused</h2>
      <p>The timer, the enemies and your cannons are frozen.</p>
      <div className="dialog-actions">
        <button type="button" className="menu-button primary" onClick={onResume} autoFocus>
          Resume
        </button>
        {onMainMenu && (
          <button type="button" className="menu-button secondary" onClick={onMainMenu}>
            Main Menu
          </button>
        )}
      </div>
    </dialog>
  );
}
