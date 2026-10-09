import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  /** Accessible name of the whole tab group. */
  label: string;
  tabs: TabItem[];
}

/**
 * Accessible tabs following the WAI-ARIA "tabs" pattern:
 * - only the selected tab is reachable with Tab (the others have tabIndex -1);
 * - Left/Right arrows move between tabs, Home/End jump to the first/last;
 * - only the selected panel is rendered, so its content mounts again every
 *   time the tab is shown (useful to refresh data when a tab reopens).
 */
export function Tabs({ label, tabs }: TabsProps) {
  const [selectedId, setSelectedId] = useState(tabs[0].id);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const selected = tabs.find((tab) => tab.id === selectedId) ?? tabs[0];

  function selectAndFocus(index: number) {
    const tab = tabs[(index + tabs.length) % tabs.length]; // wraps around
    setSelectedId(tab.id);
    tabRefs.current?.get(tab.id)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === selected.id);
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    selectAndFocus(moves[event.key]);
  }

  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tab-list" onKeyDown={handleKeyDown}>
        {tabs.map((tab) => {
          const isSelected = tab.id === selected.id;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) tabRefs.current?.set(tab.id, element);
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              className="tab"
              onClick={() => setSelectedId(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${selected.id}`}
        aria-labelledby={`tab-${selected.id}`}
        className="tab-panel"
        tabIndex={0}
      >
        {selected.content}
      </div>
    </div>
  );
}
