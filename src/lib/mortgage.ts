/**
 * Mortgage amortisation.
 *
 * Pure functions, no React, no constants — every rate, term and dollar comes
 * from the caller, because every one of them is either published data or a
 * labelled user assumption. Same discipline as treadmill.ts.
 *
 * Convention throughout: monthly compounding at annualRatePct/12, interest
 * charged on the opening balance, then payments applied. This matches how
 * Australian variable-rate mortgages actually accrue (daily in practice, but
 * monthly is the standard modelling convention and the error is small).
 */

export interface MortgageInputs {
  /** Amount borrowed, AUD. */
  principal: number;
  /** Annual interest rate, percent (e.g. 6.2). */
  annualRatePct: number;
  /** Contracted term in years. */
  termYears: number;
  /** Voluntary extra paid each month on top of the required payment. */
  extraMonthly?: number;
  /**
   * Income applied to the loan each month (e.g. rent from a spare room).
   * Modelled identically to an extra repayment: it reduces principal after the
   * required payment. Kept as a separate input so the UI can report its effect
   * separately.
   */
  offsetIncomeMonthly?: number;
}

export interface MortgageResult {
  /** Required monthly payment under the contracted term (closed form). */
  requiredPayment: number;
  /** Months until the balance reaches zero with extras/income applied. */
  payoffMonths: number;
  payoffYears: number;
  /** Interest actually paid over the life of the loan, with extras applied. */
  totalInterest: number;
  /** Total of all payments made (principal + interest − nothing else). */
  totalPaid: number;
  /** Interest that would be paid with NO extras and NO offset income. */
  baselineInterest: number;
  /** baselineInterest − totalInterest. ≥ 0. */
  interestSaved: number;
  /** Months cut off the contracted term by extras/income. ≥ 0. */
  monthsSaved: number;
  /** Balance at each month, for charting. Index 0 = at settlement. */
  balances: number[];
}

/**
 * Standard annuity payment: P·r / (1 − (1+r)^−n) with r the monthly rate.
 * Zero-rate degenerates to straight division.
 */
export function monthlyPayment(
  principal: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (principal <= 0) return 0;
  const n = Math.round(termYears * 12);
  if (n <= 0) throw new Error('termYears must be positive');
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Ceiling on simulated months, safely beyond any real mortgage. */
const MAX_MONTHS = 100 * 12;

/**
 * One month of a loan: charge interest on the opening balance, then apply the
 * payment — clipped so the final payment only clears what is owed.
 *
 * Exported because the rent-vs-buy comparison steps the same loan; sharing the
 * step function means the two simulations cannot drift apart.
 */
export function stepBalance(
  balance: number,
  monthlyRate: number,
  payment: number,
): { balance: number; interest: number; paid: number } {
  if (balance <= 0) return { balance: 0, interest: 0, paid: 0 };
  const interest = balance * monthlyRate;
  const owing = balance + interest;
  const paid = Math.min(payment, owing);
  return { balance: owing - paid, interest, paid };
}

function simulate(
  principal: number,
  annualRatePct: number,
  requiredPayment: number,
  extraPerMonth: number,
): { months: number; interest: number; paid: number; balances: number[] } {
  const r = annualRatePct / 100 / 12;
  let balance = principal;
  let interest = 0;
  let paid = 0;
  const balances = [balance];

  let month = 0;
  while (balance > 0 && month < MAX_MONTHS) {
    month++;
    const stepped = stepBalance(balance, r, requiredPayment + extraPerMonth);
    balance = stepped.balance;
    interest += stepped.interest;
    paid += stepped.paid;
    balances.push(balance);
  }

  return { months: month, interest, paid, balances };
}

export function simulateMortgage(inputs: MortgageInputs): MortgageResult {
  const { principal, annualRatePct, termYears } = inputs;
  const extra = Math.max(0, inputs.extraMonthly ?? 0);
  const offset = Math.max(0, inputs.offsetIncomeMonthly ?? 0);

  if (principal <= 0) {
    // Fully funded by the deposit — nothing to model, and the UI says so.
    return {
      requiredPayment: 0,
      payoffMonths: 0,
      payoffYears: 0,
      totalInterest: 0,
      totalPaid: 0,
      baselineInterest: 0,
      interestSaved: 0,
      monthsSaved: 0,
      balances: [0],
    };
  }

  const requiredPayment = monthlyPayment(principal, annualRatePct, termYears);

  const withExtras = simulate(principal, annualRatePct, requiredPayment, extra + offset);
  const baseline =
    extra + offset > 0
      ? simulate(principal, annualRatePct, requiredPayment, 0)
      : withExtras;

  return {
    requiredPayment,
    payoffMonths: withExtras.months,
    payoffYears: withExtras.months / 12,
    totalInterest: withExtras.interest,
    totalPaid: withExtras.paid,
    baselineInterest: baseline.interest,
    interestSaved: Math.max(0, baseline.interest - withExtras.interest),
    monthsSaved: Math.max(0, baseline.months - withExtras.months),
    balances: withExtras.balances,
  };
}
