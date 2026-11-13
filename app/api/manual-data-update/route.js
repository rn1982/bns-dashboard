// Manual override, used by app/components/ManualDataInput.js.
// A manual value is stored with origin = 'manual' and is kept until the cron
// finds a live observation dated AFTER it (see writeLive in app/lib/db.js).
//
// Body (every field optional, send only what you want to change):
//   inflation, snbRate, gdp, unemployment, realEstate, exchangeRate, saronFutures,
//   ecbRate, ecbStance, fedRate, fedStance    numbers / stance strings
//   nextMeeting   'YYYY-MM-DD'
//   observedAt    'YYYY-MM-DD', the date the values refer to (default: today)
//   revert        ['inflation', ...] indicator keys: drop the manual value and fetch live now
//
// Protection: if MANUAL_UPDATE_SECRET is set, the request needs the header
// `x-admin-key: <MANUAL_UPDATE_SECRET>`. If it is not set, anyone can write.
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { ensureSchema, writeManual, writeNextMeeting, readRow } from '../../lib/db';
import { INDICATORS, STANCES } from '../../lib/indicators';
import { runJob, JOBS } from '../../lib/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// request field -> indicator key
const FIELDS = {
  inflation: 'inflation',
  snbRate: 'snb_rate',
  saronFutures: 'saron_futures',
  gdp: 'gdp',
  unemployment: 'unemployment',
  realEstate: 'real_estate',
  exchangeRate: 'exchange_rate',
  ecbRate: 'ecb_rate',
  fedRate: 'fed_rate',
};

// stance field -> [indicator key, stance column, rate field]
const STANCE_FIELDS = {
  ecbStance: ['ecb_rate', 'ecb_stance', 'ecbRate'],
  fedStance: ['fed_rate', 'fed_stance', 'fedRate'],
};

const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isBlank = v => v === undefined || v === null || v === '';

function checkAuth(request) {
  const secret = process.env.MANUAL_UPDATE_SECRET;
  if (!secret) return null;
  const given = Buffer.from(request.headers.get('x-admin-key') || '');
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want) ? null : 'Wrong or missing admin key';
}

export async function POST(request) {
  const authError = checkAuth(request);
  if (authError) return NextResponse.json({ success: false, error: authError }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Body must be JSON' }, { status: 400 });
  }

  const observedAt = isBlank(body.observedAt) ? new Date().toISOString().slice(0, 10) : body.observedAt;
  const errors = [];
  if (!isDate(observedAt)) errors.push('observedAt must be a date YYYY-MM-DD');
  else if (observedAt > new Date().toISOString().slice(0, 10)) errors.push('observedAt cannot be in the future');

  // Validate everything first, so a bad field doesn't leave a half-applied update.
  const updates = new Map(); // indicator key -> { field, value, extra }
  for (const [field, key] of Object.entries(FIELDS)) {
    if (isBlank(body[field])) continue;
    const value = Number(body[field]);
    const { min, max } = INDICATORS[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      errors.push(`${field} must be a number between ${min} and ${max}`);
      continue;
    }
    const extra = key === 'saron_futures' ? { market_implied_rate: Math.round((100 - value) * 1000) / 1000 } : undefined;
    updates.set(key, { field, value, extra });
  }

  const stanceFieldsGiven = Object.keys(STANCE_FIELDS).filter(f => !isBlank(body[f]));
  for (const f of stanceFieldsGiven) {
    if (!STANCES.includes(body[f])) errors.push(`${f} must be one of: ${STANCES.join(', ')}`);
  }

  if (!isBlank(body.nextMeeting) && !isDate(body.nextMeeting)) errors.push('nextMeeting must be a date YYYY-MM-DD');

  const revert = Array.isArray(body.revert) ? body.revert : [];
  for (const key of revert) {
    if (!JOBS[key]) errors.push(`${key} has no live source to revert to`);
  }

  if (errors.length) return NextResponse.json({ success: false, error: errors.join('; ') }, { status: 400 });

  try {
    await ensureSchema();

    // A stance on its own: attach it to the stored rate (a stance is a column of the rate's row).
    if (stanceFieldsGiven.length) {
      const row = await readRow();
      for (const f of stanceFieldsGiven) {
        const [key, col, rateField] = STANCE_FIELDS[f];
        let u = updates.get(key);
        if (!u) {
          const stored = row[INDICATORS[key].valueCol];
          if (stored === null || stored === undefined) {
            return NextResponse.json({ success: false, error: `Enter ${rateField} too: no rate is stored yet` }, { status: 400 });
          }
          u = { field: f, value: Number(stored) };
          updates.set(key, u);
        }
        u.extra = { ...(u.extra || {}), [col]: body[f] };
      }
    }

    if (!updates.size && isBlank(body.nextMeeting) && !revert.length) {
      return NextResponse.json({ success: false, error: 'No data provided' }, { status: 400 });
    }

    for (const [key, u] of updates) {
      await writeManual(key, { value: u.value, date: observedAt, extra: u.extra });
    }
    if (!isBlank(body.nextMeeting)) await writeNextMeeting(body.nextMeeting);

    const reverted = {};
    for (const key of revert) {
      try {
        const r = await runJob(key, { force: true });
        reverted[key] = { status: 'updated', value: r.value, observedAt: r.observedAt };
      } catch (e) {
        // The manual value stays in place if the live source is down.
        reverted[key] = { status: 'failed', error: e.message };
      }
    }
    const revertFailed = Object.entries(reverted).filter(([, r]) => r.status === 'failed');

    return NextResponse.json({
      success: revertFailed.length === 0,
      ...(revertFailed.length && {
        error: `Could not fetch live data for ${revertFailed.map(([k]) => k).join(', ')}; the manual value was kept`,
      }),
      updatedFields: [...updates.values()].map(u => u.field).concat(isBlank(body.nextMeeting) ? [] : ['nextMeeting']),
      reverted,
      observedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Manual data update failed:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
