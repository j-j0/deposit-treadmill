/**
 * The treadmill calculation.
 *
 * The product is one signed number: over the next year, does the saver close
 * the distance to a 20% deposit, or does the deposit move away faster than they
 * move toward it?
 *
 *   ground gained  = the increase in their savings balance over 12 months
 *   target rise    = the increase in the deposit target over the same 12 months
 *   treadmill      = ground gained − target rise      (negative = lost ground)
 *
 * Pure functions, no React, no formatting. Every input is supplied by the
 * caller — there are no constants in this file, because every number the model
 * needs is either published data or a user-editable assumption.
 */

export interface TreadmillInputs {
  /** Median price for the selected region and property type, AUD. */
  medianPrice: number;
  /** Assumed annual price growth, as a percentage (e.g. 4.42). */
  growthRatePct: number;
  /** Deposit target as a percentage of price (e.g. 20). */
  depositPct: number;
  /** What they have saved today, AUD. */
  currentSavings: number;
  /** What they add each month, AUD. */
  monthlySavings: number;
  /** Assumed annual return on the savings balance, as a percentage. */
  savingsReturnPct: number;
}

export type TreadmillDirection = 'gaining' | 'losing' | 'level';

export interface TreadmillResult {
  /** 20% (or chosen %) of today's median price. */
  depositTargetNow: number;
  /** The same target one year from now. */
  depositTargetNextYear: number;
  /** How much the target moves in a year, entirely independent of the saver. */
  targetRise: number;
  /** Cash they add over the year. */
  contributions: number;
  /** Interest earned on the balance over the year. */
  interestEarned: number;
  /** Total increase in their savings balance: contributions + interest. */
  groundGained: number;
  /** groundGained − targetRise. THE number. Negative means lost ground. */
  netGround: number;
  direction: TreadmillDirection;
  /** Savings balance after one year. */
  savingsNextYear: number;
}

/** One month of savings growth: interest on the balance, then the contribution. */
export function stepSavings(
  balance: number,
  monthlyContribution: number,
  annualReturnPct: number,
): number {
  const monthlyRate = annualReturnPct / 100 / 12;
  return balance * (1 + monthlyRate) + monthlyContribution;
}

/**
 * The deposit target at month `t`, compounding the annual growth rate smoothly.
 * `t = 0` returns today's target.
 */
export function depositTargetAtMonth(
  medianPrice: number,
  growthRatePct: number,
  depositPct: number,
  month: number,
): number {
  const priceAtMonth = medianPrice * Math.pow(1 + growthRatePct / 100, month / 12);
  return priceAtMonth * (depositPct / 100);
}

/**
 * Savings balance after `months`, by the same month-by-month recursion the
 * projection chart uses. Deliberately iterative rather than a closed-form
 * annuity formula: the closed form needs a special case at r = 0, and any
 * divergence between this and the chart would show up as the hero number
 * disagreeing with the line the user is looking at.
 */
export function savingsAfterMonths(
  currentSavings: number,
  monthlySavings: number,
  savingsReturnPct: number,
  months: number,
): number {
  let balance = currentSavings;
  for (let m = 0; m < months; m++) {
    balance = stepSavings(balance, monthlySavings, savingsReturnPct);
  }
  return balance;
}

export function calculateTreadmill(inputs: TreadmillInputs): TreadmillResult {
  const {
    medianPrice,
    growthRatePct,
    depositPct,
    currentSavings,
    monthlySavings,
    savingsReturnPct,
  } = inputs;

  const depositTargetNow = depositTargetAtMonth(medianPrice, growthRatePct, depositPct, 0);
  const depositTargetNextYear = depositTargetAtMonth(
    medianPrice,
    growthRatePct,
    depositPct,
    12,
  );
  const targetRise = depositTargetNextYear - depositTargetNow;

  const savingsNextYear = savingsAfterMonths(
    currentSavings,
    monthlySavings,
    savingsReturnPct,
    12,
  );
  const groundGained = savingsNextYear - currentSavings;
  const contributions = monthlySavings * 12;
  const interestEarned = groundGained - contributions;

  const netGround = groundGained - targetRise;

  // Sub-dollar differences are noise, not a direction.
  let direction: TreadmillDirection = 'level';
  if (netGround > 0.5) direction = 'gaining';
  else if (netGround < -0.5) direction = 'losing';

  return {
    depositTargetNow,
    depositTargetNextYear,
    targetRise,
    contributions,
    interestEarned,
    groundGained,
    netGround,
    direction,
    savingsNextYear,
  };
}
