// Past SNB meetings: per meeting, the indicator values and scores the model would
// have seen the day before (respecting publication lags), and what the SNB did.
// The page turns the scores into a verdict with the current weights.
// Reads indicator_history only (see app/lib/replay.js for the logic and its limits).
import { NextResponse } from 'next/server';
import { ensureSchema } from '../../lib/db';
import { readHistory } from '../../lib/history';
import { replayAll, REPLAY_INPUTS, SNB_MEETINGS, PUBLICATION_LAG_DAYS } from '../../lib/replay';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureSchema();
    const keys = [...new Set([...Object.values(REPLAY_INPUTS).map(d => d.history), 'snb_rate'])];
    const to = new Date().toISOString().slice(0, 10);
    // From 2018: enough for the 90-day stance and the GDP / CPI lags before Sept 2019.
    const series = await Promise.all(keys.map(k => readHistory(k, { from: '2018-01-01', to, freq: 'raw' })));
    const histories = Object.fromEntries(keys.map((k, i) => [k, series[i]]));
    return NextResponse.json({
      meetings: replayAll(histories, SNB_MEETINGS),
      publicationLagDays: PUBLICATION_LAG_DAYS,
      notes: [
        'The model sees only data published before each meeting (approximate publication lags).',
        'Values are today\'s vintage: GDP has been revised since, so past GDP readings differ from what the SNB saw.',
        'Real estate has no history unless entered manually, so most replays run without its weight.',
      ],
    });
  } catch (error) {
    console.error('Replay API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
