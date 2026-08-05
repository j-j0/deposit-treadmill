import type { Assumption, DisplayPropertyType } from './types';
import {
  AWE,
  CASH_RATE,
  MORTGAGE_RATE,
  MORTGAGE_RATE_INVESTOR,
  SAVING_RATIO,
} from './generated';

/**
 * Assumptions: the numbers the model needs that no source can supply, because
 * they describe a future rather than a published past.
 *
 * Every one is editable, and every one is rendered next to its rationale. None
 * is hardcoded at a call site — `src/lib/treadmill.ts` takes them as arguments.
 */

/** Which published growth figure drives the projection. */
export type GrowthBasis = 'tenYear' | 'fiveYear' | 'twelveMonth' | 'custom';

export interface GrowthBasisOption {
  id: GrowthBasis;
  label: string;
  /** Shown as the explanation of what this basis actually measures. */
  description: string;
}

export const GROWTH_BASIS_OPTIONS: readonly GrowthBasisOption[] = [
  {
    id: 'tenYear',
    label: '10-year average',
    description:
      'Cotality’s published 10-year change for this city, annualised. Spans a full market cycle — a boom and a downturn — which is why it is the default for a projection measured in years.',
  },
  {
    id: 'fiveYear',
    label: '5-year average',
    description:
      'Cotality’s published 5-year change for this city, annualised. Captures the post-2021 period, which was unusually strong in the mid-sized capitals.',
  },
  {
    id: 'twelveMonth',
    label: 'Last 12 months',
    description:
      'The most recent published 12-month change, specific to the property type you have selected. The most current figure available, and the most volatile — it is a snapshot of one moment in the cycle, not a trend.',
  },
  {
    id: 'custom',
    label: 'Set my own',
    description:
      'Your own figure. Nothing about the calculation changes — this is the same input the presets fill in, exposed directly.',
  },
];

export const DEFAULT_GROWTH_BASIS: GrowthBasis = 'tenYear';

export const ASSUMPTIONS: readonly Assumption[] = [
  {
    id: 'depositPct',
    label: 'Deposit target',
    rationale:
      '20% is the conventional threshold at which lenders mortgage insurance is not charged. It is a market convention, not a legal requirement — many buyers purchase with less and pay LMI, so lower this if that is your plan.',
    defaultValue: 20,
    unit: 'percent',
    min: 5,
    max: 40,
    step: 0.5,
  },
  {
    id: 'savingsReturnPct',
    label: 'Return on your existing savings',
    rationale: `Defaults to the RBA cash rate target of ${CASH_RATE.valuePct}% (as at ${CASH_RATE.effectiveLabel}, read straight from RBA table F1). Note this is the cash rate, not a savings account rate — actual deposit accounts pay above or below it, and this is before tax. Set it to what your account actually pays.`,
    defaultValue: CASH_RATE.valuePct,
    unit: 'percent',
    min: 0,
    max: 15,
    step: 0.05,
    sourceId: 'rba-cash-rate',
  },
  {
    id: 'growthRatePct',
    label: 'Annual house price growth',
    rationale:
      'The rate at which the deposit target moves away from you. Defaults to this city’s published 10-year change, annualised. This is the single most important assumption in the model — change it and watch everything else move.',
    defaultValue: 0, // Filled per-city from the selected growth basis.
    unit: 'percent',
    min: -10,
    max: 25,
    step: 0.1,
    sourceId: 'cotality-hvi',
  },
];

/** Mortgage-side assumptions, rendered under their own group heading. */
export const MORTGAGE_ASSUMPTIONS: readonly Assumption[] = [
  {
    id: 'mortgageRatePct',
    label: 'Mortgage interest rate',
    rationale: `Defaults to ${MORTGAGE_RATE.valuePct}% — the average owner-occupier variable rate on new loans actually funded (all lenders, RBA table F6, as at ${MORTGAGE_RATE.effectiveLabel}). Your quoted rate will differ with lender, deposit size and fixed/variable split, so put your real rate in.`,
    defaultValue: MORTGAGE_RATE.valuePct,
    unit: 'percent',
    min: 1,
    max: 15,
    step: 0.05,
    sourceId: 'rba-f6',
  },
  {
    id: 'loanTermYears',
    label: 'Loan term',
    rationale:
      '30 years is the standard Australian mortgage term — a convention, not a rule. A shorter term raises the repayment and cuts total interest sharply; the interest figure above reacts immediately if you change this.',
    defaultValue: 30,
    unit: 'years',
    min: 10,
    max: 40,
    step: 1,
  },
  {
    id: 'extraRepaymentMonthly',
    label: 'Extra repayment each month',
    rationale:
      'Anything paid above the required repayment comes straight off the principal, which is why small amounts compound into years saved. Defaults to zero so the baseline shows the loan as written.',
    defaultValue: 0,
    unit: 'currency',
    min: 0,
    max: 5000,
    step: 50,
  },
  {
    id: 'repaymentSharePct',
    label: 'Repayments as a share of gross income',
    rationale:
      '30% of gross income is the conventional line where housing costs start being called “stress”. It is a rule of thumb, not a bank policy — lenders assess your actual expenses. The affordability estimate uses this share, tested at your rate plus APRA’s 3-point buffer.',
    defaultValue: 30,
    unit: 'percent',
    min: 10,
    max: 50,
    step: 1,
  },
  {
    id: 'rentalShadingPct',
    label: 'Rental income a lender will count',
    rationale:
      'Lenders do not count rent at face value — they shade it, typically to around 80%, to allow for vacancy, management fees, rates and repairs. The exact haircut varies by lender and is not published anywhere, so this is an industry rule of thumb rather than a sourced figure. It only applies to investment purchases assessed on a lease.',
    defaultValue: 80,
    unit: 'percent',
    min: 0,
    max: 100,
    step: 5,
  },
  {
    id: 'upfrontCostsPct',
    label: 'Upfront transaction costs',
    rationale:
      'Stamp duty, conveyancing and inspections, as a share of the purchase price. Defaults to 5.5% — a mid-range figure for an established home bought by a non-first-home-buyer. It varies hugely: first-home-buyer concessions can cut it to near zero in some states, so check your state’s calculator and set it.',
    defaultValue: 5.5,
    unit: 'percent',
    min: 0,
    max: 12,
    step: 0.1,
  },
];

/** Renting-side assumptions for the rent-vs-buy comparison. */
export const RENTING_ASSUMPTIONS: readonly Assumption[] = [
  {
    id: 'rentGrowthPct',
    label: 'Annual rent growth',
    rationale:
      'Defaults to 5.9% — Cotality’s published national annual rental growth to June 2026. Rents move with vacancy rates and wages rather than with prices, and the national figure hides big city differences, so treat this as a starting point.',
    defaultValue: 5.9,
    unit: 'percent',
    min: -5,
    max: 15,
    step: 0.1,
    sourceId: 'cotality-hvi',
  },
  {
    id: 'ownershipCostsPct',
    label: 'Ownership running costs, per year',
    rationale:
      'Council rates, insurance, maintenance — and strata levies for townhouses and units — as a share of the property’s value each year. Defaults to 1.0% for houses and 1.5% for strata properties. This is a rule of thumb, not a published statistic: no official series measures it, so it is deliberately editable rather than quietly assumed.',
    defaultValue: 1.0,
    unit: 'percent',
    min: 0,
    max: 4,
    step: 0.1,
  },
  {
    id: 'horizonYears',
    label: 'Comparison horizon',
    rationale:
      'How many years the rent-vs-buy comparison runs. Defaults to the loan term, because that is when the mortgage is gone. Shorter horizons favour renting (upfront costs haven’t been amortised); longer ones favour owning.',
    defaultValue: 30,
    unit: 'years',
    min: 5,
    max: 40,
    step: 1,
  },
];

/**
 * Ownership running costs default is property-type-aware: strata-titled
 * properties (units, townhouses) carry levies that freestanding houses do not.
 * Both figures are conventions, surfaced in the rationale above.
 */
export function ownershipCostsDefaultFor(type: DisplayPropertyType): number {
  return type === 'unit' || type === 'townhouse' ? 1.5 : 1.0;
}

/**
 * APRA serviceability buffer: lenders must assess repayments at the loan rate
 * plus this many percentage points. Reaffirmed June 2026; in force since
 * October 2021. Source: apra-buffer.
 */
export const APRA_BUFFER_PP = 3.0;

/**
 * The rate that applies to each purchase purpose. Investment lending carries a
 * premium; both figures come from the same RBA F6 table and auto-refresh.
 */
export const MORTGAGE_RATES = {
  owner: MORTGAGE_RATE.valuePct,
  investment: MORTGAGE_RATE_INVESTOR.valuePct,
} as const;
export const APRA_BUFFER_SOURCE_ID = 'apra-buffer';

/**
 * National annual rental growth, Cotality HVI June 2026 (“held at 5.9%
 * nationally”). Source: cotality-hvi.
 */
export const RENT_GROWTH_NATIONAL_PCT = 5.9;

/**
 * Bedroom counts used ONLY by the room-rent quick-fill buttons: renting one
 * room is approximated as the whole-property rent divided by this count. A
 * crude convention, labelled as such in the UI — the actual input is the
 * dollar figure the user confirms or replaces.
 */
export const ASSUMED_BEDROOMS: Record<DisplayPropertyType, number> = {
  house: 3,
  townhouse: 3,
  unit: 2,
  dwelling: 3,
};

const ALL_ASSUMPTIONS = [...ASSUMPTIONS, ...MORTGAGE_ASSUMPTIONS, ...RENTING_ASSUMPTIONS];

const BY_ID = new Map(ALL_ASSUMPTIONS.map((a) => [a.id, a]));

export function getAssumption(id: string): Assumption | undefined {
  return BY_ID.get(id);
}

/**
 * Default household income, used only to pre-fill the input.
 * ABS Average Weekly Earnings, Nov 2025: full-time adult average weekly ordinary
 * time earnings, seasonally adjusted, $2,051.10/week × 52 weeks.
 */
export const DEFAULT_INCOME_SOURCE_ID = 'abs-awe';
export const AWE_WEEKLY = AWE.weekly;
export const AWE_PERIOD_LABEL = AWE.periodLabel;
export const DEFAULT_HOUSEHOLD_INCOME = Math.round(AWE_WEEKLY * 52);

/**
 * Default monthly savings, so the opening scenario is a household on average
 * earnings saving at the national average rate — not a figure picked to make
 * the treadmill look worse (or better) than it is.
 *
 * ABS household saving to income ratio, March quarter 2026: 6.2%.
 *
 * Two honest caveats, both surfaced in the UI: the ABS measures this against
 * gross DISPOSABLE income while the income field is pre-tax, and it is a
 * whole-economy average including households drawing savings down. Someone
 * actively saving for a deposit typically saves more.
 */
export const DEFAULT_SAVING_RATIO_SOURCE_ID = 'abs-national-accounts';
export const HOUSEHOLD_SAVING_RATIO_PCT = SAVING_RATIO.pct;
export const SAVING_RATIO_PERIOD_LABEL = SAVING_RATIO.periodLabel;

export function defaultMonthlySavings(annualIncome: number): number {
  return Math.round((annualIncome * (HOUSEHOLD_SAVING_RATIO_PCT / 100)) / 12);
}

/**
 * Opening value for "saved so far". Unlike everything else in this file this is
 * a plain round placeholder, not a derived figure — it is the user's own number
 * and there is no representative published value for "deposit savings to date".
 * The UI labels it as a starting point rather than implying it means anything.
 */
export const PLACEHOLDER_CURRENT_SAVINGS = 50_000;
