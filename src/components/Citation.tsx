import { createContext, useContext } from 'react';
import { SOURCES, getSource } from '../data/sources';

/**
 * Superscript reference marker pointing at the sources tab.
 *
 * Rendered as a BUTTON, not an anchor. An `href="#source-x"` would overwrite
 * the URL hash — which is where this app stores the reader's entire scenario —
 * silently resetting every input back to defaults the moment anyone clicked a
 * citation. Navigation goes through a callback instead, so the hash stays the
 * state and nothing else.
 *
 * Numbering is the position in the source registry, so a figure's citation
 * number is stable regardless of which tab happens to be open.
 */

const INDEX = new Map(SOURCES.map((s, i) => [s.id, i + 1]));

/** Supplied by App: switch to the sources tab and scroll to this source. */
export const SourceNavContext = createContext<((sourceId: string) => void) | null>(null);

export function sourceNumber(sourceId: string): number | null {
  return INDEX.get(sourceId) ?? null;
}

export function Citation({ sourceId }: { sourceId: string }) {
  const navigate = useContext(SourceNavContext);
  const n = INDEX.get(sourceId);
  const source = getSource(sourceId);

  // A figure that cites a source we do not have is a bug, not something to
  // render quietly. Tests enforce this; this is the runtime backstop.
  if (!n || !source) return null;

  return (
    <button
      type="button"
      className="citation"
      title={`${source.publisher} — ${source.title}`}
      aria-label={`Source ${n}: ${source.publisher}, ${source.title}. Opens the sources tab.`}
      onClick={() => navigate?.(sourceId)}
    >
      [{n}]
    </button>
  );
}

/** Marks a figure as a user-editable assumption rather than published data. */
export function AssumptionBadge({ label = 'Your assumption' }: { label?: string }) {
  return <span className="badge badge--assumption">{label}</span>;
}

/**
 * Inline "change this in the Assumptions tab" link. Panels reference
 * assumptions constantly; once they live on another tab, telling the reader
 * they're "below" would simply be false.
 */
export const AssumptionsNavContext = createContext<(() => void) | null>(null);

export function AssumptionsLink({ children }: { children: React.ReactNode }) {
  const navigate = useContext(AssumptionsNavContext);
  return (
    <button type="button" className="inline-link" onClick={() => navigate?.()}>
      {children}
    </button>
  );
}
