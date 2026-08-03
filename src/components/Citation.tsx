import { SOURCES, getSource } from '../data/sources';

/**
 * Superscript reference marker linking to the sources panel.
 *
 * Numbering is the position in the source registry, so a figure's citation
 * number is stable regardless of which figures happen to be on screen.
 */

const INDEX = new Map(SOURCES.map((s, i) => [s.id, i + 1]));

export function sourceNumber(sourceId: string): number | null {
  return INDEX.get(sourceId) ?? null;
}

export function Citation({ sourceId }: { sourceId: string }) {
  const n = INDEX.get(sourceId);
  const source = getSource(sourceId);

  // A figure that cites a source we do not have is a bug, not something to
  // render quietly. Tests enforce this; this is the runtime backstop.
  if (!n || !source) return null;

  return (
    <a
      className="citation"
      href={`#source-${sourceId}`}
      title={`${source.publisher} — ${source.title}`}
      aria-label={`Source ${n}: ${source.publisher}, ${source.title}`}
    >
      [{n}]
    </a>
  );
}

/** Marks a figure as a user-editable assumption rather than published data. */
export function AssumptionBadge({ label = 'Your assumption' }: { label?: string }) {
  return <span className="badge badge--assumption">{label}</span>;
}
