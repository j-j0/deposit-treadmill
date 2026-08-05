import { describe, it, expect } from 'vitest';
import { compareRentVsBuy, type RentVsBuyInputs } from '../src/lib/rentVsBuy';
import { monthlyPayment } from '../src/lib/mortgage';

const base: RentVsBuyInputs = {
  price: 1_000_000,
  depositPct: 20,
  upfrontCostsPct: 5,
  lmiCost: 0,
  mortgageRatePct: 6,
  termYears: 30,
  extraMonthly: 0,
  rentalIncomeWeekly: 0,
  priceGrowthPct: 4,
  ownershipCostsPct: 1,
  rentWeekly: 640, // ≈ what 1m at a 3.3% gross yield implies
  rentGrowthPct: 5.9,
  savingsReturnPct: 4.35,
  horizonYears: 30,
};

describe('compareRentVsBuy', () => {
  it('starts both paths from identical wealth', () => {
    const r = compareRentVsBuy(base);
    const first = r.points[0]!;
    // Buyer: value − loan = 1,000,000 − 800,000 = 200,000 (the deposit; upfront
    // costs are sunk). Renter: deposit + upfront = 250,000 invested.
    expect(first.buyNetWorth).toBe(200_000);
    expect(first.rentNetWorth).toBe(250_000);
    expect(r.startingCash).toBe(250_000);
  });

  it('sunk upfront costs mean renting starts ahead — always', () => {
    const r = compareRentVsBuy(base);
    expect(r.points[0]!.rentNetWorth).toBeGreaterThan(r.points[0]!.buyNetWorth);
  });

  it('buying pulls ahead over a long horizon under typical settings', () => {
    const r = compareRentVsBuy(base);
    expect(r.advantageAtHorizon).toBeGreaterThan(0);
    expect(r.crossoverMonth).not.toBeNull();
    expect(r.crossoverMonth!).toBeGreaterThan(0);
  });

  it('renting wins when prices are flat and rates are high', () => {
    const r = compareRentVsBuy({
      ...base,
      priceGrowthPct: 0,
      mortgageRatePct: 9,
      horizonYears: 10,
    });
    expect(r.advantageAtHorizon).toBeLessThan(0);
    expect(r.crossoverMonth).toBeNull();
  });

  it('a shorter horizon favours renting; a longer one favours buying', () => {
    const short = compareRentVsBuy({ ...base, horizonYears: 5 });
    const long = compareRentVsBuy({ ...base, horizonYears: 30 });
    expect(short.advantageAtHorizon).toBeLessThan(long.advantageAtHorizon);
  });

  it('room rental income widens the advantage via the shared-budget framing', () => {
    const without = compareRentVsBuy(base);
    const withIncome = compareRentVsBuy({ ...base, rentalIncomeWeekly: 250 });

    expect(withIncome.advantageAtHorizon).toBeGreaterThan(without.advantageAtHorizon);

    const lastW = withIncome.points[withIncome.points.length - 1]!;
    const lastO = without.points[without.points.length - 1]!;
    // The OWNER's net worth path is unchanged — income lowers their monthly
    // outflow, it doesn't add equity (excess income is modelled as spent).
    expect(lastW.buyNetWorth).toBeCloseTo(lastO.buyNetWorth, 4);
    // Both paths consume identical total cash each month, so a cheaper owner
    // month means the comparison renter invests less. The advantage moves
    // through the renter's line — asserted so the framing can't silently change.
    expect(lastW.rentNetWorth).toBeLessThan(lastO.rentNetWorth);
  });

  it('LMI is capitalised into the loan', () => {
    const withLmi = compareRentVsBuy({ ...base, lmiCost: 20_000 });
    const without = compareRentVsBuy(base);
    expect(withLmi.advantageAtHorizon).toBeLessThan(without.advantageAtHorizon);
  });

  it('totals reconcile: interest matches an equivalent straight mortgage run', () => {
    // With no extras and a horizon equal to the term, interest paid over the
    // comparison equals the loan's lifetime interest.
    const r = compareRentVsBuy(base);
    const payment = monthlyPayment(800_000, 6, 30);
    const lifetimeInterest = payment * 360 - 800_000;
    expect(r.totals.interestPaid).toBeCloseTo(lifetimeInterest, 0);
  });

  it('rent totals compound at the rent growth rate', () => {
    const r = compareRentVsBuy({ ...base, horizonYears: 2, rentGrowthPct: 0 });
    // Flat rents for 24 months: total = 640 × 52/12 × 24 = 66,560.
    expect(r.totals.rentPaid).toBeCloseTo(640 * (52 / 12) * 24, 4);
  });

  it('symmetric degenerate case: identical flows leave the gap at the sunk costs', () => {
    // If the renter pays exactly the owner's outgoings (so the difference
    // invested is zero), growth is zero everywhere and returns are zero, the
    // final gap is precisely: deposit gap (0) + upfront costs sunk vs invested.
    const payment = monthlyPayment(800_000, 0, 30); // 2,222.22 at zero rate
    const ownership = (1_000_000 * 0.01) / 12;
    const ownerOutflowWeekly = ((payment + ownership) * 12) / 52;

    const r = compareRentVsBuy({
      ...base,
      mortgageRatePct: 0,
      priceGrowthPct: 0,
      rentGrowthPct: 0,
      savingsReturnPct: 0,
      ownershipCostsPct: 1,
      rentWeekly: ownerOutflowWeekly,
      horizonYears: 30,
    });

    const last = r.points[r.points.length - 1]!;
    // Buyer: house fully paid → NW = 1,000,000 − ownership costs are cash gone.
    expect(last.buyNetWorth).toBeCloseTo(1_000_000, 0);
    // Renter: started with 250k, invested nothing further, zero return; paid
    // the same monthly cash as the owner throughout → still 250k.
    expect(last.rentNetWorth).toBeCloseTo(250_000, 0);
    // The 750k gap is exactly the loan principal repaid (forced saving).
    expect(last.buyNetWorth - last.rentNetWorth).toBeCloseTo(750_000, 0);
  });
});
