import { SOURCES, LAST_REFRESHED_ISO } from '../data/sources';
import { assessPipeline, describeAge, staleSources } from '../lib/freshness';

/**
 * Shown only when a source is overdue for a newer edition, or when the
 * automated refresh has stopped running.
 *
 * Deliberately not dismissable: if the figures on screen have been superseded,
 * that is not a notification, it is a property of what the reader is looking at.
 */
export function FreshnessBanner() {
  const stale = staleSources(SOURCES);
  const pipeline = assessPipeline(LAST_REFRESHED_ISO);

  if (stale.length === 0 && !pipeline.hasStalled) return null;

  return (
    <section className="stale-banner" role="status">
      <p className="stale-banner__title">
        {stale.length > 0
          ? 'Some of this data is due for an update'
          : 'Automatic data updates have stopped'}
      </p>

      {pipeline.hasStalled && (
        <p className="stale-banner__note" style={{ marginTop: 0, marginBottom: 10 }}>
          The scheduled refresh last ran {describeAge(pipeline.daysSinceRefresh)} (
          {pipeline.lastRefreshedISO}). The cash rate, earnings and saving-ratio figures below
          are whatever it last retrieved successfully, so treat them as of that date.
        </p>
      )}
      <ul className="stale-banner__list" hidden={stale.length === 0}>
        {stale.map(({ source, daysSinceRelease }) => (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>{' '}
            — the edition used here is {describeAge(daysSinceRelease)}, and {source.publisher} is
            expected to have published a newer one.
          </li>
        ))}
      </ul>
      {stale.length > 0 && (
        <p className="stale-banner__note">
          The numbers below are still exactly what the cited releases said on the date they were
          read. They are just no longer the latest available — follow the links for current
          figures.
        </p>
      )}
    </section>
  );
}
