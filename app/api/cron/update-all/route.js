// Daily cron (see vercel.json). Fetches every live source directly (no HTTP calls
// to our own deployment) and writes each indicator with its observation date,
// source and origin. Returns a per-indicator report; HTTP 500 if anything failed.
import { NextResponse } from 'next/server';
import { checkCronAuth } from '../../../lib/cronAuth';
import { ensureSchema, saveCronReport } from '../../../lib/db';
import { JOBS, runJob } from '../../../lib/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const settled = await Promise.allSettled(keys.map(k => runJob(k, { dryRun })));

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
