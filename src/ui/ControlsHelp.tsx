/** Keyboard controls, shown in the main menu. */
const CONTROLS = [
  { keys: ['W', '↑'], action: 'Sail forward' },
  { keys: ['A', '←'], action: 'Turn left' },
  { keys: ['D', '→'], action: 'Turn right' },
  { keys: ['Space'], action: 'Fire bow cannon (1 shot)' },
  { keys: ['Q'], action: 'Fire left broadside (3 shots)' },
  { keys: ['E'], action: 'Fire right broadside (3 shots)' },
  { keys: ['Esc', 'P'], action: 'Pause' },
  { keys: ['M'], action: 'Sound on/off' },
];

export function ControlsHelp() {
  return (
    <dl className="controls-list">
      {CONTROLS.map(({ keys, action }) => (
        <div key={action}>
          <dt>
            {keys.map((key, index) => (
              <span key={key}>
                {index > 0 && ' / '}
                <kbd>{key}</kbd>
              </span>
            ))}
          </dt>
          <dd>{action}</dd>
        </div>
      ))}
    </dl>
  );
}
