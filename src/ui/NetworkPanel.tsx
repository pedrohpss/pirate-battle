import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { submissionQueue } from '../api/submissions';
import { resetDatabase } from '../mocks/db';
import { getScenario, resetScenario, SCENARIOS, setScenario } from '../mocks/scenarios';
import type { ScenarioId } from '../mocks/scenarios';

/**
 * Demo and test helper: choose how the mock API behaves,
 * or put the mock data back to its initial state.
 */
export function NetworkPanel() {
  const queryClient = useQueryClient();
  const [scenario, setCurrent] = useState<ScenarioId>(getScenario);
  const description = SCENARIOS.find((item) => item.id === scenario)?.description;

  function handleChange(id: ScenarioId) {
    setScenario(id);
    setCurrent(id);
    // Show the effect right away: refetch what is on screen.
    void queryClient.invalidateQueries();
  }

  function handleReset() {
    resetScenario();
    resetDatabase(localStorage);
    submissionQueue.clear();
    queryClient.clear();
    window.location.reload();
  }

  return (
    <details className="network-panel">
      <summary>Network simulation (demo)</summary>
      <label htmlFor="network-scenario">Scenario</label>
      <select
        id="network-scenario"
        value={scenario}
        onChange={(event) => handleChange(event.target.value as ScenarioId)}
        aria-describedby="network-scenario-hint"
      >
        {SCENARIOS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <p id="network-scenario-hint" className="muted">
        {description}
      </p>
      <button type="button" className="small-button" onClick={handleReset}>
        Reset demo data
      </button>
    </details>
  );
}
