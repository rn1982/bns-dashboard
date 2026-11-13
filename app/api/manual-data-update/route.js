// Manual override, used by app/components/ManualDataInput.js.
// A manual value is stored with origin = 'manual' and is kept until the cron
// finds a live observation dated AFTER it (see writeLive in app/lib/db.js).
//
// Body: { inflation, snbRate, saronFutures, gdp, unemployment, realEstate, exchangeRate }
// Optional: observedAt ('YYYY-MM-DD', the date the values refer to; defaults to today).
import { NextResponse } from 'next/server';
import { ensureSchema, writeManual } from '../../lib/db';
import { INDICATORS } from '../../lib/indicators';

export const dynamic = 'force-dynamic';

// request field -> indicator key
const FIELDS = {
  inflation: 'inflation',
  snbRate: 'snb_rate',
  saronFutures: 'saron_futures',
  gdp: 'gdp',
  unemployment: 'unemployment',
  realEstate: 'real_estate',
  exchangeRate: 'exchange_rate',
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Body must be JSON' }, { status: 400 });
  }

  const observedAt = body.observedAt || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) {
    return NextResponse.json({ success: false, error: 'observedAt must be YYYY-MM-DD' }, { status: 400 });
  }

  // Validate everything first, so a bad field doesn't leave a half-applied update.
  const updates = [];
  const errors = [];
  for (const [field, key] of Object.entries(FIELDS)) {
    if (body[field] === undefined || body[field] === null || body[field] === '') continue;
    const value = Number(body[field]);
    const { min, max } = INDICATORS[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      errors.push(`${field} must be a number between ${min} and ${max}`);
      continue;
    }
    const extra = key === 'saron_futures' ? { market_implied_rate: Math.round((100 - value) * 1000) / 1000 } : undefined;
    updates.push({ field, key, value, extra });
  }

  if (errors.length) return NextResponse.json({ success: false, error: errors.join('; ') }, { status: 400 });
  if (!updates.length) return NextResponse.json({ success: false, error: 'No valid data provided' }, { status: 400 });

  try {
    await ensureSchema();
    for (const u of updates) {
      await writeManual(u.key, { value: u.value, date: observedAt, extra: u.extra });
    }
  } catch (e) {
    console.error('Manual data update failed:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Manual data update completed',
    updatedFields: updates.map(u => u.field),
    observedAt,
    timestamp: new Date().toISOString(),
  });
}
