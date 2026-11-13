// FRED (St. Louis Fed): needs FRED_API_KEY. https://fred.stlouisfed.org/docs/api/
import { fetchJson, daysAgo } from './http';
import { stanceFromSeries } from '../stance';

export const FRED_SERIES = {
  FED_RATE: 'DFEDTARU', // Fed funds target range, upper limit (daily)
};

async function fetchFredObservations(seriesId, observationStart) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error('FRED_API_KEY is not set');
  const url =
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
    `&api_key=${apiKey}&file_type=json&observation_start=${observationStart}`;
  // Label without the URL so the API key never appears in error messages.
  const data = await fetchJson(url, { label: `FRED ${seriesId}` });
  const obs = (data.observations || [])
    .map(o => ({ date: o.date, value: parseFloat(o.value) })) // FRED uses "." for missing
    .filter(o => Number.isFinite(o.value));
  if (obs.length === 0) throw new Error(`FRED ${seriesId}: no observations since ${observationStart}`);
  return obs; // ascending by date
}

/** Fed funds upper target + stance from its change over the last 90 days. */
export async function fetchFedRate() {
  const obs = await fetchFredObservations(FRED_SERIES.FED_RATE, daysAgo(130));
  const last = obs[obs.length - 1];
  const s = stanceFromSeries(obs);
  return {
    value: last.value,
    date: last.date,
    source: `FRED (${FRED_SERIES.FED_RATE})`,
    stance: s.stance,
    stanceDetail: `${s.from.value}% on ${s.from.date} → ${s.to.value}% on ${s.to.date}`,
  };
}
