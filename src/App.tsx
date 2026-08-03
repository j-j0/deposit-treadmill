import { useEffect, useMemo, useState } from 'react';
import {
  CAPITAL_REGIONS,
  DEFAULT_HOUSEHOLD_INCOME,
  DEFAULT_GROWTH_BASIS,
  DEFAULT_PROPERTY_TYPE,
  DEFAULT_REGION_ID,
  defaultMonthlySavings,
  PLACEHOLDER_CURRENT_SAVINGS,
  getAssumption,
  resolveGrowth,
  type ResolvedGrowth,
} from './data/index';
import type { PropertyType } from './data/types';
import { calculateTreadmill } from './lib/treadmill';
import { projectTrajectory } from './lib/projection';
import {
  readStateFromLocation,
  writeStateToLocation,
  type AppState,
} from './lib/urlState';
import { InputPanel } from './components/InputPanel';
import { TreadmillHero } from './components/TreadmillHero';
import { GoalpostPanel } from './components/GoalpostPanel';
import { TrajectoryChart } from './components/TrajectoryChart';
import { AssumptionsPanel } from './components/AssumptionsPanel';
import { ShareCard } from './components/ShareCard';
import { SourcesPanel } from './components/SourcesPanel';
import { FreshnessBanner } from './components/FreshnessBanner';
import { currency } from './lib/format';

const PROPERTY_NOUN: Record<PropertyType, string> = {
  house: 'house',
  unit: 'unit',
  dwelling: 'dwelling',
};

const DEFAULT_STATE: AppState = {
  regionId: DEFAULT_REGION_ID,
  propertyType: DEFAULT_PROPERTY_TYPE,
  income: DEFAULT_HOUSEHOLD_INCOME,
  // A household on average earnings saving at the national average rate. Both
  // are starting points the user replaces; see src/data/assumptions.ts for why
  // these particular values and what they do and don't represent.
  currentSavings: PLACEHOLDER_CURRENT_SAVINGS,
  monthlySavings: defaultMonthlySavings(DEFAULT_HOUSEHOLD_INCOME),
  growthBasis: DEFAULT_GROWTH_BASIS,
  customGrowthPct: 5,
  depositPct: getAssumption('depositPct')!.defaultValue,
  savingsReturnPct: getAssumption('savingsReturnPct')!.defaultValue,
};

export default function App() {
  const [state, setState] = useState<AppState>(() => readStateFromLocation(DEFAULT_STATE));
  const [growth, setGrowth] = useState<ResolvedGrowth | null>(null);

  const region =
    CAPITAL_REGIONS.find((r) => r.id === state.regionId) ??
    CAPITAL_REGIONS.find((r) => r.id === DEFAULT_REGION_ID)!;

  useEffect(() => {
    writeStateToLocation(state);
  }, [state]);

  // Pasting a shared link into an already-open tab changes the hash without
  // remounting, so without this the page would keep showing the old scenario.
  // Our own writes use replaceState, which does not fire hashchange — no loop.
  useEffect(() => {
    const onHashChange = () => setState(readStateFromLocation(DEFAULT_STATE));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    resolveGrowth(region, state.growthBasis, state.propertyType, state.customGrowthPct).then(
      (resolved) => {
        if (!cancelled) setGrowth(resolved);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [region, state.growthBasis, state.propertyType, state.customGrowthPct]);

  const inputs = useMemo(
    () => ({
      medianPrice: region.prices[state.propertyType].median,
      growthRatePct: growth?.ratePct ?? 0,
      depositPct: state.depositPct,
      currentSavings: state.currentSavings,
      monthlySavings: state.monthlySavings,
      savingsReturnPct: state.savingsReturnPct,
    }),
    [region, state, growth],
  );

  const treadmill = useMemo(() => calculateTreadmill(inputs), [inputs]);
  const projection = useMemo(() => projectTrajectory(inputs), [inputs]);

  const onChange = (patch: Partial<AppState>) =>
    setState((previous) => ({ ...previous, ...patch }));

  const propertyNoun = PROPERTY_NOUN[state.propertyType];

  return (
    <div className="app">
      <header className="masthead">
        <h1>Are you gaining or losing ground on a deposit?</h1>
        <p>
          Every deposit calculator asks how many years it takes to save one. This asks a different
          question: over the next year, does the deposit target move away from you faster than you
          move toward it? The gap between those two speeds is the whole story — and it belongs to
          the market, not to the saver.
        </p>
      </header>

      <FreshnessBanner />

      {growth && (
        <TreadmillHero
          result={treadmill}
          regionName={region.name}
          growth={growth}
          propertyTypeLabel={propertyNoun}
        />
      )}

      <InputPanel
        state={state}
        regions={CAPITAL_REGIONS}
        region={region}
        onChange={onChange}
      />

      <GoalpostPanel
        projection={projection}
        treadmill={treadmill}
        regionName={region.name}
        propertyTypeLabel={propertyNoun}
      />

      <TrajectoryChart projection={projection} regionName={region.name} />

      {growth && (
        <AssumptionsPanel
          state={state}
          growth={growth}
          propertyTypeLabel={PROPERTY_NOUN[state.propertyType] + 's'}
          onChange={onChange}
        />
      )}

      {growth && (
        <ShareCard
          result={treadmill}
          regionName={region.name}
          propertyTypeLabel={propertyNoun}
          growth={growth}
          state={state}
        />
      )}

      <SourcesPanel />

      <footer className="footer">
        <p>
          Median {propertyNoun} value in {region.name} is{' '}
          {currency(region.prices[state.propertyType].median)}, from the Cotality Home Value Index
          as at 30 June 2026. Price data © 2026 RP Data Pty Ltd t/as Cotality, reproduced from the
          public monthly index release.
        </p>
        <p>
          This is an illustration of one mechanism, not financial advice. It models a deposit
          target as a percentage of a median value and does not include stamp duty, lenders
          mortgage insurance, first-home buyer schemes, transaction costs, or tax on savings
          interest. Your numbers stay in your browser — the inputs are encoded in the URL and
          nothing is sent anywhere.
        </p>
      </footer>
    </div>
  );
}
