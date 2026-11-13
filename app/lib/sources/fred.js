// FRED (St. Louis Fed): needs FRED_API_KEY. https://fred.stlouisfed.org/docs/api/
// DFEDTARU starts 2008-12-16 (before that the Fed had a single target, not a range).
import { fetchJson } from './http';

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

/** Fed funds target range, upper limit (daily). The stance is computed by the caller (jobs.js). */
export async function fedRateSeries(from) {
  const points = await fetchFredObservations(FRED_SERIES.FED_RATE, from);
  return { points, source: `FRED (${FRED_SERIES.FED_RATE})` };
}
