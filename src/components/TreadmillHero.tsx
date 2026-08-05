import type { TreadmillResult } from '../lib/treadmill';
import type { ResolvedGrowth } from '../data/index';
import { absCurrency, currency, percent } from '../lib/format';
import { AssumptionsLink, Citation } from './Citation';

/**
 * The product, in one number.
 *
 * Copy discipline: this component describes what the market did, never what the
 * user failed to do. The gap is a property of the mechanism — the target moves
 * whether or not anyone is saving — and the wording keeps that subject in place.
 */

interface Props {
  result: TreadmillResult;
  regionName: string;
  growth: ResolvedGrowth;
  propertyTypeLabel: string;
}

const DIRECTION_COPY = {
  losing: { badge: 'Losing ground', verb: 'You lose ground by' },
  gaining: { badge: 'Gaining ground', verb: 'You gain ground by' },
  level: { badge: 'Holding level', verb: 'You hold level, within' },
} as const;

export function TreadmillHero({ result, regionName, growth, propertyTypeLabel }: Props) {
  const { direction, groundGained, targetRise, netGround } = result;
  const copy = DIRECTION_COPY[direction];

  return (
    <section className={`card hero`} aria-labelledby="hero-heading">
      <h2 id="hero-heading">Over the next 12 months</h2>

      <div className="hero__ledger">
        <div className="hero__line">
          <span className="hero__line-label">
            <span className="hero__swatch hero__swatch--savings" aria-hidden="true" />
            You add to savings
          </span>
          <span className="hero__line-value">{currency(groundGained)}</span>
        </div>
        <div className="hero__line">
          <span className="hero__line-label">
            <span className="hero__swatch hero__swatch--target" aria-hidden="true" />
            {/* In a falling market the target moves toward the saver. Saying it
                "rises −$1,455" would be technically true and unreadable. */}
            The deposit target {targetRise < 0 ? 'falls' : 'rises'}
          </span>
          <span className="hero__line-value">{absCurrency(targetRise)}</span>
        </div>
      </div>

      <p className="hero__verdict-label">{copy.verb}</p>
      <p className={`hero__number hero__number--${direction}`}>
        {absCurrency(netGround)}
        <span className="hero__direction">{copy.badge}</span>
      </p>

      <p className="hero__mechanism">
        {direction === 'losing' ? (
          <>
            At {regionName}’s {growth.provenance.toLowerCase().includes('your own') ? '' : 'published '}
            growth rate of {percent(growth.ratePct)}
            {growth.sourceId ? <Citation sourceId={growth.sourceId} /> : null}, a 20% deposit on
            the median {propertyTypeLabel} moves {absCurrency(targetRise)} further away each year
            on its own — before anyone saves a cent. That is the treadmill: the finish line is
            powered, and it runs at {absCurrency(targetRise / 12)} a month.
          </>
        ) : direction === 'gaining' ? (
          <>
            At {regionName}’s current rate of {percent(growth.ratePct)}
            {growth.sourceId ? <Citation sourceId={growth.sourceId} /> : null}, the deposit target
            is moving {targetRise < 0 ? 'toward you' : 'more slowly than you are'}. This reflects
            what the market is doing right now, not a permanent condition — change the <AssumptionsLink>growth assumption</AssumptionsLink> to see how narrow that window is.
          </>
        ) : (
          <>
            At {regionName}’s growth rate of {percent(growth.ratePct)}
            {growth.sourceId ? <Citation sourceId={growth.sourceId} /> : null}, you are moving at
            almost exactly the speed of the target. Running to stand still is the literal case
            here: a year of saving leaves the distance to a deposit unchanged.
          </>
        )}
      </p>
    </section>
  );
}
