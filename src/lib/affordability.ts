import { monthlyPayment } from './mortgage';

/**
 * "What can you afford?" — estimated the way a lender would test it, not the
 * way a marketing calculator would flatter it.
 *
 * APRA requires banks to assess serviceability at the loan rate PLUS a buffer
 * (3.0 percentage points, reaffirmed June 2026). So the maximum loan is the
 * one whose repayment at (rate + buffer) fits the budget — even though the
 * borrower would actually pay the unbuffered rate.
 *
 * The budget itself (a share of gross income) is a labelled convention the
 * user can change; real lenders assess declared expenses instead.
 */

export interface AffordabilityInputs {
  /** Gross household income, AUD per year. */
  annualIncome: number;
  /** Share of gross income available for repayments, percent (e.g. 30). */
  repaymentSharePct: number;
  /** The rate the borrower would actually pay, percent. */
  mortgageRatePct: number;
  /** APRA serviceability buffer, percentage points (e.g. 3.0). */
  bufferPp: number;
  termYears: number;
  /** Cash available at purchase, AUD. */
  savings: number;
  /** Deposit fraction of price, percent (e.g. 20). */
  depositPct: number;
  /** Upfront transaction costs as percent of price (e.g. 5.5). */
  upfrontCostsPct: number;
  /**
   * Rental income the lender will actually count, AUD per year, already
   * shaded for vacancy and costs.
   *
   * Zero for an owner-occupier even when they plan to let a room: lenders
   * assess rent evidenced by a lease on a tenanted property. Informal board
   * from a housemate does not enter serviceability, however much it helps the
   * borrower in practice. The caller enforces that distinction.
   */
  assessedRentalIncomeAnnual: number;
}

export type AffordabilityConstraint = 'deposit' | 'serviceability';

export interface AffordabilityResult {
  /** The rate serviceability is tested at: mortgage rate + buffer. */
  assessmentRatePct: number;
  /** Monthly repayment budget: the income share plus any assessed rent. */
  monthlyBudget: number;
  /** The salary component of that budget. */
  monthlyBudgetFromIncome: number;
  /** The rental component — zero unless this is an investment purchase. */
  monthlyBudgetFromRent: number;
  /** Largest loan whose ASSESSED repayment fits the budget. */
  maxLoanByServiceability: number;
  /**
   * Largest price the savings can open the door on: savings must cover
   * deposit% of price plus upfront% of price.
   */
  maxPriceByDeposit: number;
  /** Largest price serviceability allows: max loan + the deposit on that price. */
  maxPriceByServiceability: number;
  /** min of the two — the binding number. */
  maxPrice: number;
  whichConstraint: AffordabilityConstraint;
  /** What the ACTUAL repayment (unbuffered rate) would be at maxPrice. */
  actualPaymentAtMax: number;
}

/** Inverse annuity: the principal whose payment equals `payment`. */
export function principalFromPayment(
  payment: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (payment <= 0) return 0;
  const n = Math.round(termYears * 12);
  const r = annualRatePct / 100 / 12;
  if (r === 0) return payment * n;
  return (payment * (1 - Math.pow(1 + r, -n))) / r;
}

export function calculateAffordability(inputs: AffordabilityInputs): AffordabilityResult {
  const {
    annualIncome,
    repaymentSharePct,
    mortgageRatePct,
    bufferPp,
    termYears,
    savings,
    depositPct,
    upfrontCostsPct,
    assessedRentalIncomeAnnual,
  } = inputs;

  const assessmentRatePct = mortgageRatePct + bufferPp;

  // Salary contributes only the chosen share, because the rest funds living
  // costs. Shaded rent contributes in full — the shading is what accounts for
  // vacancy and running costs, so discounting it twice would understate it.
  const monthlyBudgetFromIncome = (annualIncome * (repaymentSharePct / 100)) / 12;
  const monthlyBudgetFromRent = Math.max(0, assessedRentalIncomeAnnual) / 12;
  const monthlyBudget = monthlyBudgetFromIncome + monthlyBudgetFromRent;

  const maxLoanByServiceability = principalFromPayment(
    monthlyBudget,
    assessmentRatePct,
    termYears,
  );

  // Deposit constraint: savings = price × (deposit% + upfront%).
  const depositFraction = depositPct / 100 + upfrontCostsPct / 100;
  const maxPriceByDeposit = depositFraction > 0 ? savings / depositFraction : Infinity;

  // Serviceability constraint: price = loan + deposit part.
  // loan = price × (1 − deposit%), so price = loan / (1 − deposit%).
  const loanFraction = 1 - depositPct / 100;
  const maxPriceByServiceability =
    loanFraction > 0 ? maxLoanByServiceability / loanFraction : Infinity;

  const maxPrice = Math.min(maxPriceByDeposit, maxPriceByServiceability);
  const whichConstraint: AffordabilityConstraint =
    maxPriceByDeposit <= maxPriceByServiceability ? 'deposit' : 'serviceability';

  const loanAtMax = Math.max(0, maxPrice * loanFraction);
  const actualPaymentAtMax = monthlyPayment(loanAtMax, mortgageRatePct, termYears);

  return {
    assessmentRatePct,
    monthlyBudget,
    monthlyBudgetFromIncome,
    monthlyBudgetFromRent,
    maxLoanByServiceability,
    maxPriceByDeposit,
    maxPriceByServiceability,
    maxPrice,
    whichConstraint,
    actualPaymentAtMax,
  };
}
