// One-off: fill indicator_history with each live source's past data. Not scheduled;
// run it by hand once (it is safe to run again: existing points are only updated
// if the source revised them). Protected by CRON_SECRET like the daily cron.
//
//   GET /api/cron/backfill[?from=2000-01-01][&indicator=inflation][&dryRun=1]
//
// Real estate and SARON futures have no live source, so their history only
// grows from manual entries.
import { NextResponse } from 'next/server';
import { checkCronAuth } from '../../../lib/cronAuth';
import { ensureSchema } from '../../../lib/db';
import { historySummary } from '../../../lib/history';
import { JOBS, runBackfill } from '../../../lib/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request) {
  const authError = checkCronAuth(request);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const q = new URL(request.url).searchParams;
  const dryRun = q.get('dryRun') === '1';
  const from = q.get('from') || '2000-01-01';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return NextResponse.json({ error: 'from must be a date YYYY-MM-DD' }, { status: 400 });
  }
  const only = q.get('indicator');
  if (only && !JOBS[only]) {
    return NextResponse.json({ error: `indicator must be one of: ${Object.keys(JOBS).join(', ')}` }, { status: 400 });
  }
  const keys = only ? [only] : Object.keys(JOBS);

  if (!dryRun) {
    try {
      await ensureSchema();
    } catch (e) {
      return NextResponse.json({ ok: false, error: `Database error: ${e.message}` }, { status: 500 });
    }
  }

  const settled = await Promise.allSettled(keys.map(k => runBackfill(k, from, { dryRun })));
  const results = {};
  const failures = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') results[keys[i]] = s.value;
    else {
      results[keys[i]] = { status: 'failed', error: s.reason?.message || String(s.reason) };
      failures.push(keys[i]);
    }
  });

  let summary = null;
  if (!dryRun) {
    try {
      summary = await historySummary();
    } catch (e) {
      summary = { error: e.message };
    }
  }

  return NextResponse.json(
    { ok: failures.length === 0, dryRun, from, failures, results, ...(summary && { tableSummary: summary }) },
    { status: failures.length ? 500 : 200 }
  );
}
