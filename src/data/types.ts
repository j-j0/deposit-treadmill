/**
 * Data layer contracts.
 *
 * Design rule for this whole directory: every number that reaches the screen is
 * either (a) a datum carrying a `sourceId` that resolves in the source registry,
 * or (b) a registered `Assumption` the user can edit. There is no third category.
 * `tests/data.test.ts` enforces this and fails the build otherwise.
 *
 * Geography is modelled as a flat registry of `Region` rows joined by `parentId`
 * rather than a capitals-shaped structure, so suburb-level data drops in as more
 * rows without restructuring anything downstream.
 */

/** Cotality publishes medians for all three separately; the UI toggles between them. */
export type PropertyType = 'house' | 'unit' | 'dwelling';

export const PROPERTY_TYPES: readonly PropertyType[] = ['house', 'unit', 'dwelling'];

/**
 * What the user can SELECT. Townhouse is a UI-level type, not a data-level one:
 * Cotality's methodology classifies strata-titled townhouses and villas inside
 * its unit segment, and publishes no separate townhouse series. Selecting
 * townhouse therefore reads the unit data, with that mapping disclosed in the
 * UI rather than hidden here.
 */
export type DisplayPropertyType = PropertyType | 'townhouse';

export const DISPLAY_PROPERTY_TYPES: readonly DisplayPropertyType[] = [
  'house',
  'townhouse',
  'unit',
  'dwelling',
];

/** The published data series a selected display type reads from. */
export function dataTypeFor(display: DisplayPropertyType): PropertyType {
  return display === 'townhouse' ? 'unit' : display;
}

/**
 * 'national' and 'capital' ship in v1. 'suburb' is defined now so the type,
 * the loader and the UI already handle it — adding suburb data is a data task,
 * not a refactor.
 */
export type RegionType = 'national' | 'capital' | 'suburb';

export type RegionScope = 'all' | 'headline' | 'capitals' | 'suburbs';

export interface PriceSeries {
  /** Median value in AUD, as published. */
  median: number;
  /** Published 12-month change, as a percentage (e.g. 17.4 means +17.4%). */
  annualChangePct: number;
  /**
   * Published gross rental yield, as a percentage (e.g. 4.3 means 4.3%).
   * Gross = annual rent ÷ value, before any costs. Null where unpublished
   * (future suburb rows may lack it).
   */
  grossYieldPct: number | null;
}

/**
 * Cumulative growth over long horizons, plus the annualised equivalents.
 *
 * Nullable throughout: Cotality publishes 5- and 10-year changes for capital
 * cities but a suburb dataset may not carry them. When null, the loader falls
 * back to `parentId`'s rate and the UI labels the figure as inherited.
 */
export interface GrowthSeries {
  /** Published cumulative change over 5 years, as a percentage. */
  fiveYearChangePct: number | null;
  /** Published cumulative change over 10 years, as a percentage. */
  tenYearChangePct: number | null;
  /** Annualised from `fiveYearChangePct`. Derived, not published. */
  fiveYearCagrPct: number | null;
  /** Annualised from `tenYearChangePct`. Derived, not published. */
  tenYearCagrPct: number | null;
  /**
   * Which property type the long-run figures describe. Cotality publishes 5/10
   * year changes on a dwellings basis only, so this is 'dwelling' for v1 data
   * and the UI discloses it when the user is viewing houses or units.
   */
  basis: PropertyType;
}

export interface Region {
  /** Stable slug: 'au', 'sydney', and later e.g. 'sydney-parramatta'. */
  id: string;
  name: string;
  type: RegionType;
  /** Suburbs point at their capital; capitals at 'au'; 'au' at null. */
  parentId: string | null;
  prices: Record<PropertyType, PriceSeries>;
  growth: GrowthSeries;
  /** Every id must resolve in the source registry. */
  sourceIds: string[];
}

/** A citable publication. Rendered in full in the sources panel. */
export interface Source {
  id: string;
  publisher: string;
  title: string;
  url: string;
  /** The period the data describes, e.g. 'As at 30 June 2026'. */
  referencePeriod: string;
  /** When the publisher released it. */
  releaseDate: string;
  /** Machine-readable form of `releaseDate`, for staleness checks. */
  releaseISO: string;
  /**
   * Typical days between releases. The app uses this to work out when a newer
   * edition should exist, so a page left up for a year says so instead of
   * presenting stale figures as current. Null for irregular publications.
   */
  cadenceDays: number | null;
  /** When we read it. */
  accessed: string;
  /**
   * True when `npm run refresh-data` keeps this source current from an official
   * API. Auto-refreshed sources are exempt from the per-source staleness check
   * — a single check on the pipeline's own last run covers them, and would be
   * the thing that actually failed. Manually transcribed sources are not exempt.
   */
  autoRefreshed: boolean;
  /** Shown alongside the citation — caveats, methodology, licensing. */
  note?: string;
}

export type AssumptionUnit = 'percent' | 'currency' | 'years';

/**
 * A number the model needs that no source can supply, because it describes the
 * user's future rather than the published past. Every one is editable and shown
 * with its rationale — never buried in the calculation.
 */
export interface Assumption {
  id: string;
  label: string;
  /** Shown under the input. Explains where the default came from. */
  rationale: string;
  defaultValue: number;
  unit: AssumptionUnit;
  min: number;
  max: number;
  step: number;
  /** Present when the default is derived from published data. */
  sourceId?: string;
}
