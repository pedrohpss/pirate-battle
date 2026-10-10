import type { PlayerInput } from '../simulation/types';

/** Every action a touch button can hold down. Same names as PlayerInput. */
export type InputAction = keyof PlayerInput;

/**
 * Holds which on-screen buttons are pressed right now.
 * The React touch buttons call press() and release(); the game loop reads
 * getState(). It produces the same PlayerInput shape as the keyboard,
 * so the simulation does not know (or care) where the input came from.
 */
export class TouchInput {
  private readonly pressed = new Set<InputAction>();
  private enabled = true;

  press(action: InputAction): void {
    if (this.enabled) this.pressed.add(action);
  }

  release(action: InputAction): void {
    this.pressed.delete(action);
  }

  /** Same rule as the keyboard: only real changes count, and disabling releases everything. */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.pressed.clear();
  }

  releaseAll(): void {
    this.pressed.clear();
  }

  getState(): PlayerInput {
    return {
      forward: this.pressed.has('forward'),
      turnLeft: this.pressed.has('turnLeft'),
      turnRight: this.pressed.has('turnRight'),
      fireFront: this.pressed.has('fireFront'),
      fireLeft: this.pressed.has('fireLeft'),
      fireRight: this.pressed.has('fireRight'),
    };
  }
}

/** Combines two input sources: an action is active if either source asks for it. */
export function mergeInputs(a: PlayerInput, b: PlayerInput): PlayerInput {
  return {
    forward: a.forward || b.forward,
    turnLeft: a.turnLeft || b.turnLeft,
    turnRight: a.turnRight || b.turnRight,
    fireFront: a.fireFront || b.fireFront,
    fireLeft: a.fireLeft || b.fireLeft,
    fireRight: a.fireRight || b.fireRight,
  };
}
