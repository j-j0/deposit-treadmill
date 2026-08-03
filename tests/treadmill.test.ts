import { describe, it, expect } from 'vitest';
import {
  calculateTreadmill,
  depositTargetAtMonth,
  savingsAfterMonths,
  type TreadmillInputs,
} from '../src/lib/treadmill';

/**
 * Cases are built on round numbers so the expected values can be verified by
 * hand from the comments, rather than being whatever the implementation
 * happened to produce on the day.
 */

const base: TreadmillInputs = {
  medianPrice: 1_000_000,
  growthRatePct: 10,
  depositPct: 20,
  currentSavings: 0,
  monthlySavings: 1_000,
  savingsReturnPct: 0,
};

describe('calculateTreadmill', () => {
  it('reports lost ground when the target outruns the saver', () => {
    // Target now: 20% of $1,000,000 = $200,000
    // Price in a year: $1,100,000 -> target $220,000, so it rises $20,000
    // They add $1,000 x 12 = $12,000 and earn no interest
    // Net: 12,000 - 20,000 = -8,000
    const r = calculateTreadmill(base);

    expect(r.depositTargetNow).toBe(200_000);
    expect(r.depositTargetNextYear).toBeCloseTo(220_000, 6);
    expect(r.targetRise).toBeCloseTo(20_000, 6);
    expect(r.contributions).toBe(12_000);
    expect(r.interestEarned).toBeCloseTo(0, 6);
    expect(r.groundGained).toBeCloseTo(12_000, 6);
    expect(r.netGround).toBeCloseTo(-8_000, 6);
    expect(r.direction).toBe('losing');
  });

  it('reports gained ground when prices fall (Melbourne-style conditions)', () => {
    // A falling market is a real, current condition, not a theoretical one.
    // Price -5%: target goes 200,000 -> 190,000, a rise of -10,000.
    // Net: 12,000 - (-10,000) = +22,000
    const r = calculateTreadmill({ ...base, growthRatePct: -5 });

    expect(r.targetRise).toBeCloseTo(-10_000, 6);
    expect(r.netGround).toBeCloseTo(22_000, 6);
    expect(r.direction).toBe('gaining');
  });

  it('reports level ground when savings exactly match the drift', () => {
    // Target rise at 1.2% growth = 1,000,000 * 0.012 * 0.20 = $2,400
    // Match it exactly with $200/month and no interest.
    const r = calculateTreadmill({
      ...base,
      growthRatePct: 1.2,
      monthlySavings: 200,
    });

    expect(r.targetRise).toBeCloseTo(2_400, 6);
    expect(r.netGround).toBeCloseTo(0, 6);
    expect(r.direction).toBe('level');
  });

  it('compounds interest on the existing balance monthly', () => {
    // $100,000 at 12% p.a. compounded monthly = 100,000 * 1.01^12
    const r = calculateTreadmill({
      ...base,
      currentSavings: 100_000,
      monthlySavings: 0,
      savingsReturnPct: 12,
    });

    const expected = 100_000 * Math.pow(1.01, 12);
    expect(r.savingsNextYear).toBeCloseTo(expected, 6);
    expect(r.interestEarned).toBeCloseTo(expected - 100_000, 6);
    expect(r.contributions).toBe(0);
  });

  it('handles zero growth: the target stands still', () => {
    const r = calculateTreadmill({ ...base, growthRatePct: 0 });
    expect(r.targetRise).toBeCloseTo(0, 6);
    expect(r.netGround).toBeCloseTo(12_000, 6);
    expect(r.direction).toBe('gaining');
  });

  it('handles a saver contributing nothing', () => {
    const r = calculateTreadmill({ ...base, monthlySavings: 0 });
    expect(r.groundGained).toBeCloseTo(0, 6);
    expect(r.netGround).toBeCloseTo(-20_000, 6);
    expect(r.direction).toBe('losing');
  });

  it('scales the target with the deposit percentage', () => {
    const twenty = calculateTreadmill(base);
    const ten = calculateTreadmill({ ...base, depositPct: 10 });
    expect(ten.depositTargetNow).toBe(100_000);
    expect(ten.targetRise).toBeCloseTo(twenty.targetRise / 2, 6);
  });
});

describe('depositTargetAtMonth', () => {
  it('returns today’s target at month 0', () => {
    expect(depositTargetAtMonth(1_000_000, 10, 20, 0)).toBe(200_000);
  });

  it('compounds smoothly across the year', () => {
    const half = depositTargetAtMonth(1_000_000, 10, 20, 6);
    // Half a year of 10% growth is sqrt(1.1), not half of 10%.
    expect(half).toBeCloseTo(200_000 * Math.sqrt(1.1), 6);
  });
});

describe('savingsAfterMonths', () => {
  it('is a plain sum when the return is zero', () => {
    expect(savingsAfterMonths(0, 500, 0, 24)).toBeCloseTo(12_000, 6);
  });

  it('applies interest before the contribution each month', () => {
    // Month 1: 1000 * 1.01 + 100 = 1110
    expect(savingsAfterMonths(1_000, 100, 12, 1)).toBeCloseTo(1_110, 6);
  });
});
