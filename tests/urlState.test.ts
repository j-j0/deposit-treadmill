import { describe, it, expect } from 'vitest';
import {
  decodeState,
  encodeState,
  isAppStateHash,
  TAB_IDS,
  type AppState,
} from '../src/lib/urlState';

const defaults: AppState = {
  tab: 'deposit',
  regionId: 'sydney',
  propertyType: 'house',
  income: 106_657,
  currentSavings: 50_000,
  monthlySavings: 551,
  growthBasis: 'tenYear',
  customGrowthPct: 5,
  depositPct: 20,
  savingsReturnPct: 4.35,
  mortgageRatePct: 6.2,
  loanTermYears: 30,
  extraRepaymentMonthly: 0,
  repaymentSharePct: 30,
  upfrontCostsPct: 5.5,
  lmiCost: 0,
  rentalIncomeWeekly: 0,
  rentWeekly: null,
  rentGrowthPct: 5.9,
  ownershipCostsPct: null,
  horizonYears: 30,
};

describe('encode/decode round trip', () => {
  it('preserves every field, including the open tab', () => {
    const state: AppState = {
      ...defaults,
      tab: 'rentvsbuy',
      regionId: 'perth',
      propertyType: 'townhouse',
      income: 180_000,
      rentWeekly: 720,
      ownershipCostsPct: 1.8,
      extraRepaymentMonthly: 400,
      lmiCost: 12_500,
      horizonYears: 15,
    };
    expect(decodeState(encodeState(state), defaults)).toEqual(state);
  });

  it('round-trips every tab id', () => {
    for (const tab of TAB_IDS) {
      const decoded = decodeState(encodeState({ ...defaults, tab }), defaults);
      expect(decoded.tab).toBe(tab);
    }
  });

  it('rejects an unknown tab rather than rendering nothing', () => {
    const decoded = decodeState('tab=nonsense&r=sydney', defaults);
    expect(decoded.tab).toBe(defaults.tab);
  });

  it('keeps auto-derived fields null when the user has not overridden them', () => {
    const encoded = encodeState(defaults);
    expect(encoded).not.toContain('rw=');
    expect(encoded).not.toContain('oc=');
    expect(decodeState(encoded, defaults).rentWeekly).toBeNull();
    expect(decodeState(encoded, defaults).ownershipCostsPct).toBeNull();
  });
});

describe('backwards compatibility with v1 links', () => {
  it('decodes a v1 link — no v2 keys at all — into a complete working state', () => {
    const v1 = '#r=melbourne&t=dwelling&i=120000&s=40000&m=1200&b=twelveMonth&g=5.00&d=20.00&y=4.35';
    const decoded = decodeState(v1, defaults);

    expect(decoded.regionId).toBe('melbourne');
    expect(decoded.income).toBe(120_000);
    // Everything v1 never knew about falls back to a usable default.
    expect(decoded.tab).toBe('deposit');
    expect(decoded.mortgageRatePct).toBe(6.2);
    expect(decoded.horizonYears).toBe(30);
    expect(decoded.rentWeekly).toBeNull();
  });
});

describe('isAppStateHash', () => {
  // Regression guard. Citations used to be anchors (`href="#source-x"`), which
  // overwrote the state hash; the hashchange listener then read it back as an
  // empty state and silently reset every field the reader had entered.
  it('rejects a bare anchor hash so it cannot wipe the form', () => {
    expect(isAppStateHash('#source-cotality-hvi')).toBe(false);
    expect(isAppStateHash('#sources')).toBe(false);
    expect(isAppStateHash('')).toBe(false);
    expect(isAppStateHash('#')).toBe(false);
  });

  it('accepts a real state hash', () => {
    expect(isAppStateHash(encodeState(defaults))).toBe(true);
    expect(isAppStateHash('#r=sydney&t=house')).toBe(true);
  });

  it('a foreign hash would otherwise have reset everything', () => {
    // Documents precisely what the guard prevents: decoding it yields defaults.
    const wiped = decodeState('#source-cotality-hvi', defaults);
    expect(wiped).toEqual(defaults);
    expect(isAppStateHash('#source-cotality-hvi')).toBe(false);
  });
});
