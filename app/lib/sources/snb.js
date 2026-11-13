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

/** Swiss CPI, % change vs same month a year earlier (monthly, published by FSO, relayed by SNB). */
export async function fetchSwissCpiYoY() {
  const values = await fetchSnbSeries('plkopr', 'VVP', daysAgo(400).slice(0, 7));
  const last = values[values.length - 1];
  return {
    value: Math.round(last.value * 100) / 100,
    date: toDate(last.date),
    source: 'SNB data portal (plkopr, CPI YoY)',
  };
}
