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
   * Lenders mortgage insurance, AUD. Modelled as capitalised into the loan —
   * the usual arrangement, and consistent with the mortgage and rent-vs-buy
   * models — so it consumes serviceability rather than savings.
   *
   * This matters most exactly where it is easiest to forget: dropping the
   * deposit below 20% raises the price your savings can reach, and LMI is the
   * cost attached to doing so. Leaving it out makes a small deposit look
   * strictly better than it is.
   */
  lmiCost: number;
  /**
   * Maximum loan-to-value ratio a lender will write, percent, INCLUSIVE of
   * capitalised LMI. Commonly 95%.
   *
   * Without this the model happily capitalises LMI on top of a 90% loan and
   * reports a ceiling implying a 103% LVR — a loan nobody writes. The cap is
   * what makes a small deposit cost something rather than being free money.
   */
  maxLvrPct: number;
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

export type AffordabilityConstraint = 'deposit' | 'serviceability' | 'lvr';

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
  /** The part of that loan left for the property once LMI is capitalised. */
  maxLoanForPropertyValue: number;
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
  /**
   * Smallest price at which capitalised LMI still fits inside the LVR cap.
   * Fixed-dollar LMI is a heavier LVR burden on a cheap property, so this is a
   * floor, not a ceiling.
   */
  minPriceForLvr: number;
  /** False when the LVR floor sits above every ceiling — no loan is available. */
  isFeasible: boolean;
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
    lmiCost,
    maxLvrPct,
  } = inputs;

  const lmi = Math.max(0, lmiCost);

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
  // loan = price × (1 − deposit%) + LMI, so price = (maxLoan − LMI) / (1 − deposit%).
  // Capitalised LMI eats borrowing capacity before any of it reaches the
  // property, which is why a sub-20% deposit does not buy as much as the
  // deposit arithmetic alone suggests.
  const loanFraction = 1 - depositPct / 100;
  const maxLoanForPropertyValue = Math.max(0, maxLoanByServiceability - lmi);
  const maxPriceByServiceability =
    loanFraction > 0 ? maxLoanForPropertyValue / loanFraction : Infinity;

  // LVR cap: price×L + LMI ≤ (maxLvr/100)×price, so price ≥ LMI / (V − L).
  // A fixed-dollar premium is a heavier LVR burden the cheaper the property,
  // which is why this comes out as a floor rather than a ceiling.
  const lvrFraction = maxLvrPct / 100;
  const lvrHeadroom = lvrFraction - loanFraction;
  let minPriceForLvr = 0;
  if (lmi > 0) {
    minPriceForLvr = lvrHeadroom > 0 ? lmi / lvrHeadroom : Infinity;
  } else if (loanFraction > lvrFraction) {
    // Even with no LMI, the bare loan already exceeds what a lender will write.
    minPriceForLvr = Infinity;
  }

  const ceiling = Math.min(maxPriceByDeposit, maxPriceByServiceability);
  const isFeasible = minPriceForLvr <= ceiling;
  const maxPrice = isFeasible ? ceiling : 0;

  const whichConstraint: AffordabilityConstraint = !isFeasible
    ? 'lvr'
    : maxPriceByDeposit <= maxPriceByServiceability
      ? 'deposit'
      : 'serviceability';

  const loanAtMax = Math.max(0, maxPrice * loanFraction + (maxPrice > 0 ? lmi : 0));
  const actualPaymentAtMax = monthlyPayment(loanAtMax, mortgageRatePct, termYears);

  return {
    assessmentRatePct,
    monthlyBudget,
    monthlyBudgetFromIncome,
    monthlyBudgetFromRent,
    maxLoanByServiceability,
    maxLoanForPropertyValue,
    maxPriceByDeposit,
    maxPriceByServiceability,
    maxPrice,
    whichConstraint,
    minPriceForLvr,
    isFeasible,
    actualPaymentAtMax,
  };
}
