import type { Source } from './types';
import {
  AWE,
  CASH_RATE,
  SAVING_RATIO,
  ABS_MEAN_DWELLING_PERIOD_LABEL,
  GENERATED_AT,
} from './generated';

/**
 * The citation registry. Every figure in the app points here by id.
 *
 * Source ids are stable slugs with no dates in them: the reference period of an
 * auto-refreshed source changes every time the pipeline runs, and an id that
 * encoded it would silently become a lie. Periods and titles are derived from
 * `generated.ts` for exactly the same reason.
 *
 * A note on why the primary source is Cotality rather than the ABS: the ABS
 * series most people reach for — Residential Property Price Indexes: Eight
 * Capital Cities — was discontinued at December quarter 2021 and no longer
 * exists. Its ABS successor publishes a *mean* price by *state*, not a median
 * by capital city, which cannot drive a city-level deposit target. It is
 * carried below as an independent cross-check instead. See `abs-rppi-ceased`.
 */

/** Date portion of the last successful data refresh. */
export const LAST_REFRESHED_ISO = GENERATED_AT.slice(0, 10);

export const SOURCES: readonly Source[] = [
  {
    id: 'cotality-hvi',
    publisher: 'Cotality (formerly CoreLogic)',
    title: 'Home Value Index — index results as at 30 June 2026',
    url: 'https://discover.cotality.com/hubfs/Article-Reports/COTALITY%20HVI%20JULY%202026%20FINAL.pdf',
    referencePeriod: 'As at 30 June 2026',
    releaseDate: '1 July 2026',
    releaseISO: '2026-07-01',
    cadenceDays: 31,
    accessed: '31 July 2026',
    // The one source that cannot be automated: Cotality licenses the HVI through
    // a paid B2B API, and the free channel is a monthly PDF marked Proprietary.
    // Transcribed by hand, which is why the staleness check watches it closely.
    autoRefreshed: false,
    note:
      'Median values for houses, units and dwellings across the eight capital cities, plus 5- and 10-year change in dwelling values. ' +
      'The HVI is a hedonic index: values are composition-adjusted using property attributes rather than being a raw median of whatever sold that month. ' +
      'Figures are taken from the public monthly media release, which is marked © 2026 RP Data Pty Ltd t/as Cotality, Proprietary, and is reproduced here with attribution. ' +
      'This is the only source here that is transcribed by hand — Cotality has no free API, so it cannot be refreshed automatically.',
  },
  {
    id: 'abs-total-value-dwellings',
    publisher: 'Australian Bureau of Statistics',
    title: `Total Value of Dwellings, ${ABS_MEAN_DWELLING_PERIOD_LABEL}`,
    url: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/latest-release',
    referencePeriod: ABS_MEAN_DWELLING_PERIOD_LABEL,
    releaseDate: '9 June 2026',
    releaseISO: '2026-06-09',
    cadenceDays: 91,
    accessed: '31 July 2026',
    autoRefreshed: true,
    note:
      'Independent cross-check only — never used in the calculation. This series reports a MEAN price by STATE, an older reference period than the Cotality data, ' +
      'so it is not directly comparable to a capital-city median and will not match it. ' +
      'Auto-refreshed from the ABS Data API (dataflow RES_DWELL_ST). ABS material is licensed CC BY 4.0.',
  },
  {
    id: 'abs-awe',
    publisher: 'Australian Bureau of Statistics',
    title: `Average Weekly Earnings, Australia, ${AWE.periodLabel}`,
    url: 'https://www.abs.gov.au/statistics/labour/earnings-and-working-conditions/average-weekly-earnings-australia/latest-release',
    referencePeriod: AWE.periodLabel,
    releaseDate: '26 February 2026',
    releaseISO: '2026-02-26',
    // Biannual: AWE has May and November reference periods, released roughly
    // each August and February. Not quarterly.
    cadenceDays: 182,
    accessed: '31 July 2026',
    autoRefreshed: true,
    note:
      `Full-time adult average weekly ordinary time earnings, seasonally adjusted: $${AWE.weekly} per week. ` +
      'Used only to pre-fill the household income field with a recognisable starting point. ' +
      'Auto-refreshed from the ABS Data API (dataflow AWE). ABS material is licensed CC BY 4.0.',
  },
  {
    id: 'abs-national-accounts',
    publisher: 'Australian Bureau of Statistics',
    title: `Australian National Accounts: National Income, Expenditure and Product, ${SAVING_RATIO.periodLabel}`,
    url: 'https://www.abs.gov.au/statistics/economy/national-accounts/australian-national-accounts-national-income-expenditure-and-product/latest-release',
    referencePeriod: SAVING_RATIO.periodLabel,
    releaseDate: '3 June 2026',
    releaseISO: '2026-06-03',
    cadenceDays: 91,
    accessed: '31 July 2026',
    autoRefreshed: true,
    note:
      `Household saving to income ratio: ${SAVING_RATIO.pct}%. Used to pre-fill the monthly savings field so the opening scenario is a household on average earnings saving at the national average rate, rather than a figure chosen to make a point. ` +
      'The ABS measures this ratio against gross DISPOSABLE (after-tax) income, while the income field here is pre-tax — so applying it to that field understates the implied rate. ' +
      'It is also a whole-economy average that includes households drawing down savings; a household deliberately saving for a deposit typically saves more than this. It is a starting point, not a prediction. ' +
      'Auto-refreshed from the ABS Data API (dataflow ANA_AGG). ABS material is licensed CC BY 4.0.',
  },
  {
    id: 'rba-cash-rate',
    publisher: 'Reserve Bank of Australia',
    title: 'Cash Rate Target — statistical table F1',
    url: 'https://www.rba.gov.au/statistics/cash-rate/',
    referencePeriod: `As at ${CASH_RATE.effectiveLabel}`,
    releaseDate: CASH_RATE.effectiveLabel,
    releaseISO: CASH_RATE.effectiveISO,
    // The Board meets on an irregular schedule, so there is no cadence to be
    // overdue against; the pipeline check covers this one instead.
    cadenceDays: null,
    accessed: '31 July 2026',
    autoRefreshed: true,
    note:
      `Cash rate target ${CASH_RATE.valuePct}%. Used as the default return on existing savings. ` +
      'Note this is the cash rate, not a savings account rate — real deposit accounts pay above or below it, which is why the figure is editable. ' +
      'Auto-refreshed from the RBA’s published F1 statistical table.',
  },
  {
    id: 'abs-rppi-ceased',
    publisher: 'Australian Bureau of Statistics',
    title: 'Residential Property Price Indexes: Eight Capital Cities (discontinued)',
    url: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/residential-property-price-indexes-eight-capital-cities',
    referencePeriod: 'Final issue: December quarter 2021',
    releaseDate: 'Ceased 2022',
    releaseISO: '2022-01-01',
    cadenceDays: null,
    accessed: '31 July 2026',
    autoRefreshed: false,
    note:
      'Listed for transparency about what this calculator does NOT use. This is the series most Australian house-price commentary still cites, ' +
      'but the ABS discontinued it after December quarter 2021. Any tool claiming current capital-city price indexes from it is citing a dead series.',
  },
];

const BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export function getSource(id: string): Source | undefined {
  return BY_ID.get(id);
}

/** Throws rather than rendering an uncited figure. Used by the Citation component. */
export function requireSource(id: string): Source {
  const source = BY_ID.get(id);
  if (!source) {
    throw new Error(
      `Unknown sourceId "${id}". Every figure must cite a source registered in src/data/sources.ts.`,
    );
  }
  return source;
}
