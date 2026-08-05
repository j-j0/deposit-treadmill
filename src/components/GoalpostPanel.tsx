import type { ProjectionResult } from '../lib/projection';
import type { TreadmillResult } from '../lib/treadmill';
import {
  absCurrency,
  calendarYearAfter,
  currency,
  duration,
  percentCompact,
} from '../lib/format';

/**
 * The moving goalposts: the deposit target today versus the target at the
 * moment they would actually reach it.
 *
 * The divergent case gets equal design weight. "These lines never meet at this
 * growth rate" is a finding, not a failure to compute.
 */

interface Props {
  projection: ProjectionResult;
  treadmill: TreadmillResult;
  regionName: string;
  propertyTypeLabel: string;
  /** The user's deposit setting — NOT assumed to be 20%. */
  depositPct: number;
}

export function GoalpostPanel({
  projection,
  treadmill,
  regionName,
  propertyTypeLabel,
  depositPct,
}: Props) {
  const { outcome } = projection;
  const drift =
    outcome.kind === 'reached'
      ? outcome.depositTargetAtReach - treadmill.depositTargetNow
      : 0;

  return (
    <section className="card" aria-labelledby="goalposts-heading">
      <h2 id="goalposts-heading">The moving goalposts</h2>

      {outcome.kind === 'reached' ? (
        <>
          <div className="goalposts">
            <div className="goalpost">
              <div className="goalpost__label">Deposit target today</div>
              <div className="goalpost__value">{currency(treadmill.depositTargetNow)}</div>
              <div className="goalpost__meta">
                {percentCompact(depositPct)} of the median {propertyTypeLabel} in {regionName}
              </div>
            </div>

            <div className="goalpost">
              <div className="goalpost__label">
                {outcome.month === 0
                  ? 'You are already there'
                  : `Deposit target when you reach it`}
              </div>
              <div className="goalpost__value">{currency(outcome.depositTargetAtReach)}</div>
              <div className="goalpost__meta">
                {outcome.month === 0
                  ? 'Your savings already cover the target'
                  : `In ${duration(outcome.years)} — around ${calendarYearAfter(outcome.month)}`}
              </div>
            </div>

            <div className="goalpost goalpost--drift">
              <div className="goalpost__label">
                {drift < 0 ? 'The goalpost came back' : 'The goalpost moved'}
              </div>
              <div className="goalpost__value">{absCurrency(drift)}</div>
              <div className="goalpost__meta">
                Median {propertyTypeLabel}: {currency(outcome.priceAtReach)} by then
              </div>
            </div>
          </div>

          {outcome.month > 0 && (
            <p className="goalpost-note">
              {drift >= 0 ? (
                <>
                  The deposit you are saving for is not the deposit you will need. By the time the
                  money is there, the target has moved on by <strong>{absCurrency(drift)}</strong>.
                  That movement is the market’s, not yours.
                </>
              ) : (
                <>
                  Unusually, the target moves <em>toward</em> you here: by the time the money is
                  there it is <strong>{absCurrency(drift)}</strong> lower than it is today. That is
                  what a falling market does to this calculation — and it reverses the moment
                  prices turn back up.
                </>
              )}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="goalposts">
            <div className="goalpost">
              <div className="goalpost__label">Deposit target today</div>
              <div className="goalpost__value">{currency(treadmill.depositTargetNow)}</div>
              <div className="goalpost__meta">
                {percentCompact(depositPct)} of the median {propertyTypeLabel} in {regionName}
              </div>
            </div>

            <div className="goalpost">
              <div className="goalpost__label">Short by, today</div>
              <div className="goalpost__value">{currency(outcome.shortfallNow)}</div>
              <div className="goalpost__meta">Distance between you and the target now</div>
            </div>

            <div className="goalpost goalpost--drift">
              <div className="goalpost__label">
                Short by, in {outcome.horizonYears} years
              </div>
              <div className="goalpost__value">{currency(outcome.shortfallAtHorizon)}</div>
              <div className="goalpost__meta">The gap widens rather than closes</div>
            </div>
          </div>

          <p className="goalpost-note">
            <strong>At this growth rate, the two lines never meet.</strong> The deposit target
            compounds; a fixed monthly amount does not. Over {outcome.horizonYears} years the
            distance grows from {currency(outcome.shortfallNow)} to{' '}
            {currency(outcome.shortfallAtHorizon)}. This is a structural property of compounding
            against a flat contribution — it is what the arithmetic does, not a measure of the
            saver.
          </p>
        </>
      )}
    </section>
  );
}
