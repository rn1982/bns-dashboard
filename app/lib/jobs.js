// The list of live fetchers, shared by the daily cron and the "revert to live"
// button of the manual form.
import { writeLive } from './db';
import {
  fetchSnbPolicyRate,
  fetchSwissCpiYoY,
  fetchSwissRealGdpYoY,
  fetchSwissUnemployment,
} from './sources/snb';
import { fetchFsoCpiYoY } from './sources/fso';
import { fetchEurChf, fetchEcbDepositRate } from './sources/ecb';
import { fetchFedRate } from './sources/fred';

// Try several sources for the same indicator and keep the most recent observation
// (first source wins a tie). Fails only if every source fails.
function latestOf(...fetchers) {
  return async () => {
    const settled = await Promise.allSettled(fetchers.map(f => f()));
    const ok = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
    if (!ok.length) throw new Error(settled.map(s => s.reason?.message).join(' | '));
    const best = ok.reduce((a, b) => (b.date > a.date ? b : a));
    const failed = settled.filter(s => s.status === 'rejected').map(s => s.reason?.message);
    return failed.length ? { ...best, warnings: failed } : best;
  };
}

// indicator key -> fetcher. Real estate and SARON futures have no verified live
// source yet: they stay manual.
export const JOBS = {
  snb_rate: fetchSnbPolicyRate,
  inflation: latestOf(fetchFsoCpiYoY, fetchSwissCpiYoY), // FSO is ~3 weeks ahead of SNB
  exchange_rate: fetchEurChf,
  ecb_rate: fetchEcbDepositRate,
  fed_rate: fetchFedRate,
  gdp: fetchSwissRealGdpYoY,
  unemployment: fetchSwissUnemployment,
};

const EXTRA = {
  ecb_rate: r => ({ ecb_stance: r.stance }),
  fed_rate: r => ({ fed_stance: r.stance }),
};

/**
 * Fetch one indicator and write it.
 * dryRun: fetch only. force: overwrite even a newer manual value ("revert to live").
 */
export async function runJob(key, { dryRun = false, force = false } = {}) {
  const fetcher = JOBS[key];
  if (!fetcher) throw new Error(`${key} has no live source`);
  const r = await fetcher();
  const status = dryRun ? 'dry_run' : await writeLive(key, {
    value: r.value,
    date: r.date,
    source: r.source,
    extra: EXTRA[key]?.(r),
  }, { force });
  return {
    status, // 'updated' | 'kept_manual' | 'dry_run'
    value: r.value,
    observedAt: r.date,
    source: r.source,
    ...(r.stance && { stance: r.stance, stanceDetail: r.stanceDetail }),
    ...(r.warnings && { warnings: r.warnings }),
  };
}
