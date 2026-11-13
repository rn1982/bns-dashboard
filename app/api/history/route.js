// Time series of one indicator, for charts. Reads indicator_history only.
//
//   GET /api/history?indicator=inflation[&from=YYYY-MM-DD][&to=YYYY-MM-DD][&freq=raw|monthly]
//
// from defaults to 2000-01-01, to to today. freq defaults to 'monthly' when the
// range is longer than 2 years (a daily series since 2000 is ~9,000 points),
// otherwise 'raw'. Monthly = last observation of each month.
import { NextResponse } from 'next/server';
import { ensureSchema } from '../../lib/db';
import { readHistory } from '../../lib/history';
import { INDICATORS } from '../../lib/indicators';
import { daysAgo } from '../../lib/sources/http';

export const dynamic = 'force-dynamic';

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const key = q.get('indicator');
  const ind = INDICATORS[key];
  if (!ind) {
    return NextResponse.json(
      { error: `indicator must be one of: ${Object.keys(INDICATORS).join(', ')}` },
      { status: 400 }
    );
  }
  const from = q.get('from') || '2000-01-01';
  const to = q.get('to') || new Date().toISOString().slice(0, 10);
  if (!isDate(from) || !isDate(to) || from > to) {
    return NextResponse.json({ error: 'from and to must be dates YYYY-MM-DD with from <= to' }, { status: 400 });
  }
  const freq = q.get('freq') || (from < daysAgo(730) ? 'monthly' : 'raw');
  if (!['raw', 'monthly'].includes(freq)) {
    return NextResponse.json({ error: "freq must be 'raw' or 'monthly'" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const points = await readHistory(key, { from, to, freq });
    return NextResponse.json({
      indicator: key,
      label: ind.label,
      unit: ind.unit,
      from,
      to,
      freq,
      count: points.length,
      sources: [...new Set(points.map(p => p.source))],
      points: points.map(({ date, value, origin }) => ({ date, value, origin })),
    });
  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
