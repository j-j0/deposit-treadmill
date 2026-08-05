import type { AppState } from '../lib/urlState';
import type { ResolvedGrowth } from '../data/index';
import type { Assumption } from '../data/types';
import {
  GROWTH_BASIS_OPTIONS,
  MORTGAGE_ASSUMPTIONS,
  RENTING_ASSUMPTIONS,
  getAssumption,
  type GrowthBasis,
} from '../data/assumptions';
import { currency, percent } from '../lib/format';
import { AssumptionBadge, Citation } from './Citation';

/**
 * Every assumption, visible and editable, with its rationale next to it.
 *
 * Nothing here is buried behind a "advanced" disclosure: the growth rate is the
 * single most consequential number in the model, and a tool that hides it is
 * asking to be believed rather than checked.
 */

interface Props {
  state: AppState;
  growth: ResolvedGrowth;
  propertyTypeLabel: string;
  /** Implied market rent for the current selection, for the auto note. */
  impliedRentWeekly: number | null;
  /** Type-aware ownership-costs default in force when no override is set. */
  ownershipDefaultPct: number;
  onChange: (patch: Partial<AppState>) => void;
}

/** State keys whose assumptions render as plain sliders. */
type SliderKey =
  | 'mortgageRatePct'
  | 'loanTermYears'
  | 'extraRepaymentMonthly'
  | 'repaymentSharePct'
  | 'upfrontCostsPct'
  | 'rentGrowthPct'
  | 'horizonYears';

function formatValue(assumption: Assumption, value: number): string {
  switch (assumption.unit) {
    case 'currency':
      return currency(value);
    case 'years':
      return `${value} yr`;
    default:
      return percent(value, assumption.step < 1 ? 2 : 0);
  }
}

function SliderAssumption({
  assumption,
  value,
  onChange,
}: {
  assumption: Assumption;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="assumption">
      <div className="assumption__head">
        <span className="assumption__title">
          {assumption.label}
          {assumption.sourceId ? <Citation sourceId={assumption.sourceId} /> : null}
        </span>
        <AssumptionBadge />
      </div>
      <div className="assumption__control">
        <input
          type="range"
          min={assumption.min}
          max={assumption.max}
          step={assumption.step}
          value={value}
          aria-label={assumption.label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="assumption__value">{formatValue(assumption, value)}</span>
      </div>
      <p className="assumption__rationale">{assumption.rationale}</p>
    </div>
  );
}

export function AssumptionsPanel({
  state,
  growth,
  propertyTypeLabel,
  impliedRentWeekly,
  ownershipDefaultPct,
  onChange,
}: Props) {
  const slider = (id: SliderKey) => {
    const assumption = MORTGAGE_ASSUMPTIONS.concat(RENTING_ASSUMPTIONS).find((a) => a.id === id)!;
    return (
      <SliderAssumption
        key={id}
        assumption={assumption}
        value={state[id]}
        onChange={(value) => onChange({ [id]: value })}
      />
    );
  };

  const depositAssumption = getAssumption('depositPct')!;
  const returnAssumption = getAssumption('savingsReturnPct')!;
  const growthAssumption = getAssumption('growthRatePct')!;

  const selectedBasis = GROWTH_BASIS_OPTIONS.find((o) => o.id === growth.basis);

  return (
    <section className="card" aria-labelledby="assumptions-heading">
      <h2 id="assumptions-heading">Assumptions — all editable</h2>

      {/* Growth rate */}
      <div className="assumption">
        <div className="assumption__head">
          <span className="assumption__title">{growthAssumption.label}</span>
          <AssumptionBadge />
        </div>

        <div className="segmented" role="group" aria-label="Growth rate basis">
          {GROWTH_BASIS_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={state.growthBasis === option.id}
              onClick={() => {
                const patch: Partial<AppState> = { growthBasis: option.id as GrowthBasis };
                // Seed the custom field from whatever is on screen, so switching
                // to "Set my own" starts where the user was rather than at zero.
                if (option.id === 'custom') patch.customGrowthPct = Number(growth.ratePct.toFixed(2));
                onChange(patch);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {state.growthBasis === 'custom' ? (
          <div className="assumption__control" style={{ marginTop: 14 }}>
            <input
              type="range"
              min={growthAssumption.min}
              max={growthAssumption.max}
              step={growthAssumption.step}
              value={state.customGrowthPct}
              aria-label="Annual house price growth"
              onChange={(e) => onChange({ customGrowthPct: Number(e.target.value) })}
            />
            <span className="assumption__value">{percent(state.customGrowthPct)}</span>
          </div>
        ) : (
          <div className="assumption__control" style={{ marginTop: 14 }}>
            <span className="assumption__value" style={{ minWidth: 0 }}>
              {percent(growth.ratePct)}
            </span>
            <span className="field__hint">
              {growth.provenance}
              {growth.sourceId ? <Citation sourceId={growth.sourceId} /> : null}
            </span>
          </div>
        )}

        <p className="assumption__rationale">
          {selectedBasis?.description ?? growthAssumption.rationale}
        </p>

        {growth.basisMismatch && (
          <div className="disclosure">
            <strong>Worth knowing:</strong> Cotality publishes 5- and 10-year change on an
            all-dwellings basis only, so this long-run rate describes dwellings while you are
            viewing {propertyTypeLabel.toLowerCase()}. Houses and units have moved at different
            speeds over that period. Switch to “Last 12 months” for a figure specific to{' '}
            {propertyTypeLabel.toLowerCase()}, or to “All dwellings” above to remove the mismatch.
          </div>
        )}

        {growth.inheritedFrom && (
          <div className="disclosure">
            No long-run figure is published for this area; the rate shown is inherited from{' '}
            {growth.inheritedFrom}.
          </div>
        )}
      </div>

      {/* Deposit percentage */}
      <div className="assumption">
        <div className="assumption__head">
          <span className="assumption__title">{depositAssumption.label}</span>
          <AssumptionBadge />
        </div>
        <div className="assumption__control">
          <input
            type="range"
            min={depositAssumption.min}
            max={depositAssumption.max}
            step={depositAssumption.step}
            value={state.depositPct}
            aria-label={depositAssumption.label}
            onChange={(e) => onChange({ depositPct: Number(e.target.value) })}
          />
          <span className="assumption__value">{percent(state.depositPct, 1)}</span>
        </div>
        <p className="assumption__rationale">{depositAssumption.rationale}</p>
      </div>

      {/* Savings return */}
      <div className="assumption">
        <div className="assumption__head">
          <span className="assumption__title">
            {returnAssumption.label}
            {returnAssumption.sourceId ? (
              <Citation sourceId={returnAssumption.sourceId} />
            ) : null}
          </span>
          <AssumptionBadge />
        </div>
        <div className="assumption__control">
          <input
            type="range"
            min={returnAssumption.min}
            max={returnAssumption.max}
            step={returnAssumption.step}
            value={state.savingsReturnPct}
            aria-label={returnAssumption.label}
            onChange={(e) => onChange({ savingsReturnPct: Number(e.target.value) })}
          />
          <span className="assumption__value">{percent(state.savingsReturnPct, 2)}</span>
        </div>
        <p className="assumption__rationale">{returnAssumption.rationale}</p>
      </div>

      {/* ---- Mortgage group ---- */}
      <h2 style={{ marginTop: 28 }}>The mortgage</h2>
      {slider('mortgageRatePct')}
      {slider('loanTermYears')}
      {slider('extraRepaymentMonthly')}
      {slider('repaymentSharePct')}
      {slider('upfrontCostsPct')}

      {state.depositPct < 20 && (
        <div className="assumption">
          <div className="assumption__head">
            <span className="assumption__title">Lenders mortgage insurance</span>
            <AssumptionBadge />
          </div>
          <div className="assumption__control">
            <input
              type="range"
              min={0}
              max={80_000}
              step={500}
              value={state.lmiCost}
              aria-label="Lenders mortgage insurance"
              onChange={(e) => onChange({ lmiCost: Number(e.target.value) })}
            />
            <span className="assumption__value">{currency(state.lmiCost)}</span>
          </div>
          <p className="assumption__rationale">
            Below a 20% deposit, lenders charge LMI — an insurance premium protecting them, not
            you, usually capitalised into the loan. Premiums are set by private insurers and are
            not published as open data, so there is no defensible default: get a quote from a
            broker or lender and put it here. It is added to the loan in every calculation above.
          </p>
        </div>
      )}

      {/* ---- Renting group ---- */}
      <h2 style={{ marginTop: 28 }}>The renting alternative</h2>

      <div className="assumption">
        <div className="assumption__head">
          <span className="assumption__title">Weekly rent while renting</span>
          <AssumptionBadge />
        </div>
        <div className="assumption__control">
          <input
            type="range"
            min={100}
            max={2000}
            step={5}
            value={Math.round(state.rentWeekly ?? impliedRentWeekly ?? 600)}
            aria-label="Weekly rent while renting"
            onChange={(e) => onChange({ rentWeekly: Number(e.target.value) })}
          />
          <span className="assumption__value">
            {currency(state.rentWeekly ?? impliedRentWeekly ?? 600)}/wk
          </span>
          {state.rentWeekly !== null && (
            <button type="button" className="btn" onClick={() => onChange({ rentWeekly: null })}>
              Reset to market
            </button>
          )}
        </div>
        <p className="assumption__rationale">
          What the renter in the comparison pays for equivalent housing.{' '}
          {state.rentWeekly === null ? (
            <>
              Currently following the implied market rent for this selection
              {impliedRentWeekly !== null ? ` (${currency(impliedRentWeekly)}/wk)` : ''} — the
              median value × its published gross yield ÷ 52, both figures cited. Move the slider
              to pin your own figure.
            </>
          ) : (
            <>Pinned to your figure; “Reset to market” returns to the derived rent.</>
          )}
        </p>
      </div>

      {slider('rentGrowthPct')}

      <div className="assumption">
        <div className="assumption__head">
          <span className="assumption__title">Ownership running costs, per year</span>
          <AssumptionBadge />
        </div>
        <div className="assumption__control">
          <input
            type="range"
            min={0}
            max={4}
            step={0.1}
            value={state.ownershipCostsPct ?? ownershipDefaultPct}
            aria-label="Ownership running costs"
            onChange={(e) => onChange({ ownershipCostsPct: Number(e.target.value) })}
          />
          <span className="assumption__value">
            {percent(state.ownershipCostsPct ?? ownershipDefaultPct, 1)}
          </span>
          {state.ownershipCostsPct !== null && (
            <button
              type="button"
              className="btn"
              onClick={() => onChange({ ownershipCostsPct: null })}
            >
              Reset
            </button>
          )}
        </div>
        <p className="assumption__rationale">
          Council rates, insurance, maintenance — plus strata levies for {propertyTypeLabel === 'houses' ? 'strata properties' : 'townhouses and units'}.
          Defaults to {percent(ownershipDefaultPct, 1)} for your current selection (1.0% houses,
          1.5% strata). A rule of thumb, not a published statistic — no official series measures
          it, which is why it is editable rather than quietly assumed.
        </p>
      </div>

      {slider('horizonYears')}
    </section>
  );
}
