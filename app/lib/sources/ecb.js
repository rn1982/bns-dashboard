// European Central Bank data API: https://data-api.ecb.europa.eu (public, no API key).
// Each *Series(from) function returns { points: [{ date, value }], source }, ascending.
// We ask for CSV because it is flat and easy to read: columns TIME_PERIOD and OBS_VALUE.
import Papa from 'papaparse';
import { fetchText } from './http';

async function fetchEcbSeries(flowAndKey, startPeriod, label) {
  const url = `https://data-api.ecb.europa.eu/service/data/${flowAndKey}?startPeriod=${startPeriod}&format=csvdata`;
  const text = await fetchText(url, { label, timeoutMs: 30000 });
  const { data } = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  const obs = data
    .map(r => ({ date: r.TIME_PERIOD, value: parseFloat(r.OBS_VALUE) }))
    .filter(o => o.date && Number.isFinite(o.value))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (obs.length === 0) throw new Error(`${label}: no observations since ${startPeriod}`);
  return obs;
}

/**
 * EUR/CHF = Swiss francs per 1 euro (e.g. 0.92), daily. This is the scale the scoring
 * thresholds in /api/exchange-rate expect. Do NOT invert it.
 */
export async function eurChfSeries(from) {
  const points = await fetchEcbSeries('EXR/D.CHF.EUR.SP00.A', from, 'ECB EUR/CHF');
  return { points, source: 'ECB reference rate (EXR)' };
}

/** ECB deposit facility rate (daily). The stance is computed by the caller (jobs.js). */
export async function ecbDepositRateSeries(from) {
  const points = await fetchEcbSeries('FM/D.U2.EUR.4F.KR.DFR.LEV', from, 'ECB deposit rate');
  return { points, source: 'ECB data portal (FM, deposit facility rate)' };
}
