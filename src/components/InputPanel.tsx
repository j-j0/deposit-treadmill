import type { Region, DisplayPropertyType } from '../data/types';
import { dataTypeFor } from '../data/types';
import type { AppState } from '../lib/urlState';
import { currency } from '../lib/format';
import { Citation } from './Citation';
import {
  ASSUMED_BEDROOMS,
  DEFAULT_INCOME_SOURCE_ID,
  DEFAULT_SAVING_RATIO_SOURCE_ID,
  HOUSEHOLD_SAVING_RATIO_PCT,
  defaultMonthlySavings,
} from '../data/assumptions';
import { impliedWeeklyRent } from '../data/index';

interface Props {
  state: AppState;
  regions: readonly Region[];
  region: Region;
  onChange: (patch: Partial<AppState>) => void;
}

const PROPERTY_LABELS: Record<DisplayPropertyType, string> = {
  house: 'Houses',
  townhouse: 'Townhouses',
  unit: 'Units',
  dwelling: 'All dwellings',
};

/** Blank means blank, not zero — typing over a field shouldn't fight the user. */
function numberField(raw: string): number | null {
  if (raw.trim() === '') return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function InputPanel({ state, regions, region, onChange }: Props) {
  const handleNumber =
    (key: 'income' | 'currentSavings' | 'monthlySavings' | 'rentalIncomeWeekly') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = numberField(e.target.value);
      if (value !== null) onChange({ [key]: value });
    };

  const dataType = dataTypeFor(state.propertyType);
  const impliedRent = impliedWeeklyRent(region, dataType);
  const bedrooms = ASSUMED_BEDROOMS[state.propertyType];

  const quickFill = (rooms: number | 'whole') => {
    if (impliedRent === null) return;
    const value = rooms === 'whole' ? impliedRent : (impliedRent / bedrooms) * rooms;
    onChange({ rentalIncomeWeekly: Math.round(value) });
  };

  return (
    <section className="card" aria-labelledby="inputs-heading">
      <h2 id="inputs-heading">Your situation</h2>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="region">City</label>
          <select
            id="region"
            value={state.regionId}
            onChange={(e) => onChange({ regionId: e.target.value })}
          >
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <span className="field__hint">
            Median {PROPERTY_LABELS[state.propertyType].toLowerCase()}:{' '}
            {currency(region.prices[dataType].median)}
            <Citation sourceId={region.sourceIds[0]!} />
          </span>
        </div>

        <div className="field">
          <span className="field__label" id="ptype-label">
            Property type
          </span>
          <div className="segmented" role="group" aria-labelledby="ptype-label">
            {(Object.keys(PROPERTY_LABELS) as DisplayPropertyType[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={state.propertyType === t}
                onClick={() => onChange({ propertyType: t })}
              >
                {PROPERTY_LABELS[t]}
              </button>
            ))}
          </div>
          {state.propertyType === 'townhouse' ? (
            <span className="field__hint">
              Cotality counts strata-titled townhouses and villas inside its <em>unit</em> segment
              <Citation sourceId="cotality-methodology" /> — no separate townhouse median exists,
              so these are the unit figures. If you know your local townhouse price, use “Set my
              own” growth plus your own numbers.
            </span>
          ) : (
            <span className="field__hint">Cotality publishes all three separately.</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="income">Household income (before tax, per year)</label>
          <div className="field__prefix-wrap">
            <span className="field__prefix" aria-hidden="true">
              $
            </span>
            <input
              id="income"
              type="number"
              min={0}
              step={1000}
              value={state.income}
              onChange={handleNumber('income')}
            />
          </div>
          <span className="field__hint">
            Pre-filled from ABS average weekly earnings
            <Citation sourceId={DEFAULT_INCOME_SOURCE_ID} />
          </span>
        </div>

        <div className="field">
          <label htmlFor="savings">Saved so far</label>
          <div className="field__prefix-wrap">
            <span className="field__prefix" aria-hidden="true">
              $
            </span>
            <input
              id="savings"
              type="number"
              min={0}
              step={1000}
              value={state.currentSavings}
              onChange={handleNumber('currentSavings')}
            />
          </div>
          <span className="field__hint">A starting point — replace it with yours.</span>
        </div>

        <div className="field">
          <label htmlFor="monthly">Saving each month</label>
          <div className="field__prefix-wrap">
            <span className="field__prefix" aria-hidden="true">
              $
            </span>
            <input
              id="monthly"
              type="number"
              min={0}
              step={100}
              value={state.monthlySavings}
              onChange={handleNumber('monthlySavings')}
            />
          </div>
          <span className="field__hint">
            {state.income > 0
              ? `${((state.monthlySavings * 12 * 100) / state.income).toFixed(1)}% of the income above. `
              : ''}
            {state.monthlySavings === defaultMonthlySavings(state.income) && (
              <>
                Pre-filled at the ABS national household saving ratio of{' '}
                {HOUSEHOLD_SAVING_RATIO_PCT}%
                <Citation sourceId={DEFAULT_SAVING_RATIO_SOURCE_ID} /> — an economy-wide average
                measured on after-tax income. Someone deliberately saving for a deposit usually
                saves more, so put your real figure in.
              </>
            )}
          </span>
        </div>

        <div className="field">
          <label htmlFor="rental-income">Rental income once you own ($/week)</label>
          <div className="field__prefix-wrap">
            <span className="field__prefix" aria-hidden="true">
              $
            </span>
            <input
              id="rental-income"
              type="number"
              min={0}
              step={10}
              value={state.rentalIncomeWeekly}
              onChange={handleNumber('rentalIncomeWeekly')}
            />
          </div>
          {impliedRent !== null && (
            <div className="segmented" style={{ marginTop: 6 }} role="group" aria-label="Rental income quick fill">
              <button type="button" aria-pressed={state.rentalIncomeWeekly === 0} onClick={() => onChange({ rentalIncomeWeekly: 0 })}>
                None
              </button>
              <button type="button" aria-pressed={false} onClick={() => quickFill(1)}>
                1 room
              </button>
              <button type="button" aria-pressed={false} onClick={() => quickFill(2)}>
                2 rooms
              </button>
              <button type="button" aria-pressed={false} onClick={() => quickFill('whole')}>
                Whole place
              </button>
            </div>
          )}
          <span className="field__hint">
            {impliedRent !== null ? (
              <>
                Whole-property market rent ≈ {currency(impliedRent)}/wk — derived from the median
                × its published {region.prices[dataType].grossYieldPct}% gross yield
                <Citation sourceId={region.sourceIds[0]!} />. Room fills divide by an assumed{' '}
                {bedrooms} bedrooms — a crude convention; put in the real figure for your area.
                Feeds the mortgage payoff and rent-vs-buy below.
              </>
            ) : (
              <>No published yield for this selection — enter your own figure.</>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}
