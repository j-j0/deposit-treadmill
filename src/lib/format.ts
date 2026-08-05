const AUD_WHOLE = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

const AUD_COMPACT = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** $1,556,258 */
export function currency(value: number): string {
  return AUD_WHOLE.format(Math.round(value));
}

/** Always signed: +$18,000 / −$16,000. Uses a real minus sign, not a hyphen. */
export function signedCurrency(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return AUD_WHOLE.format(0);
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${AUD_WHOLE.format(Math.abs(rounded))}`;
}

/** Magnitude only — for copy that supplies its own direction word. */
export function absCurrency(value: number): string {
  return AUD_WHOLE.format(Math.abs(Math.round(value)));
}

/** $1.6M — for axis ticks where full precision is noise. */
export function compactCurrency(value: number): string {
  return AUD_COMPACT.format(value);
}

/** 4.4% — with a real minus sign for negatives. */
export function percent(value: number, digits = 1): string {
  const formatted = Math.abs(value).toFixed(digits);
  return `${value < 0 ? '−' : ''}${formatted}%`;
}

/**
 * "20%" for whole numbers, "12.5%" otherwise.
 *
 * For percentages embedded in prose, where "20.0% of the median" reads as
 * spurious precision but a half-point deposit setting must not be rounded away.
 */
export function percentCompact(value: number): string {
  return percent(value, Number.isInteger(value) ? 0 : 1);
}

/**
 * "7 years 3 months". Reads as a wait, which is the point — a decimal like
 * "7.25 years" hides how long that actually is.
 */
export function duration(years: number): string {
  const totalMonths = Math.round(years * 12);
  if (totalMonths <= 0) return 'now';
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} year${y === 1 ? '' : 's'}`);
  if (m > 0) parts.push(`${m} month${m === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** Calendar year in which a month offset from now lands. */
export function calendarYearAfter(months: number, from = new Date()): number {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + Math.round(months));
  return d.getFullYear();
}
