import { describe, it, expect } from 'vitest';
import {
  projectTrajectory,
  MAX_PROJECTION_YEARS,
  DIVERGENT_CHART_YEARS,
} from '../src/lib/projection';
import { calculateTreadmill, type TreadmillInputs } from '../src/lib/treadmill';

const base: TreadmillInputs = {
  medianPrice: 1_000_000,
  growthRatePct: 10,
  depositPct: 20,
  currentSavings: 0,
  monthlySavings: 1_000,
  savingsReturnPct: 0,
};

describe('projectTrajectory', () => {
  it('finds the crossing when savings outpace the target', () => {
    // Flat prices: target is a constant $100,000.
    // $2,000/month with no interest reaches it at exactly month 50.
    const r = projectTrajectory({
      ...base,
      medianPrice: 500_000,
      growthRatePct: 0,
      monthlySavings: 2_000,
    });

    expect(r.outcome.kind).toBe('reached');
    if (r.outcome.kind !== 'reached') throw new Error('unreachable');
    expect(r.outcome.month).toBe(50);
    expect(r.outcome.depositTargetAtReach).toBeCloseTo(100_000, 6);
    expect(r.outcome.priceAtReach).toBeCloseTo(500_000, 6);
  });

  it('reports the moved goalpost, not the original one', () => {
    // The point of the product: the target they eventually hit is not the
    // target they started aiming at.
    const r = projectTrajectory({
      ...base,
      medianPrice: 800_000,
      growthRatePct: 5,
      monthlySavings: 4_000,
      currentSavings: 50_000,
    });

    expect(r.outcome.kind).toBe('reached');
    if (r.outcome.kind !== 'reached') throw new Error('unreachable');

    const targetAtStart = 800_000 * 0.2;
    expect(r.outcome.depositTargetAtReach).toBeGreaterThan(targetAtStart);
    expect(r.outcome.priceAtReach).toBeGreaterThan(800_000);
  });

  it('returns neverConverges rather than pretending, when the lines diverge', () => {
    // $100/month against a target compounding at 10% a year is hopeless.
    const r = projectTrajectory({ ...base, monthlySavings: 100 });

    expect(r.outcome.kind).toBe('neverConverges');
    if (r.outcome.kind !== 'neverConverges') throw new Error('unreachable');
    expect(r.outcome.horizonYears).toBe(MAX_PROJECTION_YEARS);
    // The gap should be much wider at the horizon than it is today.
    expect(r.outcome.shortfallAtHorizon).toBeGreaterThan(r.outcome.shortfallNow);
    expect(r.chartYears).toBe(DIVERGENT_CHART_YEARS);
  });

  it('treats someone who already has the deposit as reached at month 0', () => {
    const r = projectTrajectory({ ...base, currentSavings: 250_000 });

    expect(r.outcome.kind).toBe('reached');
    if (r.outcome.kind !== 'reached') throw new Error('unreachable');
    expect(r.outcome.month).toBe(0);
    expect(r.outcome.years).toBe(0);
  });

  it('converges quickly when prices are falling', () => {
    const falling = projectTrajectory({
      ...base,
      growthRatePct: -5,
      monthlySavings: 3_000,
    });
    const rising = projectTrajectory({
      ...base,
      growthRatePct: 5,
      monthlySavings: 3_000,
    });

    expect(falling.outcome.kind).toBe('reached');
    expect(rising.outcome.kind).toBe('reached');
    if (falling.outcome.kind !== 'reached' || rising.outcome.kind !== 'reached') {
      throw new Error('unreachable');
    }
    expect(falling.outcome.month).toBeLessThan(rising.outcome.month);
  });

  it('starts the chart at today’s real values', () => {
    const r = projectTrajectory({ ...base, currentSavings: 25_000 });
    const first = r.points[0];
    expect(first).toBeDefined();
    expect(first!.month).toBe(0);
    expect(first!.savings).toBe(25_000);
    expect(first!.depositTarget).toBe(200_000);
    expect(first!.shortfall).toBe(175_000);
  });
});

describe('hero number and chart agree', () => {
  // If these two ever diverge, the user sees a headline that contradicts the
  // line directly beneath it. This test is the guard.
  it('year-one ground gained matches twelve months of the projected line', () => {
    const inputs: TreadmillInputs = {
      ...base,
      currentSavings: 60_000,
      monthlySavings: 1_500,
      savingsReturnPct: 4.35,
    };

    const hero = calculateTreadmill(inputs);
    const chart = projectTrajectory(inputs);

    const month0 = chart.points[0]!;
    const month12 = chart.points[12]!;

    expect(hero.groundGained).toBeCloseTo(month12.savings - month0.savings, 6);
    expect(hero.targetRise).toBeCloseTo(month12.depositTarget - month0.depositTarget, 6);
    expect(hero.savingsNextYear).toBeCloseTo(month12.savings, 6);
    expect(hero.depositTargetNow).toBeCloseTo(month0.depositTarget, 6);
  });
});
