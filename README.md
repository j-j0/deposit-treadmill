# The Deposit Treadmill

Every Australian bank site answers *"how many years to save a deposit?"* This answers a
different question: **are you gaining or losing ground?**

Each year you save some amount. Each year the 20% deposit target rises by some other amount.
If the second is bigger, you went backwards despite doing everything right. That signed gap —
with a direction — is the entire product.

> You add $8,964 this year. The deposit target rises $13,755.
> **You lose ground by $4,790.**

A static single-page app. No backend, no tracking, no network calls at runtime. Your inputs are
encoded in the URL hash and never leave the browser.

**v2** carries the question past the deposit: the mortgage that awaits (payment, payoff time,
total interest — with extra repayments and room-rental income modelled), what a lender's
serviceability test allows (assessed at the rate plus APRA's 3.0pp buffer), and rent-vs-buy as
net worth over time — both paths starting from identical wealth and spending identical monthly
cash, so neither side gets a thumb on the scale. Townhouses are selectable and honestly mapped:
Cotality's methodology classifies strata townhouses inside its unit segment and publishes no
separate series, so the Townhouse option reads unit figures and discloses exactly that. Rental
yields per city per property type come from the HVI (implied market rent = median × yield ÷ 52,
derivation shown); the default mortgage rate (6.2%, owner-occupier variable, new loans) comes
from RBA table F6 and joins the auto-refresh pipeline.

---

## Running it

Requires Node ≥ 20.10.

```bash
npm install
npm run dev              # http://localhost:5173
npm test                 # 57 tests: calculations, projections, citations, freshness
npm run build            # -> dist/, deployable to any static host
npm run preview          # serve the built bundle
npm run refresh-data     # pull latest RBA + ABS figures (see below)
npm run refresh-data:dry # ...without writing anything
```

> **Version pins:** Vite is held at 6.x and `@vitejs/plugin-react` at 4.x because Vite 7+ and
> plugin-react 5+ require Node `^20.19.0 || >=22.12.0`. On Node 20.19+ you can move both to
> latest with no code changes.

---

## Where every number comes from

### Primary source — Cotality (formerly CoreLogic) Home Value Index

Index results **as at 30 June 2026**, released 1 July 2026.
<https://discover.cotality.com/hubfs/Article-Reports/COTALITY%20HVI%20JULY%202026%20FINAL.pdf>

Medians and 12-month changes are transcribed from the p.4 index tables; 5- and 10-year changes
from the p.2 key-time-periods table. The HVI is a *hedonic* index — composition-adjusted using
property attributes, rather than a raw median of whatever happened to sell that month.

| City | House | Unit | Dwelling | 12mo (dwelling) | 5yr | 10yr |
|---|---|---|---|---|---|---|
| Sydney | $1,556,258 | $898,623 | $1,265,608 | +0.3% | 12.9% | 54.1% |
| Melbourne | $948,482 | $637,170 | $808,486 | −0.9% | 1.2% | 32.2% |
| Brisbane | $1,225,350 | $885,132 | $1,118,306 | +17.4% | 76.6% | 119.0% |
| Perth | $1,093,431 | $773,605 | $1,046,551 | +23.9% | 89.6% | 109.4% |
| Adelaide | $1,008,736 | $695,151 | $945,868 | +11.6% | 72.0% | 111.4% |
| Hobart | $803,094 | $587,749 | $752,760 | +9.3% | 17.3% | 95.8% |
| Canberra | $1,035,828 | $597,430 | $885,254 | +2.9% | 12.9% | 62.8% |
| Darwin | $766,350 | $472,572 | $638,187 | +19.8% | 33.4% | 33.6% |
| **National** | $1,025,085 | $752,007 | $937,722 | +7.3% | 31.3% | 73.7% |

Price data © 2026 RP Data Pty Ltd t/as Cotality, reproduced from the public monthly index
release with attribution.

### Why not the ABS?

**ABS Residential Property Price Indexes: Eight Capital Cities was discontinued after December
quarter 2021.** Most Australian house-price commentary still cites it; any tool claiming current
capital-city price indexes from it is citing a dead series.

Its ABS successor, [Total Value of Dwellings](https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/latest-release),
publishes a **mean** price by **state**, not a median by capital city — which cannot drive a
city-level deposit target. It ships in the app as an independent cross-check, clearly labelled so
its figures are never mistaken for the ones driving the calculation.

### Supporting sources

| Figure | Value | Source |
|---|---|---|
| Default household income | $2,051.10/wk × 52 = $106,657 | [ABS Average Weekly Earnings, Nov 2025](https://www.abs.gov.au/statistics/labour/earnings-and-working-conditions/average-weekly-earnings-australia/latest-release) (rel. 26 Feb 2026) |
| Default monthly savings | 6.2% household saving ratio | [ABS National Accounts, Mar qtr 2026](https://www.abs.gov.au/statistics/economy/national-accounts/australian-national-accounts-national-income-expenditure-and-product/latest-release) (rel. 3 Jun 2026) |
| Default savings return | 4.35% cash rate | [RBA Monetary Policy Decision, Jun 2026](https://www.rba.gov.au/media-releases/2026/mr-26-15.html) (16 Jun 2026) |
| ABS cross-check | Mean dwelling price by state | [ABS Total Value of Dwellings, Mar qtr 2026](https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/latest-release) (rel. 9 Jun 2026) |

---

## Keeping the data current

**The supporting figures update themselves. The house prices do not — and cannot.**

`npm run refresh-data` pulls from official APIs and regenerates `src/data/generated.ts`:

| Figure | Endpoint | Licence |
|---|---|---|
| RBA cash rate | RBA statistical table [F1](https://www.rba.gov.au/statistics/tables/csv/f1-data.csv) (CSV) | — |
| ABS Average Weekly Earnings | ABS Data API, dataflow `AWE` | CC BY 4.0 |
| ABS household saving ratio | ABS Data API, dataflow `ANA_AGG` | CC BY 4.0 |
| ABS mean dwelling price by state | ABS Data API, dataflow `RES_DWELL_ST` | CC BY 4.0 |

The [ABS Data API](https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide)
(`https://data.api.abs.gov.au/rest/`) is free and has needed no API key since November 2024.
It rejects requests without a browser-like `User-Agent`, failing as a connection timeout rather
than an HTTP error — the refresh script sets one.

### Why Cotality can't be automated

Cotality licenses the Home Value Index through a paid B2B API. The only free channel is the
monthly PDF media release, marked *Proprietary*. Scraping that on a schedule would be fragile and
legally uncomfortable, so `regions.capitals.ts` stays a deliberate ~5-minute transcription each
month.

This matters less than it sounds. The figure driving the treadmill is the **10-year** growth rate,
which by construction barely moves — one more month shifts Sydney's 4.42% by hundredths of a
percent.

> ABS `RES_DWELL` *does* publish median house prices by Greater Capital City, quarterly, free and
> CC BY — a fully automatable alternative. It was considered and not adopted: it is an
> unstratified raw median rather than a composition-adjusted index, quarterly rather than monthly,
> and runs about four months behind. Worth revisiting if the licensing position on Cotality ever
> becomes a problem.

### Build-time, never runtime

The refresh runs in CI, not in the browser. Fetching from the page would leak the privacy
guarantee (inputs never leave the tab), add CORS and third-party uptime as failure modes, and —
the real reason — put **unverified numbers in front of readers**. Running at build time means
every refreshed figure passes the verifier suite before it can reach a screen.

`.github/workflows/refresh-data.yml` runs monthly, gates on `npm test` and `npm run build`, and
opens a PR rather than pushing to main. A bot silently rewriting the numbers people are quoting is
precisely what this project exists to prevent.

### When data goes stale anyway

A static page cannot notice that the world moved on, so the app computes it. `src/lib/freshness.ts`
compares each source's publication cadence against the clock and shows a non-dismissable banner
when an edition has been superseded. Auto-refreshed sources are exempt from that check — a
separate check on the pipeline's own last run covers them, because a stalled pipeline is the
failure that would otherwise be invisible.

### The only arithmetic applied to source data

Long-run growth defaults are annualised from the published cumulative changes:

```
CAGR = (1 + change)^(1/years) − 1
```

CAGRs are **not stored** — they are derived at module load in `regions.capitals.ts`, so a stored
rate can never drift out of agreement with the published figure it came from. `tests/data.test.ts`
round-trips all 18 of them.

Resulting 10-year defaults: Sydney 4.42%, Melbourne 2.83%, Brisbane 8.16%, Adelaide 7.77%,
Perth 7.67%, Hobart 6.95%, Canberra 4.99%, Darwin 2.94%, National 5.68%.

### Stated limitations

- **Long-run growth is a dwellings figure.** Cotality publishes 5- and 10-year change on an
  all-dwellings basis only. Viewing houses or units inherits the dwellings rate; the app says so
  inline. The 12-month basis *is* published per property type and is used type-specific.
- **The savings return default is the cash rate**, not a savings account rate, and is before tax.
- **The default saving ratio is measured on after-tax income** while the income field is pre-tax,
  and it is an economy-wide average including households drawing savings down.
- **Not modelled:** stamp duty, LMI, first-home-buyer schemes, transaction costs, tax on interest.

---

## Architecture

```
src/
  data/          the cited data layer — no figure exists here without a sourceId
    types.ts             Region, PriceSeries, Source, Assumption
    sources.ts           citation registry; everything points here by id
    regions.capitals.ts  8 capitals + national, transcribed from the HVI
    crosscheck.abs.ts    ABS figures, display-only
    assumptions.ts       editable defaults + rationale + citation
    index.ts             async loader API, growth resolution
  lib/
    treadmill.ts   the signed annual gap. Pure, no constants.
    projection.ts  monthly simulation; crossover or explicit neverConverges
    format.ts      AU currency/percent/duration formatting
    urlState.ts    hash encode/decode — the shareable link
  components/    hero, goalposts, chart, inputs, assumptions, sources, share card
```

### Suburb-level data drops in without restructuring

Geography is a flat registry of `Region` rows joined by `parentId`, not a capitals-shaped
structure. A suburb is another row with `type: 'suburb'` and a `parentId`. The loader is already
async, so a suburb dataset becomes a dynamic `import()` behind the same signature — code-split,
fetched only when someone opens the suburb picker. Fields a suburb may lack (`fiveYearChangePct`
and friends) are already nullable, with fallback up the `parentId` chain, and `resolveGrowth`
reports the inheritance rather than hiding it.

### No magic numbers, enforced

Every displayed figure is either a source-linked datum or a registered `Assumption`.
`tests/data.test.ts` fails the build if a region cites a source that doesn't exist, if an
assumption lacks a rationale, or if a stored CAGR disagrees with recomputing it from the published
change. It also re-states every transcribed figure independently, so a hand-edit typo in the data
file is caught.

### Chart

Two series, both in dollars, on **one** axis — the "do these converge?" question is only
answerable when both lines share a scale. Palette is series slot 1 (blue, the saver) and slot 2
(orange, the target), validated for colour-vision deficiency in both light and dark modes
(worst adjacent CVD ΔE 24.7 light / 26.8 dark, against a ≥8 target).

---

## Share card

A 1200×630 PNG rendered client-side on `<canvas>`, offered as a download or via the Web Share API,
with the growth assumption and source printed on the card itself.

**Being precise about the limit:** the *image you post* is personalised; the *link unfurl* is
generic (`public/og-default.png`). A per-user Open Graph image has to be rendered at request time
by a server, which a static v1 does not have. The v2 path is an edge function reading the same URL
parameters the page already round-trips.

---

## Copy discipline

The framing targets the mechanism, never the saver. The gap is a property of the market — the
deposit target moves whether or not anyone is saving. Wording never implies the user saved too
little, and gaining ground is reported plainly and attributed to current market conditions rather
than to the user's virtue.

This is an illustration of one mechanism, not financial advice.
