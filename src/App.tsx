import { useEffect, useMemo, useState } from 'react';
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
  readStateFromLocation,
  writeStateToLocation,
  type AppState,
} from './lib/urlState';
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
import { currency } from './lib/format';

const PROPERTY_NOUN: Record<DisplayPropertyType, string> = {
  house: 'house',
  townhouse: 'townhouse',
  unit: 'unit',
  dwelling: 'dwelling',
};

const DEFAULT_STATE: AppState = {
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

  const region =
    CAPITAL_REGIONS.find((r) => r.id === state.regionId) ??
    CAPITAL_REGIONS.find((r) => r.id === DEFAULT_REGION_ID)!;

  const dataType = dataTypeFor(state.propertyType);

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
    resolveGrowth(region, state.growthBasis, dataType, state.customGrowthPct).then((resolved) => {
      if (!cancelled) setGrowth(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [region, state.growthBasis, dataType, state.customGrowthPct]);

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

  // ---- v2 derived figures --------------------------------------------------

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
    [loan, state.mortgageRatePct, state.loanTermYears, state.extraRepaymentMonthly, state.rentalIncomeWeekly],
  );

  // The same mortgage if bought at the moment the projection says the deposit
  // target is reached — the goalposts move for the loan too.
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
      }),
    };
  }, [projection, state.depositPct, state.lmiCost, state.mortgageRatePct, state.loanTermYears]);

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
    <div className="app">
      <header className="masthead">
        <h1>Are you gaining or losing ground on a deposit?</h1>
        <p>
          Every deposit calculator asks how many years it takes to save one. This asks a different
          question: over the next year, does the deposit target move away from you faster than you
          move toward it? The gap between those two speeds is the whole story — and it belongs to
          the market, not to the saver. Then, past the deposit: the mortgage, what a lender’s test
          allows, and whether renting beats buying at all.
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

      <InputPanel state={state} regions={CAPITAL_REGIONS} region={region} onChange={onChange} />

      <GoalpostPanel
        projection={projection}
        treadmill={treadmill}
        regionName={region.name}
        propertyTypeLabel={propertyNoun}
      />

      <TrajectoryChart projection={projection} regionName={region.name} />

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

      {growth && (
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

      {growth && (
        <AssumptionsPanel
          state={state}
          growth={growth}
          propertyTypeLabel={propertyNoun + 's'}
          impliedRentWeekly={impliedRent}
          ownershipDefaultPct={ownershipDefault}
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
  );
}
