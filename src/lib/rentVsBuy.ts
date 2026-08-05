import { monthlyPayment, stepBalance } from './mortgage';

/**
 * Rent vs buy, compared the only honest way: net worth at the horizon, with
 * both paths starting from identical wealth and spending from identical
 * monthly budgets.
 *
 * The classic dishonest versions of this comparison either pretend the renter
 * burns the deposit money (it stays invested), or pretend the owner's
 * repayments are pure cost (part of each one is savings in disguise). Here:
 *
 *   BUY  — deposit + upfront costs go into the house at month 0. Each month the
 *          owner pays mortgage + running costs − any room-rental income.
 *          Net worth = property value − loan balance. (Upfront costs are sunk:
 *          they bought the transaction, not equity.)
 *
 *   RENT — the same starting cash goes into savings at the savings return.
 *          Each month the renter pays rent, and the DIFFERENCE between the
 *          owner's outgoings and rent is added to (or, if rent is dearer,
 *          withdrawn from) savings. Net worth = savings balance.
 *
 * Because both paths consume identical cash, the net-worth gap at any month is
 * a fair comparison. No tax modelling: the main-residence CGT exemption,
 * partial CGT when letting rooms, land tax and negative gearing are all real
 * and all disclosed in the UI rather than half-modelled here.
 */

export interface RentVsBuyInputs {
  price: number;
  depositPct: number;
  upfrontCostsPct: number;
  /** Lenders mortgage insurance, added to the loan at settlement. */
  lmiCost: number;
  mortgageRatePct: number;
  termYears: number;
  extraMonthly: number;
  /** Room/whole-property rental income while owning, AUD per week. */
  rentalIncomeWeekly: number;
  /** Annual property price growth, percent. */
  priceGrowthPct: number;
  /** Ownership running costs as percent of current value per year. */
  ownershipCostsPct: number;
  /** What the renter pays for equivalent housing, AUD per week, today. */
  rentWeekly: number;
  /** Annual rent growth, percent. */
  rentGrowthPct: number;
  /** Return on invested savings, percent per year. */
  savingsReturnPct: number;
  horizonYears: number;
}

export interface RentVsBuyPoint {
  month: number;
  year: number;
  buyNetWorth: number;
  rentNetWorth: number;
}

export interface RentVsBuyResult {
  points: RentVsBuyPoint[];
  /** Net worth difference (buy − rent) at the horizon. Positive = buying ahead. */
  advantageAtHorizon: number;
  /** First month buying pulls ahead for good, or null if it never does. */
  crossoverMonth: number | null;
  /** Totals over the horizon, for the ledger row. */
  totals: {
    rentPaid: number;
    interestPaid: number;
    ownershipCostsPaid: number;
    rentalIncomeReceived: number;
  };
  /** The starting cash both paths deploy: deposit + upfront costs. */
  startingCash: number;
}

const WEEKS_PER_MONTH = 52 / 12;

export function compareRentVsBuy(inputs: RentVsBuyInputs): RentVsBuyResult {
  const {
    price,
    depositPct,
    upfrontCostsPct,
    lmiCost,
    mortgageRatePct,
    termYears,
    extraMonthly,
    rentalIncomeWeekly,
    priceGrowthPct,
    ownershipCostsPct,
    rentWeekly,
    rentGrowthPct,
    savingsReturnPct,
    horizonYears,
  } = inputs;

  const months = Math.round(horizonYears * 12);
  const deposit = price * (depositPct / 100);
  const upfront = price * (upfrontCostsPct / 100);
  const startingCash = deposit + upfront;

  // LMI is capitalised into the loan, as it usually is in practice.
  const principal = Math.max(0, price - deposit + lmiCost);
  const requiredPayment = monthlyPayment(principal, mortgageRatePct, termYears);

  const monthlyGrowth = Math.pow(1 + priceGrowthPct / 100, 1 / 12);
  const monthlyRentGrowth = Math.pow(1 + rentGrowthPct / 100, 1 / 12);
  const savingsMonthlyRate = savingsReturnPct / 100 / 12;
  const loanMonthlyRate = mortgageRatePct / 100 / 12;

  let value = price;
  let balance = principal;
  let renterSavings = startingCash;
  let rentThisMonth = rentWeekly * WEEKS_PER_MONTH;
  let incomeThisMonth = rentalIncomeWeekly * WEEKS_PER_MONTH;

  const totals = {
    rentPaid: 0,
    interestPaid: 0,
    ownershipCostsPaid: 0,
    rentalIncomeReceived: 0,
  };

  const points: RentVsBuyPoint[] = [
    { month: 0, year: 0, buyNetWorth: value - balance, rentNetWorth: renterSavings },
  ];

  for (let m = 1; m <= months; m++) {
    // ----- owner's month
    const stepped = stepBalance(balance, loanMonthlyRate, requiredPayment + extraMonthly);
    totals.interestPaid += stepped.interest;

    const ownershipCost = (value * (ownershipCostsPct / 100)) / 12;
    totals.ownershipCostsPaid += ownershipCost;
    totals.rentalIncomeReceived += Math.min(incomeThisMonth, stepped.paid + ownershipCost);

    // Owner's net cash out this month. Rental income offsets it; any income
    // beyond the month's outgoings is treated as spent, not invested — a
    // deliberately conservative simplification, noted in the UI.
    const ownerOutflow = Math.max(0, stepped.paid + ownershipCost - incomeThisMonth);
    balance = stepped.balance;
    value *= monthlyGrowth;

    // ----- renter's month, spending from the same budget
    totals.rentPaid += rentThisMonth;
    const difference = ownerOutflow - rentThisMonth; // invest if +, withdraw if −
    renterSavings = renterSavings * (1 + savingsMonthlyRate) + difference;

    rentThisMonth *= monthlyRentGrowth;
    incomeThisMonth *= monthlyRentGrowth; // room rents move with the rental market

    points.push({
      month: m,
      year: m / 12,
      buyNetWorth: value - balance,
      rentNetWorth: renterSavings,
    });
  }

  // Crossover: the LAST transition from behind to ahead, so a brief early lead
  // that collapses doesn't read as "buying wins from year one".
  let crossoverMonth: number | null = null;
  for (let i = 1; i < points.length; i++) {
    const ahead = points[i]!.buyNetWorth >= points[i]!.rentNetWorth;
    const wasAhead = points[i - 1]!.buyNetWorth >= points[i - 1]!.rentNetWorth;
    if (ahead && !wasAhead) crossoverMonth = points[i]!.month;
  }
  const last = points[points.length - 1]!;
  const endedAhead = last.buyNetWorth >= last.rentNetWorth;
  if (!endedAhead) crossoverMonth = null;
  else if (crossoverMonth === null && points[0]!.buyNetWorth >= points[0]!.rentNetWorth) {
    crossoverMonth = 0;
  }

  return {
    points,
    advantageAtHorizon: last.buyNetWorth - last.rentNetWorth,
    crossoverMonth,
    totals,
    startingCash,
  };
}
