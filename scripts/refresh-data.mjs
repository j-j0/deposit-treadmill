#!/usr/bin/env node
/**
 * Refresh the auto-updatable figures from official APIs and regenerate
 * `src/data/generated.ts`.
 *
 * Scope, deliberately: this covers the supporting figures only —
 *   · RBA cash rate            (default return on savings)
 *   · ABS Average Weekly Earnings   (default household income)
 *   · ABS household saving ratio    (default monthly savings)
 *   · ABS mean dwelling price by state (the display-only cross-check)
 *
 * The PRIMARY house price data is NOT refreshed here and cannot be. Cotality
 * publishes the Home Value Index through a paid B2B licence; the free channel
 * is a monthly PDF marked Proprietary. Scraping that on a schedule would be
 * both fragile and legally uncomfortable, so `regions.capitals.ts` stays a
 * deliberate, human, ~5-minute transcription each month. See README.
 *
 * This runs at BUILD time, never in the browser. That keeps the deployed page
 * static and offline, keeps user inputs from ever leaving the tab, and — the
 * real reason — means every refreshed figure passes the verifier test suite
 * BEFORE it can reach a screen. A runtime fetch would put unverified numbers
 * in front of readers, which is the one thing this project must not do.
 *
 * Usage:  node scripts/refresh-data.mjs [--dry-run]
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/generated.ts');
const DRY_RUN = process.argv.includes('--dry-run');

// The ABS gateway rejects requests without a browser-ish user agent, returning
// a connection timeout rather than an HTTP error. Took a while to spot.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const ABS_BASE = 'https://data.api.abs.gov.au/rest/data/ABS';
const RBA_F1 = 'https://www.rba.gov.au/statistics/tables/csv/f1-data.csv';
const RBA_F6 = 'https://www.rba.gov.au/statistics/tables/csv/f6-data.csv';

async function get(url, label) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} from ${url}`);
  const text = await res.text();
  if (!text.trim()) throw new Error(`${label}: empty response from ${url}`);
  return text;
}

/** Minimal CSV parser — handles quoted fields, which RBA's headers contain. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toObjects(rows) {
  const [header, ...body] = rows;
  return body
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i]])));
}

// ---------------------------------------------------------------- RBA

/**
 * F1 is a wide daily table: a handful of metadata rows, then a header row whose
 * first cell is "Series ID", then dated rows. We locate the "Cash Rate Target"
 * column by its title row rather than by index, because column order has
 * changed historically.
 */
async function fetchCashRate() {
  const rows = parseCsv(await get(RBA_F1, 'RBA F1'));

  const titleRow = rows.find((r) => r[0]?.trim() === 'Title');
  if (!titleRow) throw new Error('RBA F1: no "Title" row found');

  const col = titleRow.findIndex((c) => c?.trim() === 'Cash Rate Target');
  if (col < 0) throw new Error('RBA F1: no "Cash Rate Target" column found');

  const headerIdx = rows.findIndex((r) => r[0]?.trim() === 'Series ID');
  if (headerIdx < 0) throw new Error('RBA F1: no "Series ID" row found');

  // Walk backwards for the most recent non-blank observation: the cash rate
  // column is sparse (only populated on days it is set or changes).
  for (let i = rows.length - 1; i > headerIdx; i--) {
    const raw = rows[i][col]?.trim();
    const date = rows[i][0]?.trim();
    if (!raw || !date) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;

    // RBA dates are "30-Jul-2026". Parse the parts by hand: `new Date(...)`
    // yields LOCAL midnight, and toISOString() then shifts it back a day for
    // anyone east of UTC — which is everyone reading this.
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(date);
    if (!m) continue;
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const month = months.indexOf(m[2].toLowerCase());
    if (month < 0) continue;

    return {
      valuePct: value,
      effectiveISO: `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`,
      effectiveLabel: date,
    };
  }
  throw new Error('RBA F1: no usable cash rate observation found');
}

/**
 * F6 is the housing lending rates table. The column is located by its full
 * title rather than position — RBA has reordered columns historically. We take
 * the owner-occupier variable rate on NEW loans (all institutions): the rate a
 * borrower opening a mortgage today would actually face, which is what the
 * mortgage panel models.
 */
async function fetchMortgageRates() {
  const rows = parseCsv(await get(RBA_F6, 'RBA F6'));

  const titleRow = rows.find((r) => r[0]?.trim() === 'Title');
  if (!titleRow) throw new Error('RBA F6: no "Title" row found');

  const headerIdx = rows.findIndex((r) => r[0]?.trim() === 'Series ID');
  if (headerIdx < 0) throw new Error('RBA F6: no "Series ID" row found');

  const pick = (segment) => {
    const wanted = ['new loans', segment, 'variable', 'all institutions'];
    const col = titleRow.findIndex((c) => {
      const t = (c || '').toLowerCase();
      return wanted.every((w) => t.includes(w));
    });
    if (col < 0) throw new Error(`RBA F6: no "${segment}" new-loan variable column found`);

    for (let i = rows.length - 1; i > headerIdx; i--) {
      const raw = rows[i][col]?.trim();
      const date = rows[i][0]?.trim();
      if (!raw || !date) continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;

      // F6 dates are "31/05/2026".
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date);
      if (!m) continue;

      return {
        valuePct: value,
        effectiveISO: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`,
        effectiveLabel: date,
      };
    }
    throw new Error(`RBA F6: no usable ${segment} rate observation found`);
  };

  return { owner: pick('owner-occupied'), investor: pick('investment') };
}

// ---------------------------------------------------------------- ABS

async function absLatest(flow) {
  const url = `${ABS_BASE},${flow},1.0.0/all?lastNObservations=1&format=csvfilewithlabels`;
  return toObjects(parseCsv(await get(url, `ABS ${flow}`)));
}

const num = (r) => {
  const v = Number(r.OBS_VALUE);
  return Number.isFinite(v) ? v : null;
};

// ------------------------------------------------------------------------

/** ABS scales values by UNIT_MULT (3 = thousands). */
const scaled = (r) => {
  const v = num(r);
  return v === null ? null : v * Math.pow(10, Number(r.UNIT_MULT || 0));
};

function one(rows, predicate, label) {
  const hits = rows.filter(predicate).filter((r) => num(r) !== null);
  if (hits.length !== 1) {
    throw new Error(
      `${label}: expected exactly 1 matching series, got ${hits.length}. ` +
        `The ABS dataflow's dimensions have probably changed — re-check the filter.`,
    );
  }
  return hits[0];
}

async function fetchAwe() {
  const rows = await absLatest('AWE');
  const r = one(
    rows,
    (x) =>
      x.Measure === 'Full-time adult average weekly ordinary time earnings' &&
      x['Estimate Type'] === 'Earnings' &&
      x.Sex === 'Persons' &&
      x.Sector === 'Private and Public' &&
      x.Industry === 'All Industries' &&
      x['Adjustment Type'] === 'Seasonally Adjusted' &&
      x.Region === 'Australia',
    'ABS AWE',
  );
  return { weekly: num(r), period: r.TIME_PERIOD };
}

async function fetchSavingRatio() {
  const rows = await absLatest('ANA_AGG');
  const r = one(
    rows,
    // ANA_AGG splits the concept across Measure ('Ratio') and Data Item, unlike
    // the other dataflows where Measure alone identifies the series.
    (x) =>
      x['Data Item'] === 'Household saving ratio' &&
      x.Measure === 'Ratio' &&
      x['Adjustment Type'] === 'Seasonally Adjusted' &&
      x.Region === 'Australia',
    'ABS household saving ratio',
  );
  return { pct: num(r), period: r.TIME_PERIOD };
}

/** Display-only cross-check: mean dwelling price by state. */
async function fetchMeanDwellingPrices() {
  const rows = await absLatest('RES_DWELL_ST');
  const wanted = [
    ['AUS', 'Australia', 'au'],
    ['NSW', 'New South Wales', 'sydney'],
    ['VIC', 'Victoria', 'melbourne'],
    ['QLD', 'Queensland', 'brisbane'],
    ['SA', 'South Australia', 'adelaide'],
    ['WA', 'Western Australia', 'perth'],
    ['TAS', 'Tasmania', 'hobart'],
    ['NT', 'Northern Territory', 'darwin'],
    ['ACT', 'Australian Capital Territory', 'canberra'],
  ];

  const out = wanted.map(([code, absName, relatedRegionId]) => {
    const r = one(
      rows,
      (x) => x.Measure === 'Mean price of residential dwellings' && x.Region === absName,
      `ABS mean price (${absName})`,
    );
    return { code, name: absName, meanPrice: Math.round(scaled(r)), relatedRegionId };
  });

  const period = rows.find((x) => x.Measure === 'Mean price of residential dwellings')
    ?.TIME_PERIOD;
  return { prices: out, period };
}

// ---------------------------------------------------------------- output

/** "2026-Q1" -> "March quarter 2026"; "2025-S2" -> "November 2025". */
function humanPeriod(p) {
  const q = /^(\d{4})-Q([1-4])$/.exec(p);
  if (q) {
    const month = { 1: 'March', 2: 'June', 3: 'September', 4: 'December' }[q[2]];
    return `${month} quarter ${q[1]}`;
  }
  const s = /^(\d{4})-S([12])$/.exec(p);
  if (s) return `${s[2] === '1' ? 'May' : 'November'} ${s[1]}`;
  return p;
}

function render({ cashRate, mortgageRates, awe, saving, crosscheck, generatedAt }) {
  const q = (s) => `'${String(s).replace(/'/g, "\\'")}'`;
  return `// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Written by \`npm run refresh-data\` from official APIs. Edit that script, not
// this file; the next refresh will overwrite anything you change here.
//
// Covers the supporting figures only. The primary house price data in
// regions.capitals.ts is transcribed by hand from the Cotality Home Value Index,
// which has no free API — see scripts/refresh-data.mjs for why.

export const GENERATED_AT = ${q(generatedAt)};

/** RBA cash rate target. Source: RBA statistical table F1. */
export const CASH_RATE = {
  valuePct: ${cashRate.valuePct},
  effectiveISO: ${q(cashRate.effectiveISO)},
  effectiveLabel: ${q(cashRate.effectiveLabel)},
} as const;

/**
 * Owner-occupier variable mortgage rate on NEW loans, all institutions.
 * Source: RBA statistical table F6 (housing lending rates).
 */
export const MORTGAGE_RATE = {
  valuePct: ${mortgageRates.owner.valuePct},
  effectiveISO: ${q(mortgageRates.owner.effectiveISO)},
  effectiveLabel: ${q(mortgageRates.owner.effectiveLabel)},
} as const;

/**
 * Investor variable rate on NEW loans, all institutions. Investment lending
 * carries a premium over owner-occupier; both come from the same F6 table.
 */
export const MORTGAGE_RATE_INVESTOR = {
  valuePct: ${mortgageRates.investor.valuePct},
  effectiveISO: ${q(mortgageRates.investor.effectiveISO)},
  effectiveLabel: ${q(mortgageRates.investor.effectiveLabel)},
} as const;

/** ABS Average Weekly Earnings: FT adult AWOTE, persons, seasonally adjusted. */
export const AWE = {
  weekly: ${awe.weekly},
  period: ${q(awe.period)},
  periodLabel: ${q(humanPeriod(awe.period))},
} as const;

/** ABS household saving to income ratio, seasonally adjusted. */
export const SAVING_RATIO = {
  pct: ${saving.pct},
  period: ${q(saving.period)},
  periodLabel: ${q(humanPeriod(saving.period))},
} as const;

/** ABS mean price of residential dwellings by state. Display-only cross-check. */
export const ABS_MEAN_DWELLING_PERIOD = ${q(crosscheck.period)};
export const ABS_MEAN_DWELLING_PERIOD_LABEL = ${q(humanPeriod(crosscheck.period))};
export const ABS_MEAN_DWELLING_PRICES = [
${crosscheck.prices
  .map(
    (p) =>
      `  { code: ${q(p.code)}, name: ${q(p.name)}, meanPrice: ${p.meanPrice}, relatedRegionId: ${q(
        p.relatedRegionId,
      )} },`,
  )
  .join('\n')}
] as const;
`;
}

// ---------------------------------------------------------------- main

async function main() {
  console.log('Refreshing supporting figures from official APIs…\n');

  const [cashRate, mortgageRates, awe, saving, crosscheck] = await Promise.all([
    fetchCashRate(),
    fetchMortgageRates(),
    fetchAwe(),
    fetchSavingRatio(),
    fetchMeanDwellingPrices(),
  ]);

  // Sanity bounds. These are not style checks — they are the last line of
  // defence against a silently changed dataflow writing nonsense into the app.
  const checks = [
    [cashRate.valuePct >= 0 && cashRate.valuePct <= 20, `cash rate ${cashRate.valuePct}% out of range`],
    [
      mortgageRates.owner.valuePct >= 1 && mortgageRates.owner.valuePct <= 15,
      `owner-occupier rate ${mortgageRates.owner.valuePct}% out of range`,
    ],
    [
      mortgageRates.investor.valuePct >= 1 && mortgageRates.investor.valuePct <= 15,
      `investor rate ${mortgageRates.investor.valuePct}% out of range`,
    ],
    [
      mortgageRates.owner.valuePct > cashRate.valuePct,
      `mortgage rate ${mortgageRates.owner.valuePct}% not above cash rate ${cashRate.valuePct}% — wrong column?`,
    ],
    [
      mortgageRates.investor.valuePct >= mortgageRates.owner.valuePct,
      `investor rate ${mortgageRates.investor.valuePct}% below owner-occupier ${mortgageRates.owner.valuePct}% — columns swapped?`,
    ],
    [awe.weekly > 500 && awe.weekly < 10000, `AWE ${awe.weekly}/wk out of range`],
    [saving.pct > -20 && saving.pct < 50, `saving ratio ${saving.pct}% out of range`],
    [crosscheck.prices.length === 9, `expected 9 cross-check rows, got ${crosscheck.prices.length}`],
    [
      crosscheck.prices.every((p) => p.meanPrice > 100_000 && p.meanPrice < 5_000_000),
      'a cross-check mean price is outside a plausible range',
    ],
  ];
  const failed = checks.filter(([ok]) => !ok).map(([, msg]) => msg);
  if (failed.length) {
    console.error('Refusing to write — sanity checks failed:');
    for (const f of failed) console.error(`  · ${f}`);
    process.exit(1);
  }

  console.log(`  RBA cash rate      ${cashRate.valuePct}%  (as at ${cashRate.effectiveLabel})`);
  console.log(
    `  RBA mortgage rate  ${mortgageRates.owner.valuePct}% owner-occupier / ${mortgageRates.investor.valuePct}% investor  (new loans, ${mortgageRates.owner.effectiveLabel})`,
  );
  console.log(`  ABS AWE            $${awe.weekly}/wk  (${humanPeriod(awe.period)})`);
  console.log(`  ABS saving ratio   ${saving.pct}%  (${humanPeriod(saving.period)})`);
  console.log(
    `  ABS cross-check    ${crosscheck.prices.length} states  (${humanPeriod(crosscheck.period)})`,
  );

  const contents = render({
    cashRate,
    mortgageRates,
    awe,
    saving,
    crosscheck,
    generatedAt: new Date().toISOString(),
  });

  let previous = '';
  try {
    previous = readFileSync(OUT, 'utf8');
  } catch {
    /* first run */
  }

  // GENERATED_AT changes every run; compare everything else so an unchanged
  // refresh doesn't produce a no-op commit.
  const strip = (s) => s.replace(/export const GENERATED_AT = '[^']*';/, '');
  const changed = strip(previous) !== strip(contents);

  if (DRY_RUN) {
    console.log(`\n[dry run] ${changed ? 'WOULD update' : 'no change to'} ${OUT}`);
    return;
  }

  if (!changed) {
    console.log('\nNo change — leaving generated.ts alone.');
    return;
  }

  writeFileSync(OUT, contents);
  console.log(`\nWrote ${OUT}`);
  console.log('Run `npm test` before committing — the verifier gates this data.');
}

main().catch((err) => {
  console.error(`\nRefresh failed: ${err.message}`);
  process.exit(1);
});
