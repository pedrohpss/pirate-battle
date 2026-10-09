import type { PlayerInput } from '../simulation/types';

/**
 * Which physical keys trigger each action.
 * `event.code` is used (not `event.key`) so the layout works
 * the same on any keyboard (ABNT, US, etc.).
 */
export const KEY_BINDINGS: Record<keyof PlayerInput, string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  turnLeft: ['KeyA', 'ArrowLeft'],
  turnRight: ['KeyD', 'ArrowRight'],
  fireFront: ['Space'],
  fireLeft: ['KeyQ'],
  fireRight: ['KeyE'],
};

const HANDLED_KEYS = new Set(Object.values(KEY_BINDINGS).flat());

/** Tracks which keys are held down and converts them into a PlayerInput. */
export class KeyboardInput {
  private readonly pressedKeys = new Set<string>();
  /**
   * Game keys are only captured while gameplay is active. When disabled
   * (paused, menus, dialogs), keys keep their normal browser behavior.
   */
  private enabled = true;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled || !HANDLED_KEYS.has(event.code)) return;
    event.preventDefault(); // stop arrows/space from scrolling the page
    this.pressedKeys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code);
  };

  /** When the window loses focus we never receive keyup, so release everything. */
  private readonly onBlur = () => {
    this.pressedKeys.clear();
  };

  /** Starts listening to the keyboard. */
  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  setEnabled(enabled: boolean): void {
    // Only act on a real change: being told "enabled" again while already
    // enabled must not release the keys the player is holding.
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.pressedKeys.clear();
  }

  /** Stops listening. Must be called when leaving the game to avoid leaks. */
  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.pressedKeys.clear();
  }

  /** Snapshot of what the player wants to do right now. */
  getState(): PlayerInput {
    return {
      forward: this.isAnyPressed(KEY_BINDINGS.forward),
      turnLeft: this.isAnyPressed(KEY_BINDINGS.turnLeft),
      turnRight: this.isAnyPressed(KEY_BINDINGS.turnRight),
      fireFront: this.isAnyPressed(KEY_BINDINGS.fireFront),
      fireLeft: this.isAnyPressed(KEY_BINDINGS.fireLeft),
      fireRight: this.isAnyPressed(KEY_BINDINGS.fireRight),
    };
  }

  private isAnyPressed(codes: string[]): boolean {
    return codes.some((code) => this.pressedKeys.has(code));
  }
}
