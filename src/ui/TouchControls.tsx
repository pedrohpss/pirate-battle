import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { InputAction, TouchInput } from '../game/input/TouchInput';

const ICON_PATH = '/assets/png/default/ui/controls';

interface ButtonSpec {
  action: InputAction;
  icon: string;
  label: string;
}

type MoveAction = 'forward' | 'turnLeft' | 'turnRight';
const MOVE_ACTIONS: MoveAction[] = ['forward', 'turnLeft', 'turnRight'];

/** Right thumb: cannons. */
const FIRE_BUTTONS: ButtonSpec[] = [
  { action: 'fireLeft', icon: 'icon_fire_left', label: 'Fire left broadside' },
  { action: 'fireFront', icon: 'icon_fire_front', label: 'Fire bow cannon' },
  { action: 'fireRight', icon: 'icon_fire_right', label: 'Fire right broadside' },
];

/*
 * Movement pad zones. The pad is a 3 × 2 grid:
 *
 *   [ sail + left ] [   sail   ] [ sail + right ]
 *   [    left     ] [ (nothing)] [    right     ]
 *
 * Positions are measured from the pad's centre, from -1 (left/top edge)
 * to +1 (right/bottom edge). The top row sails forward; the outer columns
 * turn. So one thumb can sail and turn at the same time by touching an
 * upper corner, and it can slide between zones without lifting.
 */
const FORWARD_ZONE = 0.1; // above this line (a bit below the middle): sail
const TURN_ZONE = 1 / 3; // outside these columns: turn

/** Which movement actions a finger at (clientX, clientY) asks for. */
function actionsAt(pad: HTMLElement, clientX: number, clientY: number): Set<MoveAction> {
  const rect = pad.getBoundingClientRect();
  const x = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
  const y = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
  const actions = new Set<MoveAction>();
  if (y < FORWARD_ZONE) actions.add('forward');
  if (x < -TURN_ZONE) actions.add('turnLeft');
  else if (x > TURN_ZONE) actions.add('turnRight');
  return actions;
}

/**
 * On-screen controls for touch screens.
 * - Left thumb: a movement pad (one finger can sail and turn together).
 * - Right thumb: three cannon buttons, each held while the finger is down.
 * Pointer events handle several fingers at once, so the player can move
 * and fire at the same time.
 */
export function TouchControls({ touch }: { touch: TouchInput }) {
  return (
    <div className="touch-controls">
      <MovementPad touch={touch} />
      <div className="touch-cluster" role="group" aria-label="Cannons">
        {FIRE_BUTTONS.map((spec) => (
          <HoldButton key={spec.action} spec={spec} touch={touch} />
        ))}
      </div>
    </div>
  );
}

function MovementPad({ touch }: { touch: TouchInput }) {
  const padRef = useRef<HTMLDivElement>(null);
  // The finger currently driving the pad (one finger at a time).
  const pointerIdRef = useRef<number | null>(null);
  // Only for the "pressed" look of the buttons, e.g. "forward,turnLeft".
  const [activeKey, setActiveKey] = useState('');

  function apply(actions: Set<MoveAction>) {
    for (const action of MOVE_ACTIONS) {
      if (actions.has(action)) touch.press(action);
      else touch.release(action);
    }
    // Re-render only when the set really changed, not on every finger move.
    const key = MOVE_ACTIONS.filter((action) => actions.has(action)).join(',');
    setActiveKey((previous) => (previous === key ? previous : key));
  }

  function handleDown(event: PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== null || !padRef.current) return;
    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    // Keep receiving this finger's events even if it slides off the pad.
    // (Can fail for synthetic events, e.g. in automated tests: not a problem.)
    try {
      padRef.current.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    apply(actionsAt(padRef.current, event.clientX, event.clientY));
  }

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== pointerIdRef.current || !padRef.current) return;
    apply(actionsAt(padRef.current, event.clientX, event.clientY));
  }

  function handleUp(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    apply(new Set());
  }

  const isActive = (action: MoveAction) => activeKey.split(',').includes(action);

  return (
    <div
      ref={padRef}
      className="touch-pad"
      role="group"
      aria-label="Movement"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={handleUp}
      onContextMenu={(event) => event.preventDefault()}
    >
      {/* The pad itself handles the touches; these buttons show where the zones are. */}
      <PadButton area="forward" icon="icon_forward" label="Sail forward" pressed={isActive('forward')} />
      <PadButton area="left" icon="icon_turn_left" label="Turn left" pressed={isActive('turnLeft')} />
      <PadButton area="right" icon="icon_turn_right" label="Turn right" pressed={isActive('turnRight')} />
    </div>
  );
}

function PadButton(props: { area: string; icon: string; label: string; pressed: boolean }) {
  return (
    <button
      type="button"
      className={`touch-button pad-${props.area}${props.pressed ? ' is-pressed' : ''}`}
      aria-label={props.label}
      // Keyboard users have the keyboard controls; these are for fingers only.
      tabIndex={-1}
    >
      <img src={`${ICON_PATH}/${props.icon}.png`} alt="" draggable={false} />
    </button>
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
