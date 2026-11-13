// FRED (St. Louis Fed): needs FRED_API_KEY. https://fred.stlouisfed.org/docs/api/
import { fetchJson, daysAgo } from './http';
import { stanceFromSeries } from '../stance';

export const FRED_SERIES = {
  FED_RATE: 'DFEDTARU', // Fed funds target range, upper limit (daily)
  SWISS_REAL_GDP: 'CLVNASAC01CHQ189S', // Swiss real GDP level, quarterly (CHF, chained volumes)
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

/**
 * Swiss real GDP growth, % vs the same quarter one year earlier.
 * The FRED series is a LEVEL (~CHF 180bn per quarter); the model needs a growth rate.
 */
export async function fetchSwissGdpYoY() {
  const obs = await fetchFredObservations(FRED_SERIES.SWISS_REAL_GDP, daysAgo(3 * 365));
  if (obs.length < 5) throw new Error('FRED GDP: fewer than 5 quarters available');
  const last = obs[obs.length - 1];
  const yearAgo = obs[obs.length - 5];
  const growth = (last.value / yearAgo.value - 1) * 100;
  return {
    value: Math.round(growth * 100) / 100,
    date: last.date,
    source: `FRED (${FRED_SERIES.SWISS_REAL_GDP}, YoY computed)`,
  };
}
