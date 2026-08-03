import type { AppState } from '../lib/urlState';
import type { ResolvedGrowth } from '../data/index';
import { GROWTH_BASIS_OPTIONS, getAssumption, type GrowthBasis } from '../data/assumptions';
import { percent } from '../lib/format';
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
  onChange: (patch: Partial<AppState>) => void;
}

export function AssumptionsPanel({ state, growth, propertyTypeLabel, onChange }: Props) {
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
    </section>
  );
}
