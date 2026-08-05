import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CAPITAL_REGIONS,
  DEFAULT_HOUSEHOLD_INCOME,
  DEFAULT_GROWTH_BASIS,
  DEFAULT_REGION_ID,
  defaultMonthlySavings,
  impliedWeeklyRent,
  ownershipCostsDefaultFor,
  PLACEHOLDER_CURRENT_SAVINGS,
  APRA_BUFFER_PP,
  RENT_GROWTH_NATIONAL_PCT,
  getAssumption,
  resolveGrowth,
  type ResolvedGrowth,
} from './data/index';
import { dataTypeFor, type DisplayPropertyType } from './data/types';
import { MORTGAGE_RATE } from './data/generated';
import { calculateTreadmill } from './lib/treadmill';
import { projectTrajectory } from './lib/projection';
import { simulateMortgage } from './lib/mortgage';
import { calculateAffordability } from './lib/affordability';
import { compareRentVsBuy } from './lib/rentVsBuy';
import {
  isAppStateHash,
  readStateFromLocation,
  writeStateToLocation,
  type AppState,
  type TabId,
} from './lib/urlState';
import { Tabs, type TabDef } from './components/Tabs';
import { ContextBar } from './components/ContextBar';
import { InputPanel } from './components/InputPanel';
import { TreadmillHero } from './components/TreadmillHero';
import { GoalpostPanel } from './components/GoalpostPanel';
import { TrajectoryChart } from './components/TrajectoryChart';
import { MortgagePanel } from './components/MortgagePanel';
import { AffordabilityPanel } from './components/AffordabilityPanel';
import { RentVsBuyPanel } from './components/RentVsBuyPanel';
import { AssumptionsPanel } from './components/AssumptionsPanel';
import { ShareCard } from './components/ShareCard';
import { SourcesPanel } from './components/SourcesPanel';
import { FreshnessBanner } from './components/FreshnessBanner';
import { SourceNavContext, AssumptionsNavContext } from './components/Citation';
import { currency } from './lib/format';

const PROPERTY_NOUN: Record<DisplayPropertyType, string> = {
  house: 'house',
  townhouse: 'townhouse',
  unit: 'unit',
  dwelling: 'dwelling',
};

const PROPERTY_PLURAL: Record<DisplayPropertyType, string> = {
  house: 'Houses',
  townhouse: 'Townhouses',
  unit: 'Units',
  dwelling: 'All dwellings',
};

const TABS: readonly TabDef<TabId>[] = [
  {
    id: 'deposit',
    label: 'The deposit',
    blurb:
      'Each year you save. Each year the deposit target moves. This is the gap between those two speeds.',
  },
  {
    id: 'mortgage',
    label: 'The mortgage',
    blurb:
      'What the loan costs once you are in — the repayment, how fast it clears, the interest total, and what a lender would actually approve.',
  },
  {
    id: 'rentvsbuy',
    label: 'Rent vs buy',
    blurb:
      'Two paths from the same starting cash and the same monthly budget. Which one leaves you better off, and after how long?',
  },
  {
    id: 'assumptions',
    label: 'Assumptions',
    blurb:
      'Every number the model needs that no source can supply. All editable — change one and every other tab updates.',
  },
  {
    id: 'sources',
    label: 'Sources',
    blurb:
      'Every figure in this calculator traces to one of these, or to an assumption you can edit.',
  },
];

const DEFAULT_STATE: AppState = {
  tab: 'deposit',
  regionId: DEFAULT_REGION_ID,
  propertyType: 'house',
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

  mortgageRatePct: MORTGAGE_RATE.valuePct,
  loanTermYears: getAssumption('loanTermYears')!.defaultValue,
  extraRepaymentMonthly: 0,
  repaymentSharePct: getAssumption('repaymentSharePct')!.defaultValue,
  upfrontCostsPct: getAssumption('upfrontCostsPct')!.defaultValue,
  lmiCost: 0,
  rentalIncomeWeekly: 0,
  rentWeekly: null, // follow the implied market rent until overridden
  rentGrowthPct: RENT_GROWTH_NATIONAL_PCT,
  ownershipCostsPct: null, // type-aware default until overridden
  horizonYears: getAssumption('horizonYears')!.defaultValue,
};

export default function App() {
  const [state, setState] = useState<AppState>(() => readStateFromLocation(DEFAULT_STATE));
  const [growth, setGrowth] = useState<ResolvedGrowth | null>(null);
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const inputsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const region =
    CAPITAL_REGIONS.find((r) => r.id === state.regionId) ??
    CAPITAL_REGIONS.find((r) => r.id === DEFAULT_REGION_ID)!;

  const dataType = dataTypeFor(state.propertyType);

  useEffect(() => {
    writeStateToLocation(state);
  }, [state]);

  // Pasting a shared link into an already-open tab changes the hash without
  // remounting. Our own writes use replaceState (no hashchange), and a hash
  // that isn't ours is ignored rather than read back as an empty state.
  useEffect(() => {
    const onHashChange = () => {
      if (!isAppStateHash(window.location.hash)) return;
      setState(readStateFromLocation(DEFAULT_STATE));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    resolveGrowth(region, state.growthBasis, dataType, state.customGrowthPct).then((resolved) => {
      if (!cancelled) setGrowth(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [region, state.growthBasis, dataType, state.customGrowthPct]);

  const setTab = useCallback((tab: TabId) => {
    setState((previous) => ({ ...previous, tab }));
    // A tab switch is a navigation: start the new section at its top rather
    // than wherever the previous one happened to be scrolled to.
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, []);

  // Citations live on every tab; clicking one opens Sources and scrolls to it.
  const navigateToSource = useCallback((sourceId: string) => {
    setState((previous) => ({ ...previous, tab: 'sources' }));
    setPendingSource(sourceId);
  }, []);

  useEffect(() => {
    if (!pendingSource) return;
    const id = requestAnimationFrame(() => {
      document
        .getElementById(`source-${pendingSource}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setPendingSource(null);
    });
    return () => cancelAnimationFrame(id);
  }, [pendingSource]);

  const navigateToAssumptions = useCallback(() => setTab('assumptions'), [setTab]);

  const median = region.prices[dataType].median;

  const inputs = useMemo(
    () => ({
      medianPrice: median,
      growthRatePct: growth?.ratePct ?? 0,
      depositPct: state.depositPct,
      currentSavings: state.currentSavings,
      monthlySavings: state.monthlySavings,
      savingsReturnPct: state.savingsReturnPct,
    }),
    [median, state, growth],
  );

  const treadmill = useMemo(() => calculateTreadmill(inputs), [inputs]);
  const projection = useMemo(() => projectTrajectory(inputs), [inputs]);

  const loan = Math.max(0, median * (1 - state.depositPct / 100) + state.lmiCost);

  const mortgage = useMemo(
    () =>
      simulateMortgage({
        principal: loan,
        annualRatePct: state.mortgageRatePct,
        termYears: state.loanTermYears,
        extraMonthly: state.extraRepaymentMonthly,
        offsetIncomeMonthly: (state.rentalIncomeWeekly * 52) / 12,
      }),
    [
      loan,
      state.mortgageRatePct,
      state.loanTermYears,
      state.extraRepaymentMonthly,
      state.rentalIncomeWeekly,
    ],
  );

  // The same mortgage if bought at the moment the projection says the deposit
  // target is reached — the goalposts move for the loan too.
  //
  // It must carry the SAME extra repayments and rental income as the buy-today
  // loan. Comparing a loan with those offsets against one without them made the
  // gap look ~16x larger than it is, which is exactly the kind of scary-but-
  // wrong number this project exists not to print.
  const mortgageAtGoalpost = useMemo(() => {
    if (projection.outcome.kind !== 'reached' || projection.outcome.month === 0) return null;
    const price = projection.outcome.priceAtReach;
    const goalLoan = Math.max(0, price * (1 - state.depositPct / 100) + state.lmiCost);
    return {
      price,
      years: projection.outcome.years,
      result: simulateMortgage({
        principal: goalLoan,
        annualRatePct: state.mortgageRatePct,
        termYears: state.loanTermYears,
        extraMonthly: state.extraRepaymentMonthly,
        offsetIncomeMonthly: (state.rentalIncomeWeekly * 52) / 12,
      }),
    };
  }, [
    projection,
    state.depositPct,
    state.lmiCost,
    state.mortgageRatePct,
    state.loanTermYears,
    state.extraRepaymentMonthly,
    state.rentalIncomeWeekly,
  ]);

  const affordability = useMemo(
    () =>
      calculateAffordability({
        annualIncome: state.income,
        repaymentSharePct: state.repaymentSharePct,
        mortgageRatePct: state.mortgageRatePct,
        bufferPp: APRA_BUFFER_PP,
        termYears: state.loanTermYears,
        savings: state.currentSavings,
        depositPct: state.depositPct,
        upfrontCostsPct: state.upfrontCostsPct,
      }),
    [state],
  );

  const impliedRent = impliedWeeklyRent(region, dataType);
  const rentWeeklyUsed = state.rentWeekly ?? impliedRent ?? 600;
  const ownershipDefault = ownershipCostsDefaultFor(state.propertyType);
  const ownershipUsed = state.ownershipCostsPct ?? ownershipDefault;

  const rentVsBuy = useMemo(
    () =>
      compareRentVsBuy({
        price: median,
        depositPct: state.depositPct,
        upfrontCostsPct: state.upfrontCostsPct,
        lmiCost: state.lmiCost,
        mortgageRatePct: state.mortgageRatePct,
        termYears: state.loanTermYears,
        extraMonthly: state.extraRepaymentMonthly,
        rentalIncomeWeekly: state.rentalIncomeWeekly,
        priceGrowthPct: growth?.ratePct ?? 0,
        ownershipCostsPct: ownershipUsed,
        rentWeekly: rentWeeklyUsed,
        rentGrowthPct: state.rentGrowthPct,
        savingsReturnPct: state.savingsReturnPct,
        horizonYears: state.horizonYears,
      }),
    [median, state, growth, ownershipUsed, rentWeeklyUsed],
  );

  const onChange = (patch: Partial<AppState>) =>
    setState((previous) => ({ ...previous, ...patch }));

  const propertyNoun = PROPERTY_NOUN[state.propertyType];

  return (
    <SourceNavContext.Provider value={navigateToSource}>
      <AssumptionsNavContext.Provider value={navigateToAssumptions}>
        <ContextBar
          regionName={region.name}
          propertyTypeLabel={PROPERTY_PLURAL[state.propertyType]}
          medianPrice={median}
          watchRef={inputsRef}
        />

        <div className="app">
          <header className="masthead">
            <h1>Are you gaining or losing ground on a deposit?</h1>
            <p>
              Every deposit calculator asks how many years it takes to save one. This asks a
              different question — and then follows it past the deposit, into the mortgage, and
              into whether buying beats renting at all.
            </p>
          </header>

          <FreshnessBanner />

          <div ref={inputsRef}>
            <InputPanel
              state={state}
              regions={CAPITAL_REGIONS}
              region={region}
              onChange={onChange}
            />
          </div>

          <Tabs tabs={TABS} active={state.tab} onChange={setTab} />

          <div
            ref={panelRef}
            role="tabpanel"
            id={`panel-${state.tab}`}
            aria-labelledby={`tab-${state.tab}`}
            tabIndex={-1}
            className="tabpanel"
          >
            {state.tab === 'deposit' && (
              <>
                {growth && (
                  <TreadmillHero
                    result={treadmill}
                    regionName={region.name}
                    growth={growth}
                    propertyTypeLabel={propertyNoun}
                  />
                )}
                <GoalpostPanel
                  projection={projection}
                  treadmill={treadmill}
                  regionName={region.name}
                  propertyTypeLabel={propertyNoun}
                />
                <TrajectoryChart projection={projection} regionName={region.name} />
                {growth && (
                  <ShareCard
                    result={treadmill}
                    regionName={region.name}
                    propertyTypeLabel={propertyNoun}
                    growth={growth}
                    state={state}
                  />
                )}
              </>
            )}

            {state.tab === 'mortgage' && (
              <>
                <MortgagePanel
                  result={mortgage}
                  atGoalpost={mortgageAtGoalpost}
                  loan={loan}
                  price={median}
                  lmiCost={state.lmiCost}
                  mortgageRatePct={state.mortgageRatePct}
                  loanTermYears={state.loanTermYears}
                  monthlyIncome={state.income / 12}
                  rentalIncomeWeekly={state.rentalIncomeWeekly}
                  extraRepaymentMonthly={state.extraRepaymentMonthly}
                  regionName={region.name}
                  propertyTypeLabel={propertyNoun}
                  projection={projection}
                />
                <AffordabilityPanel
                  result={affordability}
                  medianPrice={median}
                  regionName={region.name}
                  propertyTypeLabel={propertyNoun}
                  repaymentSharePct={state.repaymentSharePct}
                  mortgageRatePct={state.mortgageRatePct}
                  bufferPp={APRA_BUFFER_PP}
                  depositPct={state.depositPct}
                />
              </>
            )}

            {state.tab === 'rentvsbuy' && growth && (
              <RentVsBuyPanel
                result={rentVsBuy}
                horizonYears={state.horizonYears}
                regionName={region.name}
                growthProvenance={growth.provenance}
                mortgageRatePct={state.mortgageRatePct}
                rentWeeklyUsed={rentWeeklyUsed}
                rentIsDerived={state.rentWeekly === null}
              />
            )}

            {state.tab === 'assumptions' && growth && (
              <AssumptionsPanel
                state={state}
                growth={growth}
                propertyTypeLabel={propertyNoun + 's'}
                impliedRentWeekly={impliedRent}
                ownershipDefaultPct={ownershipDefault}
                onChange={onChange}
              />
            )}

            {state.tab === 'sources' && <SourcesPanel />}
          </div>

          <footer className="footer">
            <p>
              Median {propertyNoun} value in {region.name} is {currency(median)}, from the Cotality
              Home Value Index as at 30 June 2026. Price data © 2026 RP Data Pty Ltd t/as Cotality,
              reproduced from the public monthly index release.
            </p>
            <p>
              This is an illustration of mechanisms, not financial advice. Stamp duty and LMI enter
              only as your editable assumptions; tax (CGT, negative gearing, tax on interest) is
              disclosed rather than modelled. Your numbers stay in your browser — the inputs are
              encoded in the URL and nothing is sent anywhere.
            </p>
          </footer>
        </div>
      </AssumptionsNavContext.Provider>
    </SourceNavContext.Provider>
  );
}
