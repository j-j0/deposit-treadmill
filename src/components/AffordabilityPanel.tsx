import type { AffordabilityResult } from '../lib/affordability';
import { currency, percent } from '../lib/format';
import { AssumptionsLink, Citation } from './Citation';
import { APRA_BUFFER_SOURCE_ID } from '../data/assumptions';

/**
 * "What can you afford?" — estimated the way a lender tests it, with the APRA
 * buffer applied, and honest about which constraint is actually binding.
 *
 * Copy rule: when the ceiling sits far below the median, that is a statement
 * about prices against incomes — the panel says exactly that, and never
 * implies the user should stretch the assumptions until the answer flatters.
 */

interface Props {
  result: AffordabilityResult;
  medianPrice: number;
  regionName: string;
  propertyTypeLabel: string;
  repaymentSharePct: number;
  mortgageRatePct: number;
  bufferPp: number;
  depositPct: number;
  isInvestment: boolean;
  /** Rent the lender counts, per week, after shading. Zero for owner-occupiers. */
  assessedRentWeekly: number;
  rentalShadingPct: number;
  /** What the user entered, before shading — used to explain the haircut. */
  rentalIncomeWeekly: number;
}

export function AffordabilityPanel({
  result,
  medianPrice,
  regionName,
  propertyTypeLabel,
  repaymentSharePct,
  mortgageRatePct,
  bufferPp,
  depositPct,
  isInvestment,
  assessedRentWeekly,
  rentalShadingPct,
  rentalIncomeWeekly,
}: Props) {
  const ratio = result.maxPrice > 0 ? medianPrice / result.maxPrice : null;

  return (
    <section className="card" aria-labelledby="afford-heading">
      <h2 id="afford-heading">What a lender’s test says you can afford</h2>

      <div className="goalposts">
        <div className="goalpost">
          <div className="goalpost__label">Repayment budget</div>
          <div className="goalpost__value">{currency(result.monthlyBudget)}/mo</div>
          <div className="goalpost__meta">
            {currency(result.monthlyBudgetFromIncome)} from income ({repaymentSharePct}% of gross,{' '}
            <AssumptionsLink>editable</AssumptionsLink>)
            {result.monthlyBudgetFromRent > 0 && (
              <> + {currency(result.monthlyBudgetFromRent)} from assessed rent</>
            )}
          </div>
        </div>

        <div className="goalpost">
          <div className="goalpost__label">
            Assessed at{isInvestment ? ' (investor rate)' : ''}
          </div>
          <div className="goalpost__value">{percent(result.assessmentRatePct, 2)}</div>
          <div className="goalpost__meta">
            Your rate + APRA’s {bufferPp.toFixed(1)}-point serviceability buffer
            <Citation sourceId={APRA_BUFFER_SOURCE_ID} /> — the test banks must run
          </div>
        </div>

        <div className="goalpost goalpost--drift">
          <div className="goalpost__label">Estimated ceiling</div>
          <div className="goalpost__value">{currency(result.maxPrice)}</div>
          <div className="goalpost__meta">
            {result.whichConstraint === 'deposit' ? (
              // Without naming the other limit, changes that only move
              // serviceability (rental income, the investor rate) look like
              // they did nothing at all.
              <>
                Limited by your deposit: savings must cover {depositPct}% plus upfront costs.
                Serviceability alone would stretch to {currency(result.maxPriceByServiceability)}.
              </>
            ) : (
              <>
                Limited by serviceability: the repayment budget caps the loan. Your deposit would
                stretch to {currency(result.maxPriceByDeposit)}.
              </>
            )}
          </div>
        </div>
      </div>

      <p className="goalpost-note">
        {ratio !== null && ratio > 1 ? (
          <>
            The median {propertyTypeLabel} in {regionName} is {currency(medianPrice)} —{' '}
            <strong>{ratio.toFixed(1)}×</strong> this ceiling. That multiple is the distance
            between prices and incomes in {regionName}; no amount of budgeting arithmetic on the
            buyer’s side changes it. The levers that do move it are the deposit (a bigger one
            shrinks the loan the test applies to), the rate, and the price bracket you shop in.
          </>
        ) : (
          <>
            The median {propertyTypeLabel} in {regionName} at {currency(medianPrice)} sits inside
            this ceiling. The binding limit is{' '}
            {result.whichConstraint === 'deposit' ? 'the deposit' : 'serviceability'} — the actual
            repayment at your real rate would be {currency(result.actualPaymentAtMax)}/mo, under
            the assessed budget because the buffer tests a rate you would not actually pay.
          </>
        )}
      </p>

      {isInvestment ? (
        <div className="disclosure">
          <strong>Because this is an investment purchase:</strong> the rate is the published
          investor rate<Citation sourceId="rba-f6" />, which runs above owner-occupier lending —
          and the rent counts toward serviceability. Lenders shade it, here to{' '}
          {rentalShadingPct}%<AssumptionsLink> (editable)</AssumptionsLink>, for vacancy,
          management and repairs: {currency(rentalIncomeWeekly)}/wk becomes{' '}
          {currency(assessedRentWeekly)}/wk of assessable income. Not modelled: negative gearing,
          land tax, or tax on the rental profit — all of which move the real answer.
        </div>
      ) : (
        rentalIncomeWeekly > 0 && (
          <div className="disclosure">
            <strong>Your room income is not in this figure, deliberately.</strong> Lenders assess
            rent evidenced by a lease on a tenanted property; informal board from a housemate does
            not count toward serviceability, however reliably it arrives. It still repays the loan
            faster, which is why it appears on the mortgage panel above but not here. Switch to an
            investment purchase and it enters the test.
          </div>
        )
      )}

      <details className="disclosure-details">
        <summary>What this estimate is and is not</summary>
        <div className="disclosure-details__body">
        This is an estimate of the mechanism, not a borrowing quote. Real lenders assess declared
        living expenses, existing debts and credit history rather than a flat share of income —
        the share is deliberately editable in the assumptions below. Rate is assessed at{' '}
        {percent(mortgageRatePct, 2)} + {bufferPp.toFixed(1)}pp.
        </div>
      </details>
    </section>
  );
}
