import type { PropertyType, Region } from './types';

/**
 * Capital city and national price data.
 *
 * EVERY figure below is transcribed verbatim from the Cotality Home Value Index
 * index-results tables as at 30 June 2026 (released 1 July 2026) — medians,
 * 12-month changes and gross rental yields from the p.4 index tables, 5- and
 * 10-year changes from the p.2 "change in dwelling values over key time
 * periods" table. Yields were extracted from the PDF text layer, not read off
 * the rendered page.
 *
 * Nothing here is estimated, rounded or interpolated. Annualised growth rates
 * are NOT stored: they are derived from the published cumulative changes by
 * `annualisedFromCumulative` below, so a stored CAGR can never drift out of
 * agreement with the figure it came from.
 *
 * Source: cotality-hvi (see src/data/sources.ts)
 */

const COTALITY = 'cotality-hvi';

/**
 * Convert a published cumulative change into a compound annual growth rate.
 * `(1 + change)^(1/years) - 1`, in percentage terms.
 *
 * Exported because the projection code and the data verifier both need to agree
 * on exactly one definition of this.
 */
export function annualisedFromCumulative(
  cumulativeChangePct: number,
  years: number,
): number {
  if (years <= 0) throw new Error('years must be positive');
  const ratio = 1 + cumulativeChangePct / 100;
  // A region cannot lose more than all of its value; guard anyway so bad data
  // surfaces as an error rather than NaN propagating into the hero number.
  if (ratio <= 0) throw new Error('cumulative change implies non-positive value');
  return (Math.pow(ratio, 1 / years) - 1) * 100;
}

/** Shape of the raw transcription, before derived fields are added. */
interface PublishedRegion {
  id: string;
  name: string;
  type: Region['type'];
  parentId: string | null;
  /** [median, annual % change, gross rental yield %] per type, as published. */
  house: [number, number, number];
  unit: [number, number, number];
  dwelling: [number, number, number];
  /** Published cumulative change, dwellings basis. Null where unpublished. */
  fiveYearChangePct: number | null;
  tenYearChangePct: number | null;
}

function defineRegion(p: PublishedRegion): Region {
  const price = (v: [number, number, number]) => ({
    median: v[0],
    annualChangePct: v[1],
    grossYieldPct: v[2],
  });
  const prices: Record<PropertyType, ReturnType<typeof price>> = {
    house: price(p.house),
    unit: price(p.unit),
    dwelling: price(p.dwelling),
  };

  return {
    id: p.id,
    name: p.name,
    type: p.type,
    parentId: p.parentId,
    prices,
    growth: {
      fiveYearChangePct: p.fiveYearChangePct,
      tenYearChangePct: p.tenYearChangePct,
      fiveYearCagrPct:
        p.fiveYearChangePct === null
          ? null
          : annualisedFromCumulative(p.fiveYearChangePct, 5),
      tenYearCagrPct:
        p.tenYearChangePct === null
          ? null
          : annualisedFromCumulative(p.tenYearChangePct, 10),
      // Cotality publishes long-run change on a dwellings basis only. The UI
      // discloses this when the user is viewing houses or units.
      basis: 'dwelling',
    },
    sourceIds: [COTALITY],
  };
}

export const CAPITAL_REGIONS: readonly Region[] = [
  defineRegion({
    id: 'au',
    name: 'Australia (national)',
    type: 'national',
    parentId: null,
    house: [1_025_085, 7.8, 3.4],
    unit: [752_007, 5.6, 4.5],
    dwelling: [937_722, 7.3, 3.7],
    fiveYearChangePct: 31.3,
    tenYearChangePct: 73.7,
  }),
  defineRegion({
    id: 'sydney',
    name: 'Sydney',
    type: 'capital',
    parentId: 'au',
    house: [1_556_258, -0.1, 2.8],
    unit: [898_623, 1.1, 4.3],
    dwelling: [1_265_608, 0.3, 3.3],
    fiveYearChangePct: 12.9,
    tenYearChangePct: 54.1,
  }),
  defineRegion({
    id: 'melbourne',
    name: 'Melbourne',
    type: 'capital',
    parentId: 'au',
    house: [948_482, -1.2, 3.4],
    unit: [637_170, -0.2, 5.1],
    dwelling: [808_486, -0.9, 3.9],
    fiveYearChangePct: 1.2,
    tenYearChangePct: 32.2,
  }),
  defineRegion({
    id: 'brisbane',
    name: 'Brisbane',
    type: 'capital',
    parentId: 'au',
    house: [1_225_350, 16.8, 3.1],
    unit: [885_132, 20.3, 3.9],
    dwelling: [1_118_306, 17.4, 3.3],
    fiveYearChangePct: 76.6,
    tenYearChangePct: 119.0,
  }),
  defineRegion({
    id: 'perth',
    name: 'Perth',
    type: 'capital',
    parentId: 'au',
    house: [1_093_431, 23.6, 3.6],
    unit: [773_605, 26.3, 4.7],
    dwelling: [1_046_551, 23.9, 3.7],
    fiveYearChangePct: 89.6,
    tenYearChangePct: 109.4,
  }),
  defineRegion({
    id: 'adelaide',
    name: 'Adelaide',
    type: 'capital',
    parentId: 'au',
    house: [1_008_736, 11.5, 3.3],
    unit: [695_151, 11.7, 4.3],
    dwelling: [945_868, 11.6, 3.5],
    fiveYearChangePct: 72.0,
    tenYearChangePct: 111.4,
  }),
  defineRegion({
    id: 'hobart',
    name: 'Hobart',
    type: 'capital',
    parentId: 'au',
    house: [803_094, 9.7, 4.3],
    unit: [587_749, 7.5, 4.8],
    dwelling: [752_760, 9.3, 4.4],
    fiveYearChangePct: 17.3,
    tenYearChangePct: 95.8,
  }),
  defineRegion({
    id: 'canberra',
    name: 'Canberra',
    type: 'capital',
    parentId: 'au',
    house: [1_035_828, 3.5, 3.8],
    unit: [597_430, 0.7, 5.4],
    dwelling: [885_254, 2.9, 4.2],
    fiveYearChangePct: 12.9,
    tenYearChangePct: 62.8,
  }),
  defineRegion({
    id: 'darwin',
    name: 'Darwin',
    type: 'capital',
    parentId: 'au',
    house: [766_350, 19.3, 5.6],
    unit: [472_572, 20.9, 7.1],
    dwelling: [638_187, 19.8, 6.1],
    fiveYearChangePct: 33.4,
    tenYearChangePct: 33.6,
  }),
];
