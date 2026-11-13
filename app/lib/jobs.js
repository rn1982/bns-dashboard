// The list of live sources, shared by the daily cron, the "revert to live"
// button of the manual form, and the history backfill.
//
// Each job fetches a SERIES ({ points: [{ date, value }], source }, ascending):
//   - the last point becomes the current value in latest_indicators (writeLive),
//   - every point of the window goes into indicator_history (appendHistory).
import { writeLive } from './db';
import { appendHistory } from './history';
import { stanceFromSeries } from './stance';
import { daysAgo } from './sources/http';
import { snbPolicyRateSeries, snbCpiSeries, snbRealGdpYoYSeries, snbUnemploymentSeries } from './sources/snb';
import { fsoCpiSeries } from './sources/fso';
import { eurChfSeries, ecbDepositRateSeries } from './sources/ecb';
import { fedRateSeries } from './sources/fred';

// Try several sources for the same indicator and keep the series with the most
// recent last point (first source wins a tie). Fails only if every source fails.
export function newestOf(...seriesFns) {
  return async from => {
    const settled = await Promise.allSettled(seriesFns.map(f => f(from)));
    const ok = settled.filter(s => s.status === 'fulfilled' && s.value.points.length).map(s => s.value);
    if (!ok.length) throw new Error(settled.map(s => s.reason?.message || 'no data').join(' | '));
    const lastDate = s => s.points[s.points.length - 1].date;
    const best = ok.reduce((a, b) => (lastDate(b) > lastDate(a) ? b : a));
    const failed = settled.filter(s => s.status === 'rejected').map(s => s.reason?.message);
    return failed.length ? { ...best, warnings: failed } : best;
  };
}

// indicator key -> { series, windowDays, stanceCol }
//   windowDays: how far back the daily cron fetches (enough for the 90-day stance,
//               the GDP year-on-year maths, and to catch revisions of recent points).
// Real estate and SARON futures have no verified live source yet: they stay manual.
export const JOBS = {
  snb_rate:      { series: snbPolicyRateSeries, windowDays: 30 },
  inflation:     { series: newestOf(fsoCpiSeries, snbCpiSeries), windowDays: 400 }, // FSO is ~3 weeks ahead of SNB
  exchange_rate: { series: eurChfSeries, windowDays: 14 },
  ecb_rate:      { series: ecbDepositRateSeries, windowDays: 130, stanceCol: 'ecb_stance' },
  fed_rate:      { series: fedRateSeries, windowDays: 130, stanceCol: 'fed_stance' },
  gdp:           { series: snbRealGdpYoYSeries, windowDays: 3 * 365 },
  unemployment:  { series: snbUnemploymentSeries, windowDays: 400 },
};

async function fetchSeries(key, from) {
  const job = JOBS[key];
  if (!job) throw new Error(`${key} has no live source`);
  const s = await job.series(from);
  if (!s.points.length) throw new Error(`${key}: no observations since ${from}`);
  return s;
}

/**
 * Fetch one indicator, write its current value and its recent history.
 * dryRun: fetch only. force: overwrite even a newer manual value ("revert to live").
 */
export async function runJob(key, { dryRun = false, force = false } = {}) {
  const job = JOBS[key];
  const s = await fetchSeries(key, daysAgo(job?.windowDays ?? 30));
  const last = s.points[s.points.length - 1];
  const st = job.stanceCol ? stanceFromSeries(s.points) : null;
  const warnings = [...(s.warnings || [])];

  let status = 'dry_run';
  let historyPoints = null;
  if (!dryRun) {
    status = await writeLive(
      key,
      { value: last.value, date: last.date, source: s.source, extra: st ? { [job.stanceCol]: st.stance } : undefined },
      { force }
    );
    // The current value is what matters most: a history failure is reported, not fatal.
    try {
      historyPoints = await appendHistory(key, s.points, { origin: 'live', source: s.source });
    } catch (e) {
      warnings.push(`history not saved: ${e.message}`);
    }
  }

  return {
    status, // 'updated' | 'kept_manual' | 'dry_run'
    value: last.value,
    observedAt: last.date,
    source: s.source,
    ...(historyPoints !== null && { historyPointsWritten: historyPoints }),
    ...(st && {
      stance: st.stance,
      stanceDetail: `${st.from.value}% on ${st.from.date} → ${st.to.value}% on ${st.to.date}`,
    }),
    ...(warnings.length && { warnings }),
  };
}

/** Fetch an indicator's whole series since `from` and store it in indicator_history. */
export async function runBackfill(key, from, { dryRun = false } = {}) {
  const s = await fetchSeries(key, from);
  const written = dryRun ? null : await appendHistory(key, s.points, { origin: 'live', source: s.source });
  return {
    status: dryRun ? 'dry_run' : 'saved',
    points: s.points.length,
    first: s.points[0].date,
    last: s.points[s.points.length - 1].date,
    source: s.source,
    ...(written !== null && { pointsWritten: written }),
    ...(s.warnings && { warnings: s.warnings }),
  };
}
