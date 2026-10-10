import { useState } from 'react';
import type { PointerEvent } from 'react';
import type { InputAction, TouchInput } from '../game/input/TouchInput';

const ICON_PATH = '/assets/png/default/ui/controls';

interface ButtonSpec {
  action: InputAction;
  icon: string;
  label: string;
}

/** Left thumb: movement. */
const MOVE_BUTTONS: ButtonSpec[] = [
  { action: 'turnLeft', icon: 'icon_turn_left', label: 'Turn left' },
  { action: 'forward', icon: 'icon_forward', label: 'Sail forward' },
  { action: 'turnRight', icon: 'icon_turn_right', label: 'Turn right' },
];

/** Right thumb: cannons. */
const FIRE_BUTTONS: ButtonSpec[] = [
  { action: 'fireLeft', icon: 'icon_fire_left', label: 'Fire left broadside' },
  { action: 'fireFront', icon: 'icon_fire_front', label: 'Fire bow cannon' },
  { action: 'fireRight', icon: 'icon_fire_right', label: 'Fire right broadside' },
];

/**
 * On-screen buttons for touch screens. Each button is "held": it is active
 * from the moment the finger touches it until the finger lifts. Pointer
 * events handle several fingers at once, so the player can sail and fire
 * at the same time.
 */
export function TouchControls({ touch }: { touch: TouchInput }) {
  return (
    <div className="touch-controls">
      <div className="touch-cluster" role="group" aria-label="Movement">
        {MOVE_BUTTONS.map((spec) => (
          <HoldButton key={spec.action} spec={spec} touch={touch} />
        ))}
      </div>
      <div className="touch-cluster" role="group" aria-label="Cannons">
        {FIRE_BUTTONS.map((spec) => (
          <HoldButton key={spec.action} spec={spec} touch={touch} />
        ))}
      </div>
    </div>
  );
}

function HoldButton({ spec, touch }: { spec: ButtonSpec; touch: TouchInput }) {
  const [isPressed, setIsPressed] = useState(false);

  function press(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    touch.press(spec.action);
    setIsPressed(true);
    // Keep receiving this finger's events even if it slides off the button.
    // (Can fail for synthetic events, e.g. in automated tests: not a problem.)
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function release() {
    touch.release(spec.action);
    setIsPressed(false);
  }

  return (
    <button
      type="button"
      className={isPressed ? 'touch-button is-pressed' : 'touch-button'}
      aria-label={spec.label}
      // Keyboard users have the keyboard controls; these are for fingers only.
      tabIndex={-1}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <img src={`${ICON_PATH}/${spec.icon}.png`} alt="" draggable={false} />
    </button>
  );
}
