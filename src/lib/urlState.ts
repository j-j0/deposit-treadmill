import type { DisplayPropertyType } from '../data/types';
import type { GrowthBasis } from '../data/assumptions';

/**
 * Inputs encoded into the URL hash, so the page is a single shareable link that
 * restores the reader's exact scenario. The hash (not the query string) keeps it
 * client-side — nothing about someone's savings is ever sent to a server, which
 * matters for a tool that asks about personal finances.
 *
 * Two fields are `number | null`, where null means "derive the default from the
 * selected city and property type" (implied market rent; type-aware ownership
 * costs). Null is encoded by omission, so links stay short and old v1 links —
 * which lack every v2 key — decode into a fully working v2 state.
 */

/** The five sections. Kept here because it round-trips through the URL. */
export type TabId = 'deposit' | 'mortgage' | 'rentvsbuy' | 'assumptions' | 'sources';

export const TAB_IDS: readonly TabId[] = [
  'deposit',
  'mortgage',
  'rentvsbuy',
  'assumptions',
  'sources',
];

/** Owner-occupier or investment purchase — changes the rate and the lender's test. */
export type PurchasePurpose = 'owner' | 'investment';

export const PURCHASE_PURPOSES: readonly PurchasePurpose[] = ['owner', 'investment'];

export interface AppState {
  /** Which section is open. In the URL so a shared link lands where you meant. */
  tab: TabId;
  purpose: PurchasePurpose;
  regionId: string;
  propertyType: DisplayPropertyType;
  income: number;
  currentSavings: number;
  monthlySavings: number;
  growthBasis: GrowthBasis;
  customGrowthPct: number;
  depositPct: number;
  savingsReturnPct: number;

  // v2 — mortgage
  /** Null = follow the published rate for the selected purpose. */
  mortgageRatePct: number | null;
  loanTermYears: number;
  rentalShadingPct: number;
  maxLvrPct: number;
  extraRepaymentMonthly: number;
  repaymentSharePct: number;
  upfrontCostsPct: number;
  lmiCost: number;
  /** Income from letting rooms (or the whole place) while owning, $/week. */
  rentalIncomeWeekly: number;

  // v2 — renting side
  /** Renter's weekly rent. Null = use the implied market rent for the selection. */
  rentWeekly: number | null;
  rentGrowthPct: number;
  /** Null = type-aware default (1.0% houses, 1.5% strata). */
  ownershipCostsPct: number | null;
  horizonYears: number;
}

const KEYS = {
  tab: 'tab',
  purpose: 'p',
  rentalShadingPct: 'sh',
  maxLvrPct: 'lvr',
  regionId: 'r',
  propertyType: 't',
  income: 'i',
  currentSavings: 's',
  monthlySavings: 'm',
  growthBasis: 'b',
  customGrowthPct: 'g',
  depositPct: 'd',
  savingsReturnPct: 'y',
  mortgageRatePct: 'mr',
  loanTermYears: 'lt',
  extraRepaymentMonthly: 'x',
  repaymentSharePct: 'rs',
  upfrontCostsPct: 'uc',
  lmiCost: 'lc',
  rentalIncomeWeekly: 'ri',
  rentWeekly: 'rw',
  rentGrowthPct: 'rg',
  ownershipCostsPct: 'oc',
  horizonYears: 'h',
} as const satisfies Record<keyof AppState, string>;

const PROPERTY_TYPES: readonly DisplayPropertyType[] = [
  'house',
  'townhouse',
  'unit',
  'dwelling',
];
const GROWTH_BASES: readonly GrowthBasis[] = ['tenYear', 'fiveYear', 'twelveMonth', 'custom'];

export function encodeState(state: AppState): string {
  const params = new URLSearchParams();
  const setNum = (key: string, value: number, digits = 0) =>
    params.set(key, digits > 0 ? value.toFixed(digits) : String(Math.round(value)));

  params.set(KEYS.tab, state.tab);
  params.set(KEYS.purpose, state.purpose);
  params.set(KEYS.regionId, state.regionId);
  params.set(KEYS.propertyType, state.propertyType);
  setNum(KEYS.income, state.income);
  setNum(KEYS.currentSavings, state.currentSavings);
  setNum(KEYS.monthlySavings, state.monthlySavings);
  params.set(KEYS.growthBasis, state.growthBasis);
  setNum(KEYS.customGrowthPct, state.customGrowthPct, 2);
  setNum(KEYS.depositPct, state.depositPct, 2);
  setNum(KEYS.savingsReturnPct, state.savingsReturnPct, 2);

  setNum(KEYS.loanTermYears, state.loanTermYears);
  setNum(KEYS.rentalShadingPct, state.rentalShadingPct);
  setNum(KEYS.maxLvrPct, state.maxLvrPct);
  setNum(KEYS.extraRepaymentMonthly, state.extraRepaymentMonthly);
  setNum(KEYS.repaymentSharePct, state.repaymentSharePct);
  setNum(KEYS.upfrontCostsPct, state.upfrontCostsPct, 2);
  setNum(KEYS.lmiCost, state.lmiCost);
  setNum(KEYS.rentalIncomeWeekly, state.rentalIncomeWeekly);
  setNum(KEYS.rentGrowthPct, state.rentGrowthPct, 2);
  setNum(KEYS.horizonYears, state.horizonYears);

  // Auto-derived fields: encoded only when the user has overridden them.
  if (state.mortgageRatePct !== null) setNum(KEYS.mortgageRatePct, state.mortgageRatePct, 2);
  if (state.rentWeekly !== null) setNum(KEYS.rentWeekly, state.rentWeekly);
  if (state.ownershipCostsPct !== null) setNum(KEYS.ownershipCostsPct, state.ownershipCostsPct, 2);

  return params.toString();
}

function num(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNum(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Does this hash look like one of ours?
 *
 * Anything else on the page that writes to `location.hash` — a plain anchor
 * link, a browser find-on-page jump — would otherwise be read back as an empty
 * state and silently reset every field the reader had entered. Requiring the
 * region key means a foreign hash is ignored rather than obeyed.
 */
export function isAppStateHash(hash: string): boolean {
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!cleaned) return false;
  return new URLSearchParams(cleaned).has(KEYS.regionId);
}

/** Decode, falling back to `defaults` for anything missing or malformed. */
export function decodeState(hash: string, defaults: AppState): AppState {
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!cleaned) return defaults;

  const params = new URLSearchParams(cleaned);

  const rawPurpose = params.get(KEYS.purpose);
  const purpose = PURCHASE_PURPOSES.includes(rawPurpose as PurchasePurpose)
    ? (rawPurpose as PurchasePurpose)
    : defaults.purpose;

  const rawTab = params.get(KEYS.tab);
  const tab = TAB_IDS.includes(rawTab as TabId) ? (rawTab as TabId) : defaults.tab;

  const rawType = params.get(KEYS.propertyType);
  const propertyType = PROPERTY_TYPES.includes(rawType as DisplayPropertyType)
    ? (rawType as DisplayPropertyType)
    : defaults.propertyType;

  const rawBasis = params.get(KEYS.growthBasis);
  const growthBasis = GROWTH_BASES.includes(rawBasis as GrowthBasis)
    ? (rawBasis as GrowthBasis)
    : defaults.growthBasis;

  return {
    tab,
    purpose,
    regionId: params.get(KEYS.regionId) ?? defaults.regionId,
    propertyType,
    income: num(params, KEYS.income, defaults.income),
    currentSavings: num(params, KEYS.currentSavings, defaults.currentSavings),
    monthlySavings: num(params, KEYS.monthlySavings, defaults.monthlySavings),
    growthBasis,
    customGrowthPct: num(params, KEYS.customGrowthPct, defaults.customGrowthPct),
    depositPct: num(params, KEYS.depositPct, defaults.depositPct),
    savingsReturnPct: num(params, KEYS.savingsReturnPct, defaults.savingsReturnPct),

    mortgageRatePct: nullableNum(params, KEYS.mortgageRatePct),
    loanTermYears: num(params, KEYS.loanTermYears, defaults.loanTermYears),
    rentalShadingPct: num(params, KEYS.rentalShadingPct, defaults.rentalShadingPct),
    maxLvrPct: num(params, KEYS.maxLvrPct, defaults.maxLvrPct),
    extraRepaymentMonthly: num(params, KEYS.extraRepaymentMonthly, defaults.extraRepaymentMonthly),
    repaymentSharePct: num(params, KEYS.repaymentSharePct, defaults.repaymentSharePct),
    upfrontCostsPct: num(params, KEYS.upfrontCostsPct, defaults.upfrontCostsPct),
    lmiCost: num(params, KEYS.lmiCost, defaults.lmiCost),
    rentalIncomeWeekly: num(params, KEYS.rentalIncomeWeekly, defaults.rentalIncomeWeekly),
    rentWeekly: nullableNum(params, KEYS.rentWeekly),
    rentGrowthPct: num(params, KEYS.rentGrowthPct, defaults.rentGrowthPct),
    ownershipCostsPct: nullableNum(params, KEYS.ownershipCostsPct),
    horizonYears: num(params, KEYS.horizonYears, defaults.horizonYears),
  };
}

export function readStateFromLocation(defaults: AppState): AppState {
  if (typeof window === 'undefined') return defaults;
  return decodeState(window.location.hash, defaults);
}

/** replaceState, not pushState — typing in a field should not fill the back button. */
export function writeStateToLocation(state: AppState): void {
  if (typeof window === 'undefined') return;
  const encoded = encodeState(state);
  window.history.replaceState(null, '', `${window.location.pathname}#${encoded}`);
}

export function shareableUrl(state: AppState): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${encodeState(state)}`;
}
