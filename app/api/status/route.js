// When did the cron last run, and did every source work?
// Shown as a banner at the top of the dashboard.
import { NextResponse } from 'next/server';
import { readRow } from '../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const manualAuthRequired = Boolean(process.env.MANUAL_UPDATE_SECRET);
  try {
    const row = await readRow();
    const report = row.last_cron_report || null;
    const failures = report?.failures || [];
    return NextResponse.json({
      lastCronRunAt: row.last_cron_run_at ? new Date(row.last_cron_run_at).toISOString() : null,
      cronOk: report ? report.ok === true : null,
      failures: failures.map(k => ({ key: k, error: report.results?.[k]?.error || 'unknown error' })),
      manualAuthRequired,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message, manualAuthRequired }, { status: 500 });
  }
}
