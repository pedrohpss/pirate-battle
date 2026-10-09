import { useEffect, useRef } from 'react';

/**
 * Opens a native <dialog> as a modal while the component is on screen.
 *
 * A modal <dialog> gives accessibility for free: focus moves inside it,
 * Tab cannot leave it, the rest of the page becomes inert, and screen
 * readers announce it as a dialog.
 */
export function useModalDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return dialogRef;
}
