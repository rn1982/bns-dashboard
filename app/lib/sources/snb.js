// Swiss National Bank data portal: https://data.snb.ch (public, no API key).
// Response shape: { timeseries: [{ metadata: { key: 'EPB@SNB.<cube>{<ITEM>}' }, values: [{ date, value }] }] }
import { fetchJson, daysAgo } from './http';

async function fetchSnbSeries(cube, item, fromDate) {
  const url = `https://data.snb.ch/api/cube/${cube}/data/json/en?fromDate=${fromDate}`;
  const data = await fetchJson(url, { label: `SNB ${cube}` });
  const series = (data.timeseries || []).find(t => t.metadata?.key?.endsWith(`{${item}}`));
  if (!series) throw new Error(`SNB ${cube}: series ${item} not found in response`);
  const values = (series.values || []).filter(v => typeof v.value === 'number');
  if (values.length === 0) throw new Error(`SNB ${cube}/${item}: no values since ${fromDate}`);
  return values;
}

// Monthly dates come as 'YYYY-MM'; store them as the first day of the month.
const toDate = d => (/^\d{4}-\d{2}$/.test(d) ? `${d}-01` : d);

/** SNB policy rate (daily series, last published value). */
export async function fetchSnbPolicyRate() {
  const values = await fetchSnbSeries('snbgwdzid', 'LZ', daysAgo(30));
  const last = values[values.length - 1];
  return { value: last.value, date: toDate(last.date), source: 'SNB data portal (snbgwdzid, policy rate)' };
}

/**
 * Swiss CPI, % change vs same month a year earlier (monthly). FSO data relayed by
 * SNB, usually ~3 weeks after FSO publishes: backup for fetchFsoCpiYoY.
 */
export async function fetchSwissCpiYoY() {
  const values = await fetchSnbSeries('plkopr', 'VVP', daysAgo(400).slice(0, 7));
  const last = values[values.length - 1];
  return {
    value: Math.round(last.value * 100) / 100,
    date: toDate(last.date),
    source: 'SNB data portal (plkopr, CPI YoY)',
  };
}

/**
 * Swiss real GDP growth, % vs the same quarter one year earlier.
 * gdprpq = "GDP by type of expenditure – real", seasonally and calendar adjusted (SECO data).
 * BBIPS = GDP adjusted for sporting events (the headline SECO figure). WMF = level in CHF m.
 * (gdpap is the NOMINAL table: do not use it here.)
 */
export async function fetchSwissRealGdpYoY() {
  const values = await fetchSnbSeries('gdprpq', 'WMF,BBIPS', `${new Date().getUTCFullYear() - 3}-Q1`);
  if (values.length < 5) throw new Error('SNB gdprpq: fewer than 5 quarters available');
  const last = values[values.length - 1];
  const yearAgo = values[values.length - 5];
  const growth = (last.value / yearAgo.value - 1) * 100;
  // '2026-Q2' -> '2026-04-01' (first day of the quarter)
  const [y, q] = last.date.split('-Q');
  const date = `${y}-${String((Number(q) - 1) * 3 + 1).padStart(2, '0')}-01`;
  return {
    value: Math.round(growth * 100) / 100,
    date,
    source: `SNB data portal (gdprpq, real GDP ${yearAgo.date} → ${last.date})`,
  };
}

/** Jobless rate, seasonally adjusted (SECO registered unemployment, monthly). */
export async function fetchSwissUnemployment() {
  const values = await fetchSnbSeries('amarbma', 'S1', daysAgo(400).slice(0, 7));
  const last = values[values.length - 1];
  return {
    value: Math.round(last.value * 100) / 100,
    date: toDate(last.date),
    source: 'SNB data portal (amarbma, jobless rate SA)',
  };
}
