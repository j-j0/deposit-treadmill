import { depositTargetAtMonth, stepSavings, type TreadmillInputs } from './treadmill';

/**
 * Month-by-month projection of the savings balance against the moving deposit
 * target, and the question the chart exists to answer: do the two lines
 * converge, or diverge?
 *
 * The divergent case is a real outcome, not an error. When someone's savings
 * rate cannot outrun their city's price growth, "these lines never meet" is the
 * most informative thing the tool can say, and it gets rendered as a designed
 * result rather than an empty chart.
 */

/** Simulation ceiling. Beyond this, "never" is the honest answer. */
export const MAX_PROJECTION_YEARS = 50;

/** Default window for the chart when the lines never converge. */
export const DIVERGENT_CHART_YEARS = 30;

export interface ProjectionPoint {
  month: number;
  year: number;
  savings: number;
  depositTarget: number;
  /** depositTarget − savings. Positive means still short. */
  shortfall: number;
}

export interface ReachedOutcome {
  kind: 'reached';
  /** Month index at which savings first meet the target. 0 = already there. */
  month: number;
  years: number;
  /** The deposit target at that moment — the moved goalpost. */
  depositTargetAtReach: number;
  /** The median price at that moment. */
  priceAtReach: number;
  savingsAtReach: number;
}

export interface DivergentOutcome {
  kind: 'neverConverges';
  /** How far behind they are at the simulation ceiling. */
  shortfallAtHorizon: number;
  horizonYears: number;
  /** Shortfall today, for comparison against the horizon figure. */
  shortfallNow: number;
}

export type ProjectionOutcome = ReachedOutcome | DivergentOutcome;

export interface ProjectionResult {
  points: ProjectionPoint[];
  outcome: ProjectionOutcome;
  /** Years covered by `points` — the sensible chart window. */
  chartYears: number;
}

/**
 * Run the projection.
 *
 * Returns one point per month up to whichever comes first: convergence (plus a
 * short tail so the crossing is visible rather than sitting on the chart edge),
 * or the divergent chart window.
 */
export function projectTrajectory(inputs: TreadmillInputs): ProjectionResult {
  const {
    medianPrice,
    growthRatePct,
    depositPct,
    currentSavings,
    monthlySavings,
    savingsReturnPct,
  } = inputs;

  const maxMonths = MAX_PROJECTION_YEARS * 12;

  const targetAt = (month: number) =>
    depositTargetAtMonth(medianPrice, growthRatePct, depositPct, month);

  // Find the crossing first, so we know how wide the chart should be.
  let balance = currentSavings;
  let reachedMonth: number | null = null;

  if (balance >= targetAt(0)) {
    reachedMonth = 0;
  } else {
    for (let month = 1; month <= maxMonths; month++) {
      balance = stepSavings(balance, monthlySavings, savingsReturnPct);
      if (balance >= targetAt(month)) {
        reachedMonth = month;
        break;
      }
    }
  }

  // Chart window: a little past the crossing so it reads as a crossing, or the
  // fixed divergent window when there isn't one.
  const chartMonths =
    reachedMonth === null
      ? DIVERGENT_CHART_YEARS * 12
      : Math.min(maxMonths, Math.max(24, Math.ceil(reachedMonth * 1.25)));

  const points: ProjectionPoint[] = [];
  let running = currentSavings;
  for (let month = 0; month <= chartMonths; month++) {
    if (month > 0) {
      running = stepSavings(running, monthlySavings, savingsReturnPct);
    }
    const depositTarget = targetAt(month);
    points.push({
      month,
      year: month / 12,
      savings: running,
      depositTarget,
      shortfall: depositTarget - running,
    });
  }

  let outcome: ProjectionOutcome;
  if (reachedMonth === null) {
    const horizonSavings = savingsAtMonth(inputs, maxMonths);
    outcome = {
      kind: 'neverConverges',
      shortfallAtHorizon: targetAt(maxMonths) - horizonSavings,
      horizonYears: MAX_PROJECTION_YEARS,
      shortfallNow: targetAt(0) - currentSavings,
    };
  } else {
    const savingsAtReach = savingsAtMonth(inputs, reachedMonth);
    outcome = {
      kind: 'reached',
      month: reachedMonth,
      years: reachedMonth / 12,
      depositTargetAtReach: targetAt(reachedMonth),
      priceAtReach: medianPrice * Math.pow(1 + growthRatePct / 100, reachedMonth / 12),
      savingsAtReach,
    };
  }

  return { points, outcome, chartYears: chartMonths / 12 };
}

function savingsAtMonth(inputs: TreadmillInputs, month: number): number {
  let balance = inputs.currentSavings;
  for (let m = 0; m < month; m++) {
    balance = stepSavings(balance, inputs.monthlySavings, inputs.savingsReturnPct);
  }
  return balance;
}
