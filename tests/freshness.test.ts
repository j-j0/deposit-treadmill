import { describe, it, expect } from 'vitest';
import {
  assessSource,
  staleSources,
  describeAge,
  assessPipeline,
  GRACE_DAYS,
  PIPELINE_MAX_AGE_DAYS,
} from '../src/lib/freshness';
import { SOURCES, LAST_REFRESHED_ISO } from '../src/data/sources';
import type { Source } from '../src/data/types';

const monthly: Source = {
  id: 'test-monthly',
  publisher: 'Test',
  title: 'Monthly thing',
  url: 'https://example.com',
  referencePeriod: 'June 2026',
  releaseDate: '1 July 2026',
  releaseISO: '2026-07-01',
  cadenceDays: 31,
  accessed: '31 July 2026',
  autoRefreshed: false,
};

const irregular: Source = { ...monthly, id: 'test-irregular', cadenceDays: null };
const automated: Source = { ...monthly, id: 'test-automated', autoRefreshed: true };

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('assessSource', () => {
  it('is fresh before the next edition is due', () => {
    const r = assessSource(monthly, at('2026-07-20'));
    expect(r.isStale).toBe(false);
    expect(r.daysSinceRelease).toBe(19);
  });

  it('is still fresh inside the grace period', () => {
    // Next expected 1 Aug; grace runs to 15 Aug.
    const r = assessSource(monthly, at('2026-08-10'));
    expect(r.isStale).toBe(false);
  });

  it('goes stale once the grace period passes', () => {
    const r = assessSource(monthly, at('2026-08-20'));
    expect(r.isStale).toBe(true);
  });

  it('never marks irregular publications stale', () => {
    // Years later, an irregular series still has no expected next date.
    const r = assessSource(irregular, at('2030-01-01'));
    expect(r.isStale).toBe(false);
    expect(r.nextExpected).toBeNull();
  });

  it('puts the grace boundary exactly where GRACE_DAYS says', () => {
    const justInside = assessSource(monthly, at('2026-08-15'));
    const justOutside = assessSource(monthly, at('2026-08-16'));
    expect(GRACE_DAYS).toBe(14);
    expect(justInside.isStale).toBe(false);
    expect(justOutside.isStale).toBe(true);
  });
});

describe('staleSources against the real registry', () => {
  it('reports nothing stale on the date the data was compiled', () => {
    expect(staleSources(SOURCES, at('2026-07-31'))).toHaveLength(0);
  });

  it('flags the price data once a year has passed', () => {
    const stale = staleSources(SOURCES, at('2027-07-31'));
    const ids = stale.map((s) => s.source.id);
    expect(ids).toContain('cotality-hvi');
    // Irregular sources stay out of it however long we wait.
    expect(ids).not.toContain('rba-cash-rate');
  });

  it('orders the most out-of-date source first', () => {
    const older: Source = { ...monthly, id: 'older', releaseISO: '2026-01-01' };
    const newer: Source = { ...monthly, id: 'newer', releaseISO: '2026-05-01' };
    const stale = staleSources([newer, older], at('2027-01-01'));

    expect(stale.map((s) => s.source.id)).toEqual(['older', 'newer']);
  });

  it('only the hand-transcribed price data can go stale in the real registry', () => {
    // Everything else is either auto-refreshed or has no publication cadence,
    // so Cotality is the single point of manual maintenance — by design.
    const stale = staleSources(SOURCES, at('2028-01-01'));
    expect(stale.map((s) => s.source.id)).toEqual(['cotality-hvi']);
  });
});

describe('auto-refreshed sources', () => {
  it('are never reported as stale, however old the publisher edition is', () => {
    // The pipeline keeps these current; judging them on publisher cadence would
    // fire a false alarm every time the ABS is a fortnight late.
    expect(staleSources([automated], at('2030-01-01'))).toHaveLength(0);
    // The same source, not automated, would be flagged.
    expect(staleSources([{ ...automated, autoRefreshed: false }], at('2030-01-01'))).toHaveLength(1);
  });

  it('leaves the manually transcribed price data covered', () => {
    const cotality = SOURCES.find((s) => s.id === 'cotality-hvi')!;
    expect(cotality.autoRefreshed).toBe(false);
  });
});

describe('assessPipeline', () => {
  it('is healthy right after a refresh', () => {
    const h = assessPipeline('2026-07-31', at('2026-08-05'));
    expect(h.hasStalled).toBe(false);
    expect(h.daysSinceRefresh).toBe(5);
  });

  it('flags a pipeline that has stopped running', () => {
    const h = assessPipeline('2026-07-31', at('2026-10-01'));
    expect(h.hasStalled).toBe(true);
  });

  it('puts the boundary exactly where PIPELINE_MAX_AGE_DAYS says', () => {
    expect(PIPELINE_MAX_AGE_DAYS).toBe(45);
    expect(assessPipeline('2026-07-31', at('2026-09-14')).hasStalled).toBe(false);
    expect(assessPipeline('2026-07-31', at('2026-09-15')).hasStalled).toBe(true);
  });

  it('reads a real timestamp from the generated data module', () => {
    expect(LAST_REFRESHED_ISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('describeAge', () => {
  it('uses days, then months, then years', () => {
    expect(describeAge(1)).toBe('1 day old');
    expect(describeAge(20)).toBe('20 days old');
    expect(describeAge(90)).toBe('3 months old');
    expect(describeAge(400)).toBe('13 months old');
    expect(describeAge(1000)).toBe('2.7 years old');
  });
});
