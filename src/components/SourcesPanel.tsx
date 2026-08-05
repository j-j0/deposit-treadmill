import { SOURCES } from '../data/sources';
import { ABS_MEAN_DWELLING_PRICES } from '../data/crosscheck.abs';
import { currency } from '../lib/format';

/**
 * Full citation list, plus the independent ABS cross-check.
 *
 * The cross-check figures deliberately do not match the calculator's medians.
 * Rather than hide that, the panel explains why they differ, so a reader who
 * goes looking finds the explanation here instead of concluding one is wrong.
 */

export function SourcesPanel() {
  return (
    <section className="card" aria-labelledby="sources-heading" id="sources">
      <h2 id="sources-heading">Sources</h2>

      {SOURCES.map((source, i) => (
        <div className="source" key={source.id} id={`source-${source.id}`}>
          <div>
            <span className="source__ref">[{i + 1}]</span>
            <span className="source__title">
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
            </span>
          </div>
          <div className="source__meta" style={{ marginLeft: 22 }}>
            {source.publisher} · {source.referencePeriod} · released {source.releaseDate} ·
            accessed {source.accessed}
          </div>
          {source.note && (
            <p className="source__note" style={{ marginLeft: 22 }}>
              {source.note}
            </p>
          )}
        </div>
      ))}

      <h2 style={{ marginTop: 28 }}>Independent cross-check</h2>
      <p className="source__note" style={{ marginLeft: 0 }}>
        The ABS publishes its own dwelling price figures. They are shown here so the numbers above
        can be checked against an official series. <strong>They will not match</strong>, and that
        is expected rather than a discrepancy: these are <em>mean</em> prices by <em>state</em> for
        a quarter that ended three months earlier, while the calculator uses composition-adjusted
        <em> median</em> values by <em>capital city</em>. A state includes its regional areas; a
        mean is pulled upward by expensive sales that a median ignores.
      </p>

      <div className="table-scroll">
        <table className="crosscheck-table">
          <caption className="visually-hidden">
            ABS mean price of residential dwellings by state, March quarter 2026
          </caption>
          <thead>
            <tr>
              <th scope="col">State / territory</th>
              <th scope="col">ABS mean dwelling price</th>
            </tr>
          </thead>
          <tbody>
            {ABS_MEAN_DWELLING_PRICES.map((row) => (
              <tr key={row.code}>
                <th scope="row" style={{ fontWeight: row.code === 'AUS' ? 700 : 400 }}>
                  {row.name}
                </th>
                <td>{currency(row.meanPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="disclosure-details" style={{ marginTop: 20 }}>
        <summary>On the ABS series this calculator does not use</summary>
        <div className="disclosure-details__body">
        Most Australian house
        price commentary still cites the ABS Residential Property Price Indexes: Eight Capital
        Cities. That series was discontinued after December quarter 2021 and has not been updated
        since. Its ABS successor reports mean prices by state rather than medians by city, which
        cannot drive a city-level deposit target — which is why the price data here comes from
        Cotality.
        </div>
      </details>
    </section>
  );
}
