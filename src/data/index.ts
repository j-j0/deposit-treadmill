import { CAPITAL_REGIONS } from './regions.capitals';
import type { PropertyType, Region, RegionScope } from './types';
import type { GrowthBasis } from './assumptions';

export * from './types';
export * from './sources';
export * from './assumptions';
export { annualisedFromCumulative, CAPITAL_REGIONS } from './regions.capitals';
export { ABS_MEAN_DWELLING_PRICES, ABS_CROSSCHECK_SOURCE_ID } from './crosscheck.abs';

/**
 * Region loader.
 *
 * Async from day one even though v1 resolves synchronously. A suburb dataset is
 * far too large to ship in the main bundle, so when it lands it becomes a
 * dynamic `import()` behind this same signature — code-split, fetched only when
 * a user opens the suburb picker, and invisible to every caller. Making the API
 * async later would be a breaking change through the whole component tree;
 * making it async now costs nothing.
 */

let suburbCache: Region[] | null = null;

async function loadSuburbs(): Promise<Region[]> {
  if (suburbCache) return suburbCache;
  // v1 ships no suburb data. The dynamic import goes here:
  //   const mod = await import('./regions.suburbs');
  //   suburbCache = mod.SUBURB_REGIONS;
  suburbCache = [];
  return suburbCache;
}

export async function listRegions(scope: RegionScope = 'headline'): Promise<Region[]> {
  switch (scope) {
    case 'headline':
    case 'capitals':
      return [...CAPITAL_REGIONS];
    case 'suburbs':
      return loadSuburbs();
    case 'all':
      return [...CAPITAL_REGIONS, ...(await loadSuburbs())];
  }
}

export async function getRegion(id: string): Promise<Region | null> {
  const all = await listRegions('all');
  return all.find((r) => r.id === id) ?? null;
}

/** Synchronous lookup for the regions guaranteed to be in the main bundle. */
export function getCapitalRegion(id: string): Region | null {
  return CAPITAL_REGIONS.find((r) => r.id === id) ?? null;
}

export const DEFAULT_REGION_ID = 'sydney';
export const DEFAULT_PROPERTY_TYPE: PropertyType = 'house';

/**
 * The resolved growth rate, plus everything the UI needs to be honest about
 * where it came from. Never returns a bare number: a rate without its
 * provenance is exactly the magic number this project is trying to avoid.
 */
export interface ResolvedGrowth {
  ratePct: number;
  basis: GrowthBasis;
  /** Human-readable description of the underlying published figure. */
  provenance: string;
  sourceId: string | null;
  /**
   * True when the long-run rate describes dwellings but the user is viewing
   * houses or units. Cotality publishes 5/10-year change on a dwellings basis
   * only. The UI must surface this, not swallow it.
   */
  basisMismatch: boolean;
  /** True when the figure was inherited from a parent region (future suburbs). */
  inheritedFrom: string | null;
}

/**
 * Resolve the growth rate for a region under a given basis.
 *
 * Falls back up the `parentId` chain when a region lacks long-run data — the
 * path a suburb will take — and reports having done so rather than hiding it.
 */
export async function resolveGrowth(
  region: Region,
  basis: GrowthBasis,
  propertyType: PropertyType,
  customRatePct: number,
): Promise<ResolvedGrowth> {
  if (basis === 'custom') {
    return {
      ratePct: customRatePct,
      basis,
      provenance: 'Your own figure',
      sourceId: null,
      basisMismatch: false,
      inheritedFrom: null,
    };
  }

  if (basis === 'twelveMonth') {
    const series = region.prices[propertyType];
    return {
      ratePct: series.annualChangePct,
      basis,
      provenance: `Published 12-month change to 30 June 2026 for ${region.name} ${propertyType === 'dwelling' ? 'dwellings' : propertyType + 's'}`,
      sourceId: region.sourceIds[0] ?? null,
      basisMismatch: false,
      inheritedFrom: null,
    };
  }

  // Long-run bases: walk up to a region that publishes the figure.
  let current: Region | null = region;
  let inheritedFrom: string | null = null;

  while (current) {
    const cumulative =
      basis === 'tenYear' ? current.growth.tenYearChangePct : current.growth.fiveYearChangePct;
    const cagr =
      basis === 'tenYear' ? current.growth.tenYearCagrPct : current.growth.fiveYearCagrPct;

    if (cumulative !== null && cagr !== null) {
      const years = basis === 'tenYear' ? 10 : 5;
      return {
        ratePct: cagr,
        basis,
        provenance: `${cumulative.toFixed(1)}% total growth over ${years} years in ${current.name}, annualised`,
        sourceId: current.sourceIds[0] ?? null,
        basisMismatch: propertyType !== current.growth.basis,
        inheritedFrom,
      };
    }

    if (!current.parentId) break;
    inheritedFrom = current.parentId;
    current = await getRegion(current.parentId);
  }

  // No long-run figure anywhere up the chain — fall back to the published
  // 12-month change rather than inventing one.
  const series = region.prices[propertyType];
  return {
    ratePct: series.annualChangePct,
    basis: 'twelveMonth',
    provenance: `No long-run figure published for ${region.name}; using its 12-month change instead`,
    sourceId: region.sourceIds[0] ?? null,
    basisMismatch: false,
    inheritedFrom,
  };
}
