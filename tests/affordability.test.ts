import { describe, it, expect } from 'vitest';
import {
  calculateAffordability,
  principalFromPayment,
  type AffordabilityInputs,
} from '../src/lib/affordability';
import { monthlyPayment } from '../src/lib/mortgage';

const base: AffordabilityInputs = {
  annualIncome: 120_000,
  repaymentSharePct: 30,
  mortgageRatePct: 6.2,
  bufferPp: 3.0,
  termYears: 30,
  savings: 150_000,
  depositPct: 20,
  upfrontCostsPct: 5.5,
  assessedRentalIncomeAnnual: 0,
  lmiCost: 0,
  maxLvrPct: 95,
};

describe('principalFromPayment', () => {
  it('inverts monthlyPayment exactly', () => {
    const payment = monthlyPayment(500_000, 9.2, 30);
    expect(principalFromPayment(payment, 9.2, 30)).toBeCloseTo(500_000, 4);
  });

  it('degenerates to payment × months at zero rate', () => {
    expect(principalFromPayment(1000, 0, 30)).toBe(360_000);
  });
});

describe('calculateAffordability', () => {
  it('assesses at the mortgage rate plus the APRA buffer', () => {
    const r = calculateAffordability(base);
    expect(r.assessmentRatePct).toBeCloseTo(9.2, 10);

    // Budget: 120k × 30% / 12 = $3,000/month.
    expect(r.monthlyBudget).toBe(3000);

    // Max loan: the principal whose payment at 9.2%/30yr is exactly $3,000.
    expect(monthlyPayment(r.maxLoanByServiceability, 9.2, 30)).toBeCloseTo(3000, 4);
  });

  it('the buffer bites: max loan is far below the unbuffered amount', () => {
    const r = calculateAffordability(base);
    const unbuffered = principalFromPayment(3000, 6.2, 30);
    // At +3pp the borrowable amount drops by roughly a quarter.
    expect(r.maxLoanByServiceability).toBeLessThan(unbuffered * 0.8);
  });

  it('identifies the deposit as the binding constraint when savings are small', () => {
    const r = calculateAffordability({ ...base, savings: 60_000 });
    // Deposit constraint: 60k / 25.5% ≈ $235k, well under serviceability.
    expect(r.whichConstraint).toBe('deposit');
    expect(r.maxPrice).toBeCloseTo(60_000 / 0.255, 4);
  });

  it('identifies serviceability as binding when savings are large', () => {
    const r = calculateAffordability({ ...base, savings: 600_000 });
    expect(r.whichConstraint).toBe('serviceability');
    expect(r.maxPrice).toBeCloseTo(r.maxLoanByServiceability / 0.8, 4);
  });

  it('reports the actual (unbuffered) repayment at the max price', () => {
    const r = calculateAffordability({ ...base, savings: 600_000 });
    const loan = r.maxPrice * 0.8;
    expect(r.actualPaymentAtMax).toBeCloseTo(monthlyPayment(loan, 6.2, 30), 4);
    // Actual repayment sits under the assessed budget — that's the buffer's headroom.
    expect(r.actualPaymentAtMax).toBeLessThan(r.monthlyBudget);
  });

  it('assessed rental income raises the budget and the ceiling', () => {
    // $743/wk shaded to 80% = $30,908/yr of assessable rent.
    const shaded = 743 * 52 * 0.8;
    const withRent = calculateAffordability({
      ...base,
      savings: 600_000, // serviceability-bound, so rent actually moves the answer
      assessedRentalIncomeAnnual: shaded,
    });
    const without = calculateAffordability({ ...base, savings: 600_000 });

    expect(withRent.monthlyBudgetFromRent).toBeCloseTo(shaded / 12, 6);
    expect(withRent.monthlyBudgetFromIncome).toBe(without.monthlyBudget);
    expect(withRent.monthlyBudget).toBeCloseTo(without.monthlyBudget + shaded / 12, 6);
    expect(withRent.maxPrice).toBeGreaterThan(without.maxPrice);
  });

  it('shaded rent contributes in full — the shading is the haircut, applied once', () => {
    // The income share must NOT also be applied to rent: that would discount
    // vacancy and costs twice.
    const rent = 40_000;
    const r = calculateAffordability({ ...base, assessedRentalIncomeAnnual: rent });
    expect(r.monthlyBudgetFromRent).toBeCloseTo(rent / 12, 6);
    expect(r.monthlyBudgetFromRent).not.toBeCloseTo((rent * 0.3) / 12, 2);
  });

  it('zero assessed rent leaves the result identical to the owner-occupier case', () => {
    const a = calculateAffordability({ ...base, assessedRentalIncomeAnnual: 0 });
    const b = calculateAffordability(base);
    expect(a).toEqual(b);
    expect(a.monthlyBudgetFromRent).toBe(0);
  });

  it('a negative assessed rent cannot shrink the budget', () => {
    const r = calculateAffordability({ ...base, assessedRentalIncomeAnnual: -50_000 });
    expect(r.monthlyBudgetFromRent).toBe(0);
    expect(r.monthlyBudget).toBe(r.monthlyBudgetFromIncome);
  });

  it('the investor rate premium lowers the ceiling, all else equal', () => {
    const owner = calculateAffordability({ ...base, savings: 600_000, mortgageRatePct: 6.2 });
    const investor = calculateAffordability({ ...base, savings: 600_000, mortgageRatePct: 6.4 });
    expect(investor.maxLoanByServiceability).toBeLessThan(owner.maxLoanByServiceability);
  });

  it('capitalised LMI eats borrowing capacity before it reaches the property', () => {
    // Regression: LMI was absent from this calculation entirely, so dropping
    // the deposit below 20% raised the ceiling with none of its cost attached.
    const withLmi = calculateAffordability({
      ...base,
      savings: 600_000,
      depositPct: 10,
      lmiCost: 25_000,
    });
    const without = calculateAffordability({ ...base, savings: 600_000, depositPct: 10 });

    expect(withLmi.maxLoanByServiceability).toBe(without.maxLoanByServiceability);
    expect(withLmi.maxLoanForPropertyValue).toBeCloseTo(
      without.maxLoanByServiceability - 25_000,
      6,
    );
    expect(withLmi.maxPrice).toBeLessThan(without.maxPrice);
    // The whole premium comes off the property, geared up by the loan fraction.
    expect(without.maxPriceByServiceability - withLmi.maxPriceByServiceability).toBeCloseTo(
      25_000 / 0.9,
      4,
    );
  });

  it('a smaller deposit still stretches savings when the deposit binds — that part is real', () => {
    const twenty = calculateAffordability({ ...base, savings: 30_000, depositPct: 20 });
    const ten = calculateAffordability({ ...base, savings: 30_000, depositPct: 10 });

    expect(twenty.whichConstraint).toBe('deposit');
    expect(ten.whichConstraint).toBe('deposit');
    expect(ten.maxPrice).toBeGreaterThan(twenty.maxPrice);
  });

  it('but the LVR cap catches what capitalising LMI would otherwise hide', () => {
    // $30k savings, 10% deposit, $25k LMI: the deposit maths says $193,548, but
    // that loan would be 174,193 + 25,000 = 103% LVR. Nobody writes it.
    const r = calculateAffordability({
      ...base,
      savings: 30_000,
      depositPct: 10,
      lmiCost: 25_000,
    });

    expect(r.isFeasible).toBe(false);
    expect(r.whichConstraint).toBe('lvr');
    expect(r.maxPrice).toBe(0);
    // Capitalising $25k inside a 95% cap on a 90% loan needs a $500k property.
    expect(r.minPriceForLvr).toBeCloseTo(25_000 / 0.05, 4);
  });

  it('the same LMI is fine on a dearer property, where it dilutes', () => {
    const r = calculateAffordability({
      ...base,
      savings: 300_000,
      annualIncome: 400_000,
      depositPct: 10,
      lmiCost: 25_000,
    });
    expect(r.isFeasible).toBe(true);
    expect(r.maxPrice).toBeGreaterThan(r.minPriceForLvr);
  });

  it('a deposit smaller than the LVR cap allows is refused outright', () => {
    // 2% deposit = 98% loan, past a 95% cap even with no LMI at all.
    const r = calculateAffordability({ ...base, savings: 600_000, depositPct: 2, lmiCost: 0 });
    expect(r.isFeasible).toBe(false);
    expect(r.whichConstraint).toBe('lvr');
  });

  it('an LVR cap of 100% lets any deposit through when there is no LMI', () => {
    const r = calculateAffordability({
      ...base,
      savings: 600_000,
      depositPct: 2,
      lmiCost: 0,
      maxLvrPct: 100,
    });
    expect(r.isFeasible).toBe(true);
  });

  it('at a 20% deposit the LVR cap never binds', () => {
    const r = calculateAffordability({ ...base, savings: 600_000, depositPct: 20 });
    expect(r.minPriceForLvr).toBe(0);
    expect(r.isFeasible).toBe(true);
  });

  it('LMI larger than the borrowing capacity floors the loan at zero, not below', () => {
    const r = calculateAffordability({ ...base, savings: 600_000, lmiCost: 10_000_000 });
    expect(r.maxLoanForPropertyValue).toBe(0);
    expect(r.maxPrice).toBe(0);
  });

  it('handles zero income without dividing the universe', () => {
    const r = calculateAffordability({ ...base, annualIncome: 0 });
    expect(r.maxLoanByServiceability).toBe(0);
    expect(r.maxPrice).toBe(0);
  });
});
