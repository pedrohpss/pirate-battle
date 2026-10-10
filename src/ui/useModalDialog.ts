import { useEffect, useRef } from 'react';

/**
 * Opens a native <dialog> as a modal while the component is on screen.
 *
 * A modal <dialog> gives accessibility for free: focus moves inside it,
 * Tab cannot leave it, the rest of the page becomes inert, and screen
 * readers announce it as a dialog.
 *
 * The browser can still close the dialog by itself. Chrome, for example,
 * skips the `cancel` event when Esc (or the Android back gesture) is used
 * twice without a click or tap in between, and then closes the dialog
 * directly. The component would stay mounted with an invisible dialog and the
 * player would be stuck. So, if the dialog closes while the component is still
 * on screen:
 * - with `onDismiss`, that action runs (the pause dialog resumes the match);
 * - without it, the dialog is opened again (the result dialog needs a choice).
 */
export function useModalDialog(onDismiss?: () => void) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Always call the latest callback without re-running the effect.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // True while our own cleanup closes the dialog (that close is expected).
    let closingOnUnmount = false;

    const handleClose = () => {
      if (closingOnUnmount || !dialog.isConnected) return;
      if (onDismissRef.current) onDismissRef.current();
      else dialog.showModal();
    };

    dialog.addEventListener('close', handleClose);
    if (!dialog.open) dialog.showModal();

    return () => {
      closingOnUnmount = true;
      dialog.removeEventListener('close', handleClose);
      dialog.close();
    };
  }, []);

  return dialogRef;
}