// Daily cron (see vercel.json). Fetches every live source directly (no HTTP calls
// to our own deployment) and writes each indicator with its observation date,
// source and origin. Returns a per-indicator report; HTTP 500 if anything failed.
import { NextResponse } from 'next/server';
import { checkCronAuth } from '../../../lib/cronAuth';
import { ensureSchema, writeLive, saveCronReport } from '../../../lib/db';
import {
  fetchSnbPolicyRate,
  fetchSwissCpiYoY,
  fetchSwissRealGdpYoY,
  fetchSwissUnemployment,
} from '../../../lib/sources/snb';
import { fetchFsoCpiYoY } from '../../../lib/sources/fso';
import { fetchEurChf, fetchEcbDepositRate } from '../../../lib/sources/ecb';
import { fetchFedRate } from '../../../lib/sources/fred';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
const JOBS = {
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

async function runJob(key, fetcher, dryRun) {
  const r = await fetcher();
  const status = dryRun ? 'dry_run' : await writeLive(key, {
    value: r.value,
    date: r.date,
    source: r.source,
    extra: EXTRA[key]?.(r),
  });
  return {
    status, // 'updated' | 'kept_manual' | 'dry_run'
    value: r.value,
    observedAt: r.date,
    source: r.source,
    ...(r.stance && { stance: r.stance, stanceDetail: r.stanceDetail }),
    ...(r.warnings && { warnings: r.warnings }),
  };
}

export async function GET(request) {
  const authError = checkCronAuth(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  // ?dryRun=1 fetches every source and reports, but writes nothing.
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
  const startedAt = new Date().toISOString();
  if (!dryRun) {
    try {
      await ensureSchema();
    } catch (e) {
      return NextResponse.json({ ok: false, error: `Database error: ${e.message}` }, { status: 500 });
    }
  }

  const keys = Object.keys(JOBS);
  const settled = await Promise.allSettled(keys.map(k => runJob(k, JOBS[k], dryRun)));

  const results = {};
  const failures = [];
  settled.forEach((s, i) => {
    const key = keys[i];
    if (s.status === 'fulfilled') {
      results[key] = s.value;
    } else {
      results[key] = { status: 'failed', error: s.reason?.message || String(s.reason) };
      failures.push(key);
    }
  });

  const report = {
    ok: failures.length === 0,
    dryRun,
    startedAt,
    finishedAt: new Date().toISOString(),
    failures,
    results,
    ...(!process.env.CRON_SECRET && { warning: 'CRON_SECRET is not set: this endpoint is public.' }),
  };

  if (!dryRun) {
    try {
      await saveCronReport(report);
    } catch (e) {
      report.reportSaveError = e.message;
    }
  }

  return NextResponse.json(report, { status: report.ok ? 200 : 500 });
}
