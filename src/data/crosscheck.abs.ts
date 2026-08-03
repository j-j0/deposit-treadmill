import {
  ABS_MEAN_DWELLING_PRICES as GENERATED_PRICES,
  ABS_MEAN_DWELLING_PERIOD_LABEL,
} from './generated';

/**
 * ABS cross-check figures. Display-only — nothing here feeds the calculation.
 *
 * These are auto-refreshed from the ABS Data API by `npm run refresh-data`
 * (dataflow RES_DWELL_ST), so this file is now a typed re-export rather than a
 * transcription. ABS material is licensed CC BY 4.0.
 *
 * Shown in the sources panel so a reader can sanity-check the Cotality medians
 * against an independent official series. They will NOT match, and that is
 * expected: these are MEAN prices by STATE for a quarter that ended earlier,
 * whereas the calculator uses composition-adjusted MEDIAN values by CAPITAL
 * CITY. The panel says so explicitly rather than inviting the reader to
 * conclude one of the two is wrong.
 */

export interface AbsMeanDwellingPrice {
  /** State/territory code, or 'AUS' for the national figure. */
  code: string;
  name: string;
  /** Mean price of residential dwellings, AUD. */
  meanPrice: number;
  /** The capital city region id this state most closely corresponds to. */
  relatedRegionId: string | null;
}

export const ABS_MEAN_DWELLING_PRICES: readonly AbsMeanDwellingPrice[] = GENERATED_PRICES;

/** e.g. "March quarter 2026" — always matches the data above. */
export const ABS_MEAN_DWELLING_PERIOD = ABS_MEAN_DWELLING_PERIOD_LABEL;

export const ABS_CROSSCHECK_SOURCE_ID = 'abs-total-value-dwellings';
