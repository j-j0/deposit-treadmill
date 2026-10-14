// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Written by `npm run refresh-data` from official APIs. Edit that script, not
// this file; the next refresh will overwrite anything you change here.
//
// Covers the supporting figures only. The primary house price data in
// regions.capitals.ts is transcribed by hand from the Cotality Home Value Index,
// which has no free API — see scripts/refresh-data.mjs for why.

export const GENERATED_AT = '2026-10-03T14:05:23.570Z';

/** RBA cash rate target. Source: RBA statistical table F1. */
export const CASH_RATE = {
  valuePct: 4.6,
  effectiveISO: '2026-10-01',
  effectiveLabel: '01-Oct-2026',
} as const;

/**
 * Owner-occupier variable mortgage rate on NEW loans, all institutions.
 * Source: RBA statistical table F6 (housing lending rates).
 */
export const MORTGAGE_RATE = {
  valuePct: 6.2,
  effectiveISO: '2026-07-31',
  effectiveLabel: '31/07/2026',
} as const;

/**
 * Investor variable rate on NEW loans, all institutions. Investment lending
 * carries a premium over owner-occupier; both come from the same F6 table.
 */
export const MORTGAGE_RATE_INVESTOR = {
  valuePct: 6.4,
  effectiveISO: '2026-07-31',
  effectiveLabel: '31/07/2026',
} as const;

/** ABS Average Weekly Earnings: FT adult AWOTE, persons, seasonally adjusted. */
export const AWE = {
  weekly: 2083.7,
  period: '2026-S1',
  periodLabel: 'May 2026',
} as const;

/** ABS household saving to income ratio, seasonally adjusted. */
export const SAVING_RATIO = {
  pct: 6.5,
  period: '2026-Q2',
  periodLabel: 'June quarter 2026',
} as const;

/** ABS mean price of residential dwellings by state. Display-only cross-check. */
export const ABS_MEAN_DWELLING_PERIOD = '2026-Q2';
export const ABS_MEAN_DWELLING_PERIOD_LABEL = 'June quarter 2026';
export const ABS_MEAN_DWELLING_PRICES = [
  { code: 'AUS', name: 'Australia', meanPrice: 1100400, relatedRegionId: 'au' },
  { code: 'NSW', name: 'New South Wales', meanPrice: 1304900, relatedRegionId: 'sydney' },
  { code: 'VIC', name: 'Victoria', meanPrice: 918400, relatedRegionId: 'melbourne' },
  { code: 'QLD', name: 'Queensland', meanPrice: 1130600, relatedRegionId: 'brisbane' },
  { code: 'SA', name: 'South Australia', meanPrice: 979600, relatedRegionId: 'adelaide' },
  { code: 'WA', name: 'Western Australia', meanPrice: 1123700, relatedRegionId: 'perth' },
  { code: 'TAS', name: 'Tasmania', meanPrice: 733200, relatedRegionId: 'hobart' },
  { code: 'NT', name: 'Northern Territory', meanPrice: 614400, relatedRegionId: 'darwin' },
  { code: 'ACT', name: 'Australian Capital Territory', meanPrice: 981700, relatedRegionId: 'canberra' },
] as const;
