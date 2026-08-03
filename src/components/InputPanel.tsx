import type { Region, PropertyType } from '../data/types';
import type { AppState } from '../lib/urlState';
import { currency } from '../lib/format';
import { Citation } from './Citation';
import {
  DEFAULT_INCOME_SOURCE_ID,
  DEFAULT_SAVING_RATIO_SOURCE_ID,
  HOUSEHOLD_SAVING_RATIO_PCT,
  defaultMonthlySavings,
} from '../data/assumptions';

interface Props {
  state: AppState;
  regions: readonly Region[];
  region: Region;
  onChange: (patch: Partial<AppState>) => void;
}

const PROPERTY_LABELS: Record<PropertyType, string> = {
  house: 'Houses',
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
    (key: 'income' | 'currentSavings' | 'monthlySavings') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = numberField(e.target.value);
      if (value !== null) onChange({ [key]: value });
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
            {currency(region.prices[state.propertyType].median)}
            <Citation sourceId={region.sourceIds[0]!} />
          </span>
        </div>

        <div className="field">
          <span className="field__label" id="ptype-label">
            Property type
          </span>
          <div className="segmented" role="group" aria-labelledby="ptype-label">
            {(Object.keys(PROPERTY_LABELS) as PropertyType[]).map((t) => (
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
          <span className="field__hint">Cotality publishes all three separately.</span>
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
            {/* Only explain the default while it IS the default — once the user
                has typed their own figure, describing where ours came from is
                just wrong. */}
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
      </div>
    </section>
  );
}
