import type { MortgageResult } from '../lib/mortgage';
import type { ProjectionResult } from '../lib/projection';
import { absCurrency, currency, duration, percent } from '../lib/format';
import { AssumptionsLink, Citation } from './Citation';

/**
 * The mortgage that awaits on the other side of the deposit.
 *
 * The centrepiece is total interest, because it is the number every repayment
 * calculator quietly buries: at current rates over a full term it rivals the
 * price of the house. Framed as a property of rates and time — not of the
 * borrower's choices.
 */

interface Props {
  result: MortgageResult;
  /** The same loan, if bought at the moved goalpost instead of today. */
  atGoalpost: { result: MortgageResult; price: number; years: number } | null;
  loan: number;
  price: number;
  lmiCost: number;
  mortgageRatePct: number;
  loanTermYears: number;
  monthlyIncome: number;
  rentalIncomeWeekly: number;
  extraRepaymentMonthly: number;
  regionName: string;
  propertyTypeLabel: string;
  projection: ProjectionResult;
}

export function MortgagePanel({
  result,
  atGoalpost,
  loan,
  price,
  lmiCost,
  mortgageRatePct,
  loanTermYears,
  monthlyIncome,
  rentalIncomeWeekly,
  extraRepaymentMonthly,
  regionName,
  propertyTypeLabel,
}: Props) {
  if (loan <= 0) {
    return (
      <section className="card" aria-labelledby="mortgage-heading">
        <h2 id="mortgage-heading">The mortgage that awaits</h2>
        <p className="hero__mechanism">
          At this deposit percentage your savings would cover the median {propertyTypeLabel} in{' '}
          {regionName} outright — there is no loan to model.
        </p>
      </section>
    );
  }

  const interestVsPrice = result.totalInterest / price;
  const paymentShare = monthlyIncome > 0 ? (result.requiredPayment / monthlyIncome) * 100 : null;
  const hasOffsets = extraRepaymentMonthly > 0 || rentalIncomeWeekly > 0;

  return (
    <section className="card" aria-labelledby="mortgage-heading">
      <h2 id="mortgage-heading">The mortgage that awaits</h2>

      <div className="goalposts">
        <div className="goalpost">
          <div className="goalpost__label">Loan at settlement</div>
          <div className="goalpost__value">{currency(loan)}</div>
          <div className="goalpost__meta">
            Median {propertyTypeLabel} minus your deposit
            {lmiCost > 0 ? `, plus ${currency(lmiCost)} LMI capitalised` : ''}
          </div>
        </div>

        <div className="goalpost">
          <div className="goalpost__label">Required repayment</div>
          <div className="goalpost__value">{currency(result.requiredPayment)}/mo</div>
          <div className="goalpost__meta">
            At {percent(mortgageRatePct, 2)}
            <Citation sourceId="rba-f6" /> over {loanTermYears} years
            {paymentShare !== null ? ` — ${paymentShare.toFixed(0)}% of the income entered` : ''}
          </div>
        </div>

        <div className="goalpost goalpost--drift">
          <div className="goalpost__label">Total interest over the loan</div>
          <div className="goalpost__value">{currency(result.totalInterest)}</div>
          <div className="goalpost__meta">
            {(interestVsPrice * 100).toFixed(0)}% of the price itself, again, in interest
          </div>
        </div>
      </div>

      <p className="goalpost-note">
        {hasOffsets ? (
          <>
            With {extraRepaymentMonthly > 0 && <>an extra {currency(extraRepaymentMonthly)} a month</>}
            {extraRepaymentMonthly > 0 && rentalIncomeWeekly > 0 && <> and </>}
            {rentalIncomeWeekly > 0 && <>{currency(rentalIncomeWeekly)}/week of rental income</>}{' '}
            going into the loan, it clears in <strong>{duration(result.payoffYears)}</strong>{' '}
            instead of {loanTermYears} years — <strong>{currency(result.interestSaved)}</strong> of
            interest never gets charged. Money that reaches the principal early compounds in your
            favour for every remaining year, which is why modest amounts move this number so far.
          </>
        ) : (
          <>
            Paid as scheduled, this loan runs the full {loanTermYears} years and the interest bill
            reaches {currency(result.totalInterest)}. That figure is what {percent(mortgageRatePct, 2)}{' '}
            compounded across {loanTermYears} years does to {currency(loan)} — a property of rates
            and time, not of the borrower. The <AssumptionsLink>extra-repayment slider</AssumptionsLink> shows how sharply it bends.
          </>
        )}
      </p>

      {atGoalpost && atGoalpost.years > 0.5 && (
        <div className="disclosure">
          <strong>The treadmill, continued:</strong> if instead you buy when your savings first
          reach the deposit target — {duration(atGoalpost.years)} from now, at the moved price of{' '}
          {currency(atGoalpost.price)} — the repayment becomes{' '}
          {currency(atGoalpost.result.requiredPayment)}/mo and lifetime interest{' '}
          {currency(atGoalpost.result.totalInterest)} —{' '}
          {absCurrency(atGoalpost.result.totalInterest - result.totalInterest)}{' '}
          {atGoalpost.result.totalInterest >= result.totalInterest ? 'more' : 'less'} than buying
          today. The goalposts move for the loan too, not just the deposit.
        </div>
      )}
    </section>
  );
}
