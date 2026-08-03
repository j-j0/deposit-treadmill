import type { Assumption } from './types';
import { AWE, CASH_RATE, SAVING_RATIO } from './generated';

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

const BY_ID = new Map(ASSUMPTIONS.map((a) => [a.id, a]));

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
