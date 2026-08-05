import { describe, it, expect } from 'vitest';
import { monthlyPayment, simulateMortgage, stepBalance } from '../src/lib/mortgage';

describe('monthlyPayment', () => {
  it('matches the hand-computed standard vector', () => {
    // $500,000 at 6% over 30 years: r = 0.005, n = 360
    // M = 500000 × 0.005 / (1 − 1.005^−360) = 2,997.7526…
    expect(monthlyPayment(500_000, 6, 30)).toBeCloseTo(2997.75, 1);
  });

  it('degenerates to straight division at zero interest', () => {
    expect(monthlyPayment(360_000, 0, 30)).toBeCloseTo(1000, 6);
  });

  it('returns zero for a fully-deposit-funded purchase', () => {
    expect(monthlyPayment(0, 6, 30)).toBe(0);
    expect(monthlyPayment(-5, 6, 30)).toBe(0);
  });

  it('scales linearly with principal', () => {
    const one = monthlyPayment(400_000, 6.2, 30);
    const two = monthlyPayment(800_000, 6.2, 30);
    expect(two).toBeCloseTo(one * 2, 6);
  });
});

describe('simulateMortgage', () => {
  it('reproduces the closed-form totals with no extras', () => {
    const r = simulateMortgage({ principal: 500_000, annualRatePct: 6, termYears: 30 });

    expect(r.payoffMonths).toBe(360);
    // Total interest = 360 × 2997.7526 − 500,000 ≈ 579,190.95
    expect(r.totalInterest).toBeCloseTo(579_191, 0);
    expect(r.totalPaid).toBeCloseTo(1_079_191, 0);
    // With no extras, baseline IS the run.
    expect(r.interestSaved).toBe(0);
    expect(r.monthsSaved).toBe(0);
  });

  it('pays off in exactly the term at zero rate', () => {
    const r = simulateMortgage({ principal: 360_000, annualRatePct: 0, termYears: 30 });
    expect(r.payoffMonths).toBe(360);
    expect(r.totalInterest).toBeCloseTo(0, 6);
    expect(r.totalPaid).toBeCloseTo(360_000, 4);
  });

  it('extra repayments shorten the loan and save interest, monotonically', () => {
    const none = simulateMortgage({ principal: 500_000, annualRatePct: 6, termYears: 30 });
    const some = simulateMortgage({
      principal: 500_000,
      annualRatePct: 6,
      termYears: 30,
      extraMonthly: 500,
    });
    const more = simulateMortgage({
      principal: 500_000,
      annualRatePct: 6,
      termYears: 30,
      extraMonthly: 1000,
    });

    expect(some.payoffMonths).toBeLessThan(none.payoffMonths);
    expect(more.payoffMonths).toBeLessThan(some.payoffMonths);
    expect(some.interestSaved).toBeGreaterThan(0);
    expect(more.interestSaved).toBeGreaterThan(some.interestSaved);
    // Baseline reported by the extras run equals the no-extras run.
    expect(some.baselineInterest).toBeCloseTo(none.totalInterest, 4);
  });

  it('treats offset income exactly like an extra repayment', () => {
    const viaExtra = simulateMortgage({
      principal: 500_000,
      annualRatePct: 6,
      termYears: 30,
      extraMonthly: 800,
    });
    const viaIncome = simulateMortgage({
      principal: 500_000,
      annualRatePct: 6,
      termYears: 30,
      offsetIncomeMonthly: 800,
    });

    expect(viaIncome.payoffMonths).toBe(viaExtra.payoffMonths);
    expect(viaIncome.totalInterest).toBeCloseTo(viaExtra.totalInterest, 6);
  });

  it('never overpays on the final month', () => {
    const r = simulateMortgage({
      principal: 100_000,
      annualRatePct: 6,
      termYears: 30,
      extraMonthly: 5000,
    });
    // Sum of payments equals principal + interest exactly.
    expect(r.totalPaid).toBeCloseTo(100_000 + r.totalInterest, 6);
    // Balance path ends at exactly zero.
    expect(r.balances[r.balances.length - 1]).toBeCloseTo(0, 6);
  });

  it('handles principal zero (bought outright)', () => {
    const r = simulateMortgage({ principal: 0, annualRatePct: 6.2, termYears: 30 });
    expect(r.requiredPayment).toBe(0);
    expect(r.payoffMonths).toBe(0);
    expect(r.totalInterest).toBe(0);
  });
});

describe('stepBalance', () => {
  it('charges interest then applies the payment', () => {
    // 1000 at 1%/month with a 500 payment: interest 10, balance 1010−500=510.
    const s = stepBalance(1000, 0.01, 500);
    expect(s.interest).toBeCloseTo(10, 10);
    expect(s.balance).toBeCloseTo(510, 10);
    expect(s.paid).toBe(500);
  });

  it('clips the final payment to what is owed', () => {
    const s = stepBalance(100, 0.01, 500);
    expect(s.paid).toBeCloseTo(101, 10);
    expect(s.balance).toBe(0);
  });
});
