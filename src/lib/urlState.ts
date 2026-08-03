import type { PropertyType } from '../data/types';
import type { GrowthBasis } from '../data/assumptions';

/**
 * Inputs encoded into the URL hash, so the page is a single shareable link that
 * restores the reader's exact scenario. The hash (not the query string) keeps it
 * client-side — nothing about someone's savings is ever sent to a server, which
 * matters for a tool that asks about personal finances.
 */

export interface AppState {
  regionId: string;
  propertyType: PropertyType;
  income: number;
  currentSavings: number;
  monthlySavings: number;
  growthBasis: GrowthBasis;
  customGrowthPct: number;
  depositPct: number;
  savingsReturnPct: number;
}

const KEYS: Record<keyof AppState, string> = {
  regionId: 'r',
  propertyType: 't',
  income: 'i',
  currentSavings: 's',
  monthlySavings: 'm',
  growthBasis: 'b',
  customGrowthPct: 'g',
  depositPct: 'd',
  savingsReturnPct: 'y',
};

const PROPERTY_TYPES: readonly PropertyType[] = ['house', 'unit', 'dwelling'];
const GROWTH_BASES: readonly GrowthBasis[] = ['tenYear', 'fiveYear', 'twelveMonth', 'custom'];

export function encodeState(state: AppState): string {
  const params = new URLSearchParams();
  params.set(KEYS.regionId, state.regionId);
  params.set(KEYS.propertyType, state.propertyType);
  params.set(KEYS.income, String(Math.round(state.income)));
  params.set(KEYS.currentSavings, String(Math.round(state.currentSavings)));
  params.set(KEYS.monthlySavings, String(Math.round(state.monthlySavings)));
  params.set(KEYS.growthBasis, state.growthBasis);
  params.set(KEYS.customGrowthPct, state.customGrowthPct.toFixed(2));
  params.set(KEYS.depositPct, state.depositPct.toFixed(2));
  params.set(KEYS.savingsReturnPct, state.savingsReturnPct.toFixed(2));
  return params.toString();
}

function num(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Decode, falling back to `defaults` for anything missing or malformed. */
export function decodeState(hash: string, defaults: AppState): AppState {
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!cleaned) return defaults;

  const params = new URLSearchParams(cleaned);

  const rawType = params.get(KEYS.propertyType);
  const propertyType = PROPERTY_TYPES.includes(rawType as PropertyType)
    ? (rawType as PropertyType)
    : defaults.propertyType;

  const rawBasis = params.get(KEYS.growthBasis);
  const growthBasis = GROWTH_BASES.includes(rawBasis as GrowthBasis)
    ? (rawBasis as GrowthBasis)
    : defaults.growthBasis;

  return {
    regionId: params.get(KEYS.regionId) ?? defaults.regionId,
    propertyType,
    income: num(params, KEYS.income, defaults.income),
    currentSavings: num(params, KEYS.currentSavings, defaults.currentSavings),
    monthlySavings: num(params, KEYS.monthlySavings, defaults.monthlySavings),
    growthBasis,
    customGrowthPct: num(params, KEYS.customGrowthPct, defaults.customGrowthPct),
    depositPct: num(params, KEYS.depositPct, defaults.depositPct),
    savingsReturnPct: num(params, KEYS.savingsReturnPct, defaults.savingsReturnPct),
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
