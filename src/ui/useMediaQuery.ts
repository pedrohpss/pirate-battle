import { useCallback, useSyncExternalStore } from 'react';

/** True while the CSS media query matches; updates when it changes (rotation, resize). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/**
 * Touch controls are shown on touch screens (coarse pointer).
 * `?touch=1` in the URL forces them on, to try them on a desktop.
 */
export function useTouchControls(): boolean {
  const isTouchScreen = useMediaQuery('(pointer: coarse)');
  const forced = new URLSearchParams(window.location.search).get('touch') === '1';
  return isTouchScreen || forced;
}
