import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RentVsBuyResult } from '../lib/rentVsBuy';
import { absCurrency, compactCurrency, currency, duration } from '../lib/format';
import { useThemeColors } from '../lib/useThemeColors';

/**
 * Rent vs buy, as net worth over time on one axis.
 *
 * Same chart grammar as the savings-vs-target chart: two lines, one dollar
 * scale, a marked crossover or an explicit no-crossover. Blue is the buying
 * path (consistent with "your savings" elsewhere — it is the reader's
 * prospective position), orange the renting path.
 */

interface Props {
  result: RentVsBuyResult;
  horizonYears: number;
  regionName: string;
  growthProvenance: string;
  mortgageRatePct: number;
  rentWeeklyUsed: number;
  rentIsDerived: boolean;
}

interface TooltipItem {
  payload?: { year: number; buyNetWorth: number; rentNetWorth: number };
}

function RvbTooltip({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const gap = point.buyNetWorth - point.rentNetWorth;

  return (
    <div className="tooltip">
      <div className="tooltip__title">
        {point.year === 0 ? 'At purchase' : `After ${duration(point.year)}`}
      </div>
      <div className="tooltip__row">
        <span>Buying — net worth</span>
        <strong>{currency(point.buyNetWorth)}</strong>
      </div>
      <div className="tooltip__row">
        <span>Renting — net worth</span>
        <strong>{currency(point.rentNetWorth)}</strong>
      </div>
      <div className="tooltip__row tooltip__gap">
        <span>{gap >= 0 ? 'Buying ahead by' : 'Renting ahead by'}</span>
        <strong>{absCurrency(gap)}</strong>
      </div>
    </div>
  );
}

export function RentVsBuyPanel({
  result,
  horizonYears,
  regionName,
  growthProvenance,
  mortgageRatePct,
  rentWeeklyUsed,
  rentIsDerived,
}: Props) {
  const c = useThemeColors();
  const { points, advantageAtHorizon, crossoverMonth, totals } = result;
  const buyingWins = advantageAtHorizon >= 0;

  const tickStep = horizonYears <= 12 ? 2 : horizonYears <= 26 ? 5 : 10;
  const ticks: number[] = [];
  for (let y = 0; y <= horizonYears; y += tickStep) ticks.push(y);

  const crossoverPoint =
    crossoverMonth !== null && crossoverMonth > 0 ? points[crossoverMonth] : undefined;

  return (
    <section className="card" aria-labelledby="rvb-heading">
      <h2 id="rvb-heading">Rent or buy — {regionName}</h2>

      <p className="hero__verdict-label">
        After {horizonYears} years — at {mortgageRatePct.toFixed(2)}% interest, price growth from{' '}
        {/* Provenance strings are sentence-case; embedded mid-sentence the first
            letter drops, without touching proper nouns further in. */}
        {growthProvenance.charAt(0).toLowerCase() + growthProvenance.slice(1)} —{' '}
        {buyingWins ? 'buying leaves you ahead by' : 'renting leaves you ahead by'}
      </p>
      <p
        className={`hero__number hero__number--${buyingWins ? 'gaining' : 'level'}`}
        style={{ fontSize: 'clamp(2rem, 7vw, 3.4rem)' }}
      >
        {absCurrency(advantageAtHorizon)}
        <span className="hero__direction">
          {buyingWins ? 'Buying ahead' : 'Renting ahead'}
        </span>
      </p>

      <div className="chart-legend" style={{ marginTop: 16 }}>
        <span className="chart-legend__item">
          <span className="chart-legend__key" style={{ background: c['series-savings'] }} aria-hidden="true" />
          Buying — property equity
        </span>
        <span className="chart-legend__item">
          <span className="chart-legend__key" style={{ background: c['series-target'] }} aria-hidden="true" />
          Renting — invested savings
        </span>
      </div>

      <div className="chart-wrap" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis
              dataKey="year"
              type="number"
              domain={[0, horizonYears]}
              ticks={ticks}
              tickFormatter={(v: number) => (v === 0 ? 'Now' : `${v}y`)}
              stroke={c.axis}
              tick={{ fill: c['text-muted'], fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => compactCurrency(v)}
              stroke={c.axis}
              tick={{ fill: c['text-muted'], fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={62}
            />
            <Tooltip
              content={<RvbTooltip />}
              cursor={{ stroke: c['text-muted'], strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Line
              type="monotone"
              dataKey="rentNetWorth"
              name="Renting"
              stroke={c['series-target']}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: c['surface-1'] }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="buyNetWorth"
              name="Buying"
              stroke={c['series-savings']}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: c['surface-1'] }}
              isAnimationActive={false}
            />
            {crossoverPoint && (
              <ReferenceDot
                x={crossoverPoint.year}
                y={crossoverPoint.buyNetWorth}
                r={6}
                fill={c['series-savings']}
                stroke={c['surface-1']}
                strokeWidth={2}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="chart-caption">
        {crossoverMonth === null ? (
          <>
            Within this horizon the renting line stays ahead: the upfront costs and interest are
            never recovered by price growth at these settings. Stretch the horizon or the growth
            assumption to see where that flips.
          </>
        ) : crossoverMonth === 0 ? (
          <>Buying starts ahead and stays there at these settings.</>
        ) : (
          <>
            Buying overtakes renting after <strong>{duration(crossoverMonth / 12)}</strong> —
            marked on the chart. Before that point the renter’s invested deposit is winning;
            after it, the owner’s equity is.
          </>
        )}
      </p>

      <div className="goalposts" style={{ marginTop: 18 }}>
        <div className="goalpost">
          <div className="goalpost__label">Rent paid over {horizonYears} years</div>
          <div className="goalpost__value">{currency(totals.rentPaid)}</div>
          <div className="goalpost__meta">
            From {currency(rentWeeklyUsed)}/wk{rentIsDerived ? ' (implied market rent)' : ''},
            growing yearly
          </div>
        </div>
        <div className="goalpost">
          <div className="goalpost__label">Interest paid over {horizonYears} years</div>
          <div className="goalpost__value">{currency(totals.interestPaid)}</div>
          <div className="goalpost__meta">The owner’s equivalent of rent — paid to the bank</div>
        </div>
        <div className="goalpost">
          <div className="goalpost__label">Ownership running costs</div>
          <div className="goalpost__value">{currency(totals.ownershipCostsPaid)}</div>
          <div className="goalpost__meta">Rates, insurance, maintenance{totals.rentalIncomeReceived > 0 ? ` — offset by ${currency(totals.rentalIncomeReceived)} of room income` : ''}</div>
        </div>
      </div>

      <div className="disclosure" style={{ marginTop: 18 }}>
        <strong>How this comparison works, and what it leaves out.</strong> Both paths start with
        the same cash (deposit + upfront costs) and spend the same total each month — the renter
        pays rent and invests the difference at your savings-return rate, including the deposit
        they never spent. Not modelled, in either direction: the main-residence CGT exemption
        (favours owning), tax on the renter’s investment returns (favours owning), partial CGT
        and income tax when letting rooms (reduces the room-income benefit), negative gearing,
        land tax, and selling costs at the end. Tax treatment differs enough between people that
        modelling it badly would be worse than saying plainly that it is not modelled.
      </div>
    </section>
  );
}
