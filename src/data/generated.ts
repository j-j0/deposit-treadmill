// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Written by `npm run refresh-data` from official APIs. Edit that script, not
// this file; the next refresh will overwrite anything you change here.
//
// Covers the supporting figures only. The primary house price data in
// regions.capitals.ts is transcribed by hand from the Cotality Home Value Index,
// which has no free API — see scripts/refresh-data.mjs for why.

export const GENERATED_AT = '2026-08-05T09:36:55.404Z';

/** RBA cash rate target. Source: RBA statistical table F1. */
export const CASH_RATE = {
  valuePct: 4.35,
  effectiveISO: '2026-08-04',
  effectiveLabel: '04-Aug-2026',
} as const;

/**
 * Owner-occupier variable mortgage rate on NEW loans, all institutions.
 * Source: RBA statistical table F6 (housing lending rates).
 */
export const MORTGAGE_RATE = {
  valuePct: 6.2,
  effectiveISO: '2026-05-31',
  effectiveLabel: '31/05/2026',
} as const;

/** ABS Average Weekly Earnings: FT adult AWOTE, persons, seasonally adjusted. */
export const AWE = {
  weekly: 2051.1,
  period: '2025-S2',
  periodLabel: 'November 2025',
} as const;

/** ABS household saving to income ratio, seasonally adjusted. */
export const SAVING_RATIO = {
  pct: 6.2,
  period: '2026-Q1',
  periodLabel: 'March quarter 2026',
} as const;

/** ABS mean price of residential dwellings by state. Display-only cross-check. */
export const ABS_MEAN_DWELLING_PERIOD = '2026-Q1';
export const ABS_MEAN_DWELLING_PERIOD_LABEL = 'March quarter 2026';
export const ABS_MEAN_DWELLING_PRICES = [
  { code: 'AUS', name: 'Australia', meanPrice: 1111100, relatedRegionId: 'au' },
  { code: 'NSW', name: 'New South Wales', meanPrice: 1324800, relatedRegionId: 'sydney' },
  { code: 'VIC', name: 'Victoria', meanPrice: 947100, relatedRegionId: 'melbourne' },
  { code: 'QLD', name: 'Queensland', meanPrice: 1123700, relatedRegionId: 'brisbane' },
  { code: 'SA', name: 'South Australia', meanPrice: 973100, relatedRegionId: 'adelaide' },
  { code: 'WA', name: 'Western Australia', meanPrice: 1103500, relatedRegionId: 'perth' },
  { code: 'TAS', name: 'Tasmania', meanPrice: 750300, relatedRegionId: 'hobart' },
  { code: 'NT', name: 'Northern Territory', meanPrice: 597300, relatedRegionId: 'darwin' },
  { code: 'ACT', name: 'Australian Capital Territory', meanPrice: 1018000, relatedRegionId: 'canberra' },
] as const;
