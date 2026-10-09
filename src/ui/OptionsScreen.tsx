import { useState } from 'react';
import type { FormEvent } from 'react';
import { OPTION_LIMITS, validateOptions } from '../settings/options';
import type { GameOptions, OptionErrors } from '../settings/options';

interface OptionsScreenProps {
  options: GameOptions;
  /** Saves valid options. Returns false if the browser refused to store them. */
  onSave: (options: GameOptions) => boolean;
  onBack: () => void;
}

/** Form values are kept as text, exactly as typed, until they are validated. */
type FormValues = Record<keyof GameOptions, string>;

const FIELD_IDS: Record<keyof GameOptions, string> = {
  matchDuration: 'option-match-duration',
  spawnInterval: 'option-spawn-interval',
};

export function OptionsScreen({ options, onSave, onBack }: OptionsScreenProps) {
  const [values, setValues] = useState<FormValues>({
    matchDuration: String(options.matchDuration),
    spawnInterval: String(options.spawnInterval),
  });
  const [errors, setErrors] = useState<OptionErrors>({});
  const [statusMessage, setStatusMessage] = useState('');

  function handleChange(field: keyof GameOptions, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setStatusMessage(''); // an old "Saved" message would be misleading now
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stay on the page: we handle the form ourselves
    const result = validateOptions(values);
    setErrors(result.errors);

    if (!result.options) {
      setStatusMessage('');
      // Move focus to the first invalid field; its error message is read with it.
      const firstInvalid = (Object.keys(result.errors) as (keyof GameOptions)[])[0];
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      return;
    }

    const saved = onSave(result.options);
    setStatusMessage(
      saved
        ? 'Options saved. They apply to your next match.'
        : 'This browser blocked saving. The options apply until you close the page.',
    );
  }

  const { matchDuration, spawnInterval } = OPTION_LIMITS;

  return (
    <main className="menu-screen">
      {/* noValidate: we show our own accessible messages instead of the browser's. */}
      <form className="menu-panel options-form" onSubmit={handleSubmit} noValidate>
        <h1>Options</h1>

        <NumberField
          id={FIELD_IDS.matchDuration}
          label="Game session time"
          hint={`Seconds of play per match, from ${matchDuration.min} to ${matchDuration.max}.`}
          value={values.matchDuration}
          error={errors.matchDuration}
          limits={matchDuration}
          onChange={(value) => handleChange('matchDuration', value)}
          autoFocus
        />

        <NumberField
          id={FIELD_IDS.spawnInterval}
          label="Enemy spawn time"
          hint={`Seconds between new enemies, from ${spawnInterval.min} to ${spawnInterval.max}. Lower is harder.`}
          value={values.spawnInterval}
          error={errors.spawnInterval}
          limits={spawnInterval}
          onChange={(value) => handleChange('spawnInterval', value)}
        />

        <p className="form-status" role="status">
          {statusMessage}
        </p>

        <div className="dialog-actions">
          <button type="submit" className="menu-button primary">
            Save
          </button>
          <button type="button" className="menu-button secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </form>
    </main>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  hint: string;
  value: string;
  error?: string;
  limits: { min: number; max: number; step: number };
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

/**
 * A labelled number input. The hint and the error are linked with
 * aria-describedby, so screen readers read them together with the label.
 */
function NumberField({ id, label, hint, value, error, limits, onChange, autoFocus }: NumberFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <p id={hintId} className="muted">
        {hint}
      </p>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={limits.min}
        max={limits.max}
        step={limits.step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        autoFocus={autoFocus}
      />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
