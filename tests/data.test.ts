import { describe, it, expect } from 'vitest';
import { CAPITAL_REGIONS, annualisedFromCumulative } from '../src/data/regions.capitals';
import { SOURCES, getSource } from '../src/data/sources';
import {
  ASSUMPTIONS,
  AWE_WEEKLY,
  DEFAULT_HOUSEHOLD_INCOME,
  HOUSEHOLD_SAVING_RATIO_PCT,
  defaultMonthlySavings,
} from '../src/data/assumptions';
import {
  AWE,
  CASH_RATE,
  SAVING_RATIO,
  ABS_MEAN_DWELLING_PRICES as GENERATED_ABS_PRICES,
} from '../src/data/generated';
import { ABS_MEAN_DWELLING_PRICES, ABS_CROSSCHECK_SOURCE_ID } from '../src/data/crosscheck.abs';
import { resolveGrowth } from '../src/data/index';
import { PROPERTY_TYPES } from '../src/data/types';

/**
 * The "no magic numbers" enforcement.
 *
 * The project's central constraint is that every figure on screen traces to a
 * cited source or a labelled user assumption. That constraint is only real if
 * something checks it, so this suite fails the build when a figure appears
 * without provenance.
 */

describe('citation integrity', () => {
  it('every region cites at least one source, and every cited source exists', () => {
    for (const region of CAPITAL_REGIONS) {
      expect(region.sourceIds.length, `${region.id} cites no source`).toBeGreaterThan(0);
      for (const id of region.sourceIds) {
        expect(getSource(id), `${region.id} cites unknown source "${id}"`).toBeDefined();
      }
    }
  });

  it('every assumption that claims a source has one that exists', () => {
    for (const assumption of ASSUMPTIONS) {
      if (assumption.sourceId) {
        expect(
          getSource(assumption.sourceId),
          `assumption ${assumption.id} cites unknown source "${assumption.sourceId}"`,
        ).toBeDefined();
      }
    }
  });

  it('every assumption explains where its default came from', () => {
    for (const assumption of ASSUMPTIONS) {
      expect(assumption.rationale.length, `${assumption.id} has no rationale`).toBeGreaterThan(40);
    }
  });

  it('every source carries a resolvable URL and a reference period', () => {
    for (const source of SOURCES) {
      expect(source.url, `${source.id} has no URL`).toMatch(/^https:\/\//);
      expect(source.referencePeriod.length).toBeGreaterThan(0);
      expect(source.releaseDate.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate source or region ids', () => {
    const sourceIds = SOURCES.map((s) => s.id);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    const regionIds = CAPITAL_REGIONS.map((r) => r.id);
    expect(new Set(regionIds).size).toBe(regionIds.length);
  });

  it('cross-check data is attributed and never overlaps the calculation source', () => {
    expect(getSource(ABS_CROSSCHECK_SOURCE_ID)).toBeDefined();
    expect(ABS_MEAN_DWELLING_PRICES.length).toBe(9);
  });
});

describe('auto-refreshed figures are actually wired through', () => {
  // Guards against someone "fixing" a stale-looking number by typing it into
  // assumptions.ts, which would silently disconnect it from the refresh
  // pipeline and leave it frozen forever.
  it('the savings-return default comes from the generated cash rate', () => {
    const assumption = ASSUMPTIONS.find((a) => a.id === 'savingsReturnPct')!;
    expect(assumption.defaultValue).toBe(CASH_RATE.valuePct);
  });

  it('the income default is derived from generated AWE', () => {
    expect(AWE_WEEKLY).toBe(AWE.weekly);
    expect(DEFAULT_HOUSEHOLD_INCOME).toBe(Math.round(AWE.weekly * 52));
  });

  it('the savings default is derived from the generated saving ratio', () => {
    expect(HOUSEHOLD_SAVING_RATIO_PCT).toBe(SAVING_RATIO.pct);
    expect(defaultMonthlySavings(120_000)).toBe(Math.round((120_000 * SAVING_RATIO.pct) / 100 / 12));
  });

  it('the cross-check table is the generated one', () => {
    expect(ABS_MEAN_DWELLING_PRICES).toEqual(GENERATED_ABS_PRICES);
  });

  it('marks exactly the sources the pipeline can reach as auto-refreshed', () => {
    const auto = SOURCES.filter((s) => s.autoRefreshed).map((s) => s.id).sort();
    expect(auto).toEqual([
      'abs-awe',
      'abs-national-accounts',
      'abs-total-value-dwellings',
      'rba-cash-rate',
    ]);
    // Cotality has no free API — if this ever flips, the claim in the README
    // and the refresh script's scope comment are both wrong.
    expect(SOURCES.find((s) => s.id === 'cotality-hvi')!.autoRefreshed).toBe(false);
  });
});

describe('derived growth rates', () => {
  it('every stored CAGR round-trips back to the published cumulative change', () => {
    for (const region of CAPITAL_REGIONS) {
      const { fiveYearChangePct, tenYearChangePct, fiveYearCagrPct, tenYearCagrPct } =
        region.growth;

      if (tenYearChangePct !== null) {
        expect(tenYearCagrPct).not.toBeNull();
        const roundTrip = (Math.pow(1 + tenYearCagrPct! / 100, 10) - 1) * 100;
        expect(roundTrip, `${region.id} 10yr CAGR does not round-trip`).toBeCloseTo(
          tenYearChangePct,
          6,
        );
      }

      if (fiveYearChangePct !== null) {
        expect(fiveYearCagrPct).not.toBeNull();
        const roundTrip = (Math.pow(1 + fiveYearCagrPct! / 100, 5) - 1) * 100;
        expect(roundTrip, `${region.id} 5yr CAGR does not round-trip`).toBeCloseTo(
          fiveYearChangePct,
          6,
        );
      }
    }
  });

  it('annualises a known case correctly', () => {
    // Doubling over 10 years is ~7.18% a year, not 10%.
    expect(annualisedFromCumulative(100, 10)).toBeCloseTo(7.1773, 3);
    expect(annualisedFromCumulative(0, 5)).toBeCloseTo(0, 10);
    expect(annualisedFromCumulative(-10, 5)).toBeLessThan(0);
  });

  it('rejects impossible inputs rather than returning NaN', () => {
    expect(() => annualisedFromCumulative(50, 0)).toThrow();
    expect(() => annualisedFromCumulative(-100, 10)).toThrow();
  });

  it('long-run figures are declared as a dwellings basis', () => {
    // Cotality publishes 5/10-year change for dwellings only. If this ever
    // changes, the UI disclosure needs to change with it.
    for (const region of CAPITAL_REGIONS) {
      expect(region.growth.basis).toBe('dwelling');
    }
  });
});

describe('transcription from the Cotality HVI (30 June 2026)', () => {
  // A second, independent statement of the published figures. If someone edits
  // regions.capitals.ts by hand, this catches the typo.
  const published: Record<string, { house: number; unit: number; dwelling: number; ten: number }> =
    {
      au: { house: 1_025_085, unit: 752_007, dwelling: 937_722, ten: 73.7 },
      sydney: { house: 1_556_258, unit: 898_623, dwelling: 1_265_608, ten: 54.1 },
      melbourne: { house: 948_482, unit: 637_170, dwelling: 808_486, ten: 32.2 },
      brisbane: { house: 1_225_350, unit: 885_132, dwelling: 1_118_306, ten: 119.0 },
      perth: { house: 1_093_431, unit: 773_605, dwelling: 1_046_551, ten: 109.4 },
      adelaide: { house: 1_008_736, unit: 695_151, dwelling: 945_868, ten: 111.4 },
      hobart: { house: 803_094, unit: 587_749, dwelling: 752_760, ten: 95.8 },
      canberra: { house: 1_035_828, unit: 597_430, dwelling: 885_254, ten: 62.8 },
      darwin: { house: 766_350, unit: 472_572, dwelling: 638_187, ten: 33.6 },
    };

  it('matches the published index tables exactly', () => {
    expect(CAPITAL_REGIONS.length).toBe(Object.keys(published).length);
    for (const region of CAPITAL_REGIONS) {
      const expected = published[region.id];
      expect(expected, `unexpected region "${region.id}"`).toBeDefined();
      expect(region.prices.house.median, `${region.id} house`).toBe(expected!.house);
      expect(region.prices.unit.median, `${region.id} unit`).toBe(expected!.unit);
      expect(region.prices.dwelling.median, `${region.id} dwelling`).toBe(expected!.dwelling);
      expect(region.growth.tenYearChangePct, `${region.id} 10yr`).toBe(expected!.ten);
    }
  });

  it('carries all three property types with sane values for every region', () => {
    for (const region of CAPITAL_REGIONS) {
      for (const type of PROPERTY_TYPES) {
        const series = region.prices[type];
        expect(series, `${region.id} missing ${type}`).toBeDefined();
        expect(series.median).toBeGreaterThan(0);
        // A 12-month change outside this band would mean a transcription error.
        expect(Math.abs(series.annualChangePct)).toBeLessThan(60);
      }
      // Houses are dearer than units in every Australian capital.
      expect(region.prices.house.median).toBeGreaterThan(region.prices.unit.median);
    }
  });

  it('models the eight capitals plus a national figure', () => {
    const capitals = CAPITAL_REGIONS.filter((r) => r.type === 'capital');
    const national = CAPITAL_REGIONS.filter((r) => r.type === 'national');
    expect(capitals.length).toBe(8);
    expect(national.length).toBe(1);
    for (const c of capitals) expect(c.parentId).toBe('au');
    expect(national[0]!.parentId).toBeNull();
  });
});

describe('resolveGrowth', () => {
  const sydney = CAPITAL_REGIONS.find((r) => r.id === 'sydney')!;

  it('returns a cited rate for every published basis', async () => {
    for (const basis of ['tenYear', 'fiveYear', 'twelveMonth'] as const) {
      const resolved = await resolveGrowth(sydney, basis, 'house', 0);
      expect(resolved.sourceId, `${basis} has no source`).not.toBeNull();
      expect(getSource(resolved.sourceId!)).toBeDefined();
      expect(resolved.provenance.length).toBeGreaterThan(0);
    }
  });

  it('flags the dwellings-basis mismatch when viewing houses or units', async () => {
    const house = await resolveGrowth(sydney, 'tenYear', 'house', 0);
    const dwelling = await resolveGrowth(sydney, 'tenYear', 'dwelling', 0);

    expect(house.basisMismatch).toBe(true);
    expect(dwelling.basisMismatch).toBe(false);
  });

  it('uses the type-specific figure for the 12-month basis, with no mismatch', async () => {
    const house = await resolveGrowth(sydney, 'twelveMonth', 'house', 0);
    const unit = await resolveGrowth(sydney, 'twelveMonth', 'unit', 0);

    expect(house.ratePct).toBe(sydney.prices.house.annualChangePct);
    expect(unit.ratePct).toBe(sydney.prices.unit.annualChangePct);
    expect(house.basisMismatch).toBe(false);
  });

  it('passes a custom rate through uncited, and says so', async () => {
    const custom = await resolveGrowth(sydney, 'custom', 'house', 6.5);
    expect(custom.ratePct).toBe(6.5);
    expect(custom.sourceId).toBeNull();
  });

  it('produces the expected Sydney 10-year rate', async () => {
    // 54.1% over 10 years, annualised.
    const resolved = await resolveGrowth(sydney, 'tenYear', 'dwelling', 0);
    expect(resolved.ratePct).toBeCloseTo(4.419, 2);
  });
});
