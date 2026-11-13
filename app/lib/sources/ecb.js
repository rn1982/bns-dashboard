// European Central Bank data API: https://data-api.ecb.europa.eu (public, no API key).
// We ask for CSV because it is flat and easy to read: columns TIME_PERIOD and OBS_VALUE.
import Papa from 'papaparse';
import { fetchText, daysAgo } from './http';
import { stanceFromSeries } from '../stance';

async function fetchEcbSeries(flowAndKey, startPeriod, label) {
  const url = `https://data-api.ecb.europa.eu/service/data/${flowAndKey}?startPeriod=${startPeriod}&format=csvdata`;
  const text = await fetchText(url, { label });
  const { data } = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  const obs = data
    .map(r => ({ date: r.TIME_PERIOD, value: parseFloat(r.OBS_VALUE) }))
    .filter(o => o.date && Number.isFinite(o.value))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (obs.length === 0) throw new Error(`${label}: no observations since ${startPeriod}`);
  return obs;
}

/**
 * EUR/CHF = Swiss francs per 1 euro (e.g. 0.92). This is the scale the scoring
 * thresholds in /api/exchange-rate expect. Do NOT invert it.
 */
export async function fetchEurChf() {
  const obs = await fetchEcbSeries('EXR/D.CHF.EUR.SP00.A', daysAgo(14), 'ECB EUR/CHF');
  const last = obs[obs.length - 1];
  return { value: last.value, date: last.date, source: 'ECB reference rate (EXR)' };
}

/** ECB deposit facility rate + stance from its change over the last 90 days. */
export async function fetchEcbDepositRate() {
  const obs = await fetchEcbSeries('FM/D.U2.EUR.4F.KR.DFR.LEV', daysAgo(130), 'ECB deposit rate');
  const last = obs[obs.length - 1];
  const s = stanceFromSeries(obs);
  return {
    value: last.value,
    date: last.date,
    source: 'ECB data portal (FM, deposit facility rate)',
    stance: s.stance,
    stanceDetail: `${s.from.value}% on ${s.from.date} → ${s.to.value}% on ${s.to.date}`,
  };
}
