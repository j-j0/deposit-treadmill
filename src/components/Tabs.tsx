import { useRef, type KeyboardEvent } from 'react';

/**
 * Accessible tab bar (WAI-ARIA tabs pattern).
 *
 * Roving tabindex: only the selected tab is in the tab order, and arrow keys
 * move between them — so a keyboard user tabs *past* the bar in one press
 * rather than through every section name.
 */

export interface TabDef<T extends string> {
  id: T;
  label: string;
  /** One line under the bar saying what question this tab answers. */
  blurb: string;
}

interface Props<T extends string> {
  tabs: readonly TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
}

export function Tabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((t) => t.id === active);
    let nextIndex = -1;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (current + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (current - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = tabs[nextIndex]!;
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0]!;

  return (
    <div className="tabs">
      <div
        className="tabs__bar"
        role="tablist"
        aria-label="Sections of this calculator"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className="tabs__tab"
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <p className="tabs__blurb">{activeTab.blurb}</p>
    </div>
  );
}
