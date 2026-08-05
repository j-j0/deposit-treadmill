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

  it('handles zero income without dividing the universe', () => {
    const r = calculateAffordability({ ...base, annualIncome: 0 });
    expect(r.maxLoanByServiceability).toBe(0);
    expect(r.maxPrice).toBe(0);
  });
});
