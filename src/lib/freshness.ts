import type { Source } from '../data/types';

/**
 * Data staleness.
 *
 * A static page has no way to notice that the world moved on. Left up for a
 * year, it would keep presenting a snapshot as if it were current — which for a
 * tool whose whole claim is "every figure traces to a cited source" would be the
 * worst kind of quiet failure. So the app works out when a newer edition of each
 * source should exist, and says so when one does.
 *
 * This does not fetch anything. It compares publication cadence against the
 * clock, which is all a static page can honestly do.
 */

/** Days past the expected next release before we call a source overdue. */
export const GRACE_DAYS = 14;

const MS_PER_DAY = 86_400_000;

export interface Staleness {
  source: Source;
  /** Days since the edition we shipped was released. */
  daysSinceRelease: number;
  /** When the publisher's next edition is expected. Null for irregular series. */
  nextExpected: Date | null;
  /** True when the next edition is more than GRACE_DAYS overdue. */
  isStale: boolean;
}

export function assessSource(source: Source, now: Date = new Date()): Staleness {
  const released = new Date(`${source.releaseISO}T00:00:00Z`);
  const daysSinceRelease = Math.floor((now.getTime() - released.getTime()) / MS_PER_DAY);

  if (source.cadenceDays === null) {
    // Irregular publications (RBA decisions, discontinued series) have no
    // expected next date, so there is nothing to be overdue against.
    return { source, daysSinceRelease, nextExpected: null, isStale: false };
  }

  const nextExpected = new Date(released.getTime() + source.cadenceDays * MS_PER_DAY);
  const isStale = now.getTime() > nextExpected.getTime() + GRACE_DAYS * MS_PER_DAY;

  return { source, daysSinceRelease, nextExpected, isStale };
}

export function assessAll(sources: readonly Source[], now: Date = new Date()): Staleness[] {
  return sources.map((s) => assessSource(s, now));
}

/**
 * Only the sources that are actually overdue, worst first.
 *
 * Auto-refreshed sources are excluded: judging them on publisher cadence would
 * fire a warning every time the ABS is a fortnight late, when the thing that
 * actually breaks is the refresh pipeline. `assessPipeline` watches that
 * instead, and covers all of them at once.
 */
export function staleSources(sources: readonly Source[], now: Date = new Date()): Staleness[] {
  return assessAll(sources, now)
    .filter((s) => s.isStale && !s.source.autoRefreshed)
    .sort((a, b) => b.daysSinceRelease - a.daysSinceRelease);
}

/** How long the refresh pipeline may go without running before we say so. */
export const PIPELINE_MAX_AGE_DAYS = 45;

export interface PipelineHealth {
  lastRefreshedISO: string;
  daysSinceRefresh: number;
  /** True when the scheduled refresh appears to have stopped running. */
  hasStalled: boolean;
}

/**
 * Whether the automated refresh is still running.
 *
 * A stalled pipeline is invisible by construction — the page keeps rendering
 * the last good values and looks perfectly healthy. This is the only signal
 * that the figures stopped being maintained.
 */
export function assessPipeline(
  lastRefreshedISO: string,
  now: Date = new Date(),
): PipelineHealth {
  const last = new Date(`${lastRefreshedISO}T00:00:00Z`);
  const daysSinceRefresh = Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
  return {
    lastRefreshedISO,
    daysSinceRefresh,
    hasStalled: daysSinceRefresh > PIPELINE_MAX_AGE_DAYS,
  };
}

/** "3 months old" / "26 days old" — the age of the shipped edition. */
export function describeAge(days: number): string {
  if (days < 45) return `${days} day${days === 1 ? '' : 's'} old`;
  const months = Math.round(days / 30.44);
  if (months < 18) return `${months} month${months === 1 ? '' : 's'} old`;
  const years = (days / 365.25).toFixed(1);
  return `${years} years old`;
}
