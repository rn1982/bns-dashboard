// Swiss National Bank data portal: https://data.snb.ch (public, no API key).
// Response shape: { timeseries: [{ metadata: { key: 'EPB@SNB.<cube>{<ITEM>}' }, values: [{ date, value }] }] }
//
// Every function here returns a SERIES: { points: [{ date: 'YYYY-MM-DD', value }], source },
// ascending by date, starting on or after `from` ('YYYY-MM-DD').
// The daily cron uses the last point as the current value and stores the whole
// window in indicator_history; the backfill route asks for everything since 2000.
import { fetchJson } from './http.js';

async function fetchSnbSeries(cube, item, fromPeriod) {
  const url = `https://data.snb.ch/api/cube/${cube}/data/json/en?fromDate=${fromPeriod}`;
  const data = await fetchJson(url, { label: `SNB ${cube}`, timeoutMs: 30000 });
  const series = (data.timeseries || []).find(t => t.metadata?.key?.endsWith(`{${item}}`));
  if (!series) throw new Error(`SNB ${cube}: series ${item} not found in response`);
  const values = (series.values || []).filter(v => typeof v.value === 'number');
  if (values.length === 0) throw new Error(`SNB ${cube}/${item}: no values since ${fromPeriod}`);
  return values;
}

const round2 = v => Math.round(v * 100) / 100;

// Monthly dates come as 'YYYY-MM'; store them as the first day of the month.
const monthToDate = d => (/^\d{4}-\d{2}$/.test(d) ? `${d}-01` : d);

/** '2026-Q2' -> '2026-04-01' (first day of the quarter). */
export function quarterToDate(q) {
  const [y, n] = q.split('-Q');
  return `${y}-${String((Number(n) - 1) * 3 + 1).padStart(2, '0')}-01`;
}

/** '2026-05-17' -> '2026-Q2' */
export function dateToQuarter(d) {
  return `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
}

/**
 * Quarterly LEVELS -> growth vs the same quarter one year earlier, in %.
 * values: [{ date: 'YYYY-Qn', value }] ascending and without gaps (as the SNB sends them).
 */
export function yoyFromQuarterlyLevels(values) {
  const out = [];
  for (let i = 4; i < values.length; i++) {
    out.push({ date: quarterToDate(values[i].date), value: round2((values[i].value / values[i - 4].value - 1) * 100) });
  }
  return out;
}

/** SNB policy rate (daily). The series starts 2019-06-13, when the SNB introduced it. */
export async function snbPolicyRateSeries(from) {
  const values = await fetchSnbSeries('snbgwdzid', 'LZ', from);
  return {
    points: values.map(v => ({ date: monthToDate(v.date), value: v.value })),
    source: 'SNB data portal (snbgwdzid, policy rate)',
  };
}

/**
 * Swiss CPI, % change vs same month a year earlier (monthly). FSO data relayed by
 * SNB, usually ~3 weeks after FSO publishes: backup for fsoCpiSeries.
 */
export async function snbCpiSeries(from) {
  const values = await fetchSnbSeries('plkopr', 'VVP', from.slice(0, 7));
  return {
    points: values.map(v => ({ date: monthToDate(v.date), value: round2(v.value) })),
    source: 'SNB data portal (plkopr, CPI YoY)',
  };
}

/**
 * Swiss real GDP growth, % vs the same quarter one year earlier, dated at the start of the quarter.
 * gdprpq = "GDP by type of expenditure – real", seasonally and calendar adjusted (SECO data).
 * BBIPS = GDP adjusted for sporting events (the headline SECO figure). WMF = level in CHF m.
 * (gdpap is the NOMINAL table: do not use it here.)
 */
export async function snbRealGdpYoYSeries(from) {
  // Growth needs the level four quarters earlier, so start one year before `from`.
  const yearBefore = `${Number(from.slice(0, 4)) - 1}${from.slice(4)}`;
  const levels = await fetchSnbSeries('gdprpq', 'WMF,BBIPS', dateToQuarter(yearBefore));
  if (levels.length < 5) throw new Error('SNB gdprpq: fewer than 5 quarters available');
  return {
    points: yoyFromQuarterlyLevels(levels).filter(p => p.date >= quarterToDate(dateToQuarter(from))),
    source: 'SNB data portal (gdprpq, real GDP YoY)',
  };
}

/** Jobless rate, seasonally adjusted (SECO registered unemployment, monthly). */
export async function snbUnemploymentSeries(from) {
  const values = await fetchSnbSeries('amarbma', 'S1', from.slice(0, 7));
  return {
    points: values.map(v => ({ date: monthToDate(v.date), value: round2(v.value) })),
    source: 'SNB data portal (amarbma, jobless rate SA)',
  };
}
