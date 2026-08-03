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
import type { ProjectionResult } from '../lib/projection';
import { compactCurrency, currency, duration } from '../lib/format';
import { useThemeColors } from '../lib/useThemeColors';

/**
 * Savings trajectory against the rising deposit target.
 *
 * Both series are dollars, so they share one axis — the question "do these
 * converge or diverge?" is only answerable when both lines are on the same
 * scale. (A second y-axis would let any pair of lines be made to cross wherever
 * you like, which is exactly the deception this chart exists to avoid.)
 */

interface Props {
  projection: ProjectionResult;
  regionName: string;
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  payload?: { year: number; savings: number; depositTarget: number; shortfall: number };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const closed = point.shortfall <= 0;

  return (
    <div className="tooltip">
      <div className="tooltip__title">
        {point.year === 0 ? 'Today' : `In ${duration(point.year)}`}
      </div>
      <div className="tooltip__row">
        <span>Your savings</span>
        <strong>{currency(point.savings)}</strong>
      </div>
      <div className="tooltip__row">
        <span>Deposit target</span>
        <strong>{currency(point.depositTarget)}</strong>
      </div>
      <div className="tooltip__row tooltip__gap">
        <span>{closed ? 'Surplus' : 'Still short by'}</span>
        <strong>{currency(Math.abs(point.shortfall))}</strong>
      </div>
    </div>
  );
}

export function TrajectoryChart({ projection, regionName }: Props) {
  const c = useThemeColors();
  const { points, outcome, chartYears } = projection;

  // Integer-year ticks, thinned so labels never collide on narrow screens.
  const tickStep = chartYears <= 12 ? 2 : chartYears <= 26 ? 5 : 10;
  const ticks: number[] = [];
  for (let y = 0; y <= chartYears; y += tickStep) ticks.push(y);

  const crossing =
    outcome.kind === 'reached' && outcome.month > 0
      ? points[outcome.month]
      : undefined;

  return (
    <section className="card" aria-labelledby="chart-heading">
      <h2 id="chart-heading">
        Your savings against the deposit target — {regionName}
      </h2>

      <div className="chart-legend">
        <span className="chart-legend__item">
          <span
            className="chart-legend__key"
            style={{ background: c['series-savings'] }}
            aria-hidden="true"
          />
          Your savings
        </span>
        <span className="chart-legend__item">
          <span
            className="chart-legend__key"
            style={{ background: c['series-target'] }}
            aria-hidden="true"
          />
          Deposit target (20% of the median)
        </span>
      </div>

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={c.grid} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="year"
              type="number"
              domain={[0, chartYears]}
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
              content={<ChartTooltip />}
              cursor={{ stroke: c['text-muted'], strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Line
              type="monotone"
              dataKey="depositTarget"
              name="Deposit target"
              stroke={c['series-target']}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: c['surface-1'] }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="savings"
              name="Your savings"
              stroke={c['series-savings']}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: c['surface-1'] }}
              isAnimationActive={false}
            />
            {crossing && (
              <ReferenceDot
                x={crossing.year}
                y={crossing.depositTarget}
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
        {outcome.kind === 'reached' ? (
          outcome.month === 0 ? (
            <>Your savings already cover the deposit target — the blue line starts above the orange one.</>
          ) : (
            <>
              The lines converge after <strong>{duration(outcome.years)}</strong>, at{' '}
              {currency(outcome.depositTargetAtReach)} — marked on the chart. Note where the
              orange line has travelled to by then.
            </>
          )
        ) : (
          <>
            The lines <strong>diverge</strong>. The deposit target compounds while a fixed monthly
            contribution adds a straight line, so the gap widens across the whole window shown.
          </>
        )}
      </p>
    </section>
  );
}
