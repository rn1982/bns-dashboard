import { sql } from '@vercel/postgres';
import { INDICATORS } from './indicators.js';
import { freshness, toDateString } from './freshness.js';

let schemaReady = false;

// Adds the provenance columns (observed_at / origin / source) if they are missing.
// `ADD COLUMN IF NOT EXISTS` makes this safe to run on every request: it changes
// nothing once the columns exist. The repo has no migration tool, so this is
// how the schema evolves.
export async function ensureSchema() {
  if (schemaReady) return;
  const cols = [];
  for (const ind of Object.values(INDICATORS)) {
    cols.push(`ADD COLUMN IF NOT EXISTS ${ind.prefix}_observed_at DATE`);
    cols.push(`ADD COLUMN IF NOT EXISTS ${ind.prefix}_origin TEXT`);
    cols.push(`ADD COLUMN IF NOT EXISTS ${ind.prefix}_source TEXT`);
  }
  // Columns that older code never created.
  cols.push('ADD COLUMN IF NOT EXISTS saron_updated_at TIMESTAMPTZ');
  cols.push('ADD COLUMN IF NOT EXISTS last_cron_run_at TIMESTAMPTZ');
  cols.push('ADD COLUMN IF NOT EXISTS last_cron_report JSONB');
  cols.push('ADD COLUMN IF NOT EXISTS next_meeting_date TEXT');
  cols.push('ADD COLUMN IF NOT EXISTS next_meeting_updated_at TIMESTAMPTZ');
  await sql.query(`ALTER TABLE latest_indicators ${cols.join(', ')}`);
  schemaReady = true;
}

function buildSet(ind, { value, date, source, origin, extra = {} }) {
  const sets = [];
  const params = [];
  const add = (col, v) => {
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  };
  add(ind.valueCol, value);
  add(`${ind.prefix}_observed_at`, date);
  add(`${ind.prefix}_source`, source);
  add(`${ind.prefix}_origin`, origin);
  for (const [col, v] of Object.entries(extra)) {
    if (!(ind.extraCols || []).includes(col)) throw new Error(`Column ${col} not allowed for ${ind.prefix}`);
    add(col, v);
  }
  sets.push(`${ind.updatedCol} = NOW()`);
  return { sets, params };
}

/**
 * Write a value fetched by the cron.
 *
 * Rule: a manual value wins until a live observation that is NEWER than it arrives.
 * Returns 'updated' or 'kept_manual'.
 */
export async function writeLive(key, { value, date, source, extra }, { force = false } = {}) {
  const ind = INDICATORS[key];
  if (!ind) throw new Error(`Unknown indicator ${key}`);
  const { sets, params } = buildSet(ind, { value, date, source, origin: 'live', extra });
  params.push(date);
  const d = `$${params.length}`;
  // force = "revert to live": the user asked to drop their manual value.
  const query = `
    UPDATE latest_indicators SET ${sets.join(', ')}
    WHERE id = 1
      AND (${force ? 'TRUE' : 'FALSE'}
           OR ${ind.prefix}_origin IS DISTINCT FROM 'manual'
           OR ${ind.prefix}_observed_at IS NULL
           OR ${ind.prefix}_observed_at < ${d}::date)`;
  const res = await sql.query(query, params);
  return res.rowCount > 0 ? 'updated' : 'kept_manual';
}

/** Write a value typed in by a user. Always wins. */
export async function writeManual(key, { value, date, extra }) {
  const ind = INDICATORS[key];
  if (!ind) throw new Error(`Unknown indicator ${key}`);
  const { sets, params } = buildSet(ind, { value, date, source: 'Manual entry', origin: 'manual', extra });
  const res = await sql.query(`UPDATE latest_indicators SET ${sets.join(', ')} WHERE id = 1`, params);
  if (res.rowCount === 0) throw new Error('latest_indicators has no row with id = 1');
}

/** Next SNB meeting date ('YYYY-MM-DD'). Manual only. */
export async function writeNextMeeting(date) {
  const res = await sql.query(
    'UPDATE latest_indicators SET next_meeting_date = $1, next_meeting_updated_at = NOW() WHERE id = 1',
    [date]
  );
  if (res.rowCount === 0) throw new Error('latest_indicators has no row with id = 1');
}

/** The whole row, after making sure the provenance columns exist. */
export async function readRow() {
  await ensureSchema();
  const { rows } = await sql.query('SELECT * FROM latest_indicators WHERE id = 1');
  if (!rows.length) throw new Error('latest_indicators has no row with id = 1');
  return rows[0];
}

const num = v => (v === null || v === undefined || v === '' ? null : Number(v));

/**
 * Value + provenance + freshness badge of one indicator, read from the row.
 * Every reader route returns this as `meta`, so the card can show where the
 * number comes from and whether it can be trusted.
 */
export function readIndicator(row, key, now = new Date()) {
  const ind = INDICATORS[key];
  const value = num(row[ind.valueCol]);
  const observedAt = toDateString(row[`${ind.prefix}_observed_at`]);
  const updatedAt = row[ind.updatedCol] ? new Date(row[ind.updatedCol]).toISOString() : null;
  const origin = row[`${ind.prefix}_origin`] || null;
  const f = freshness({ value, observedAt, updatedAt, origin, maxAgeDays: ind.maxAgeDays }, now);
  return {
    value,
    meta: {
      key,
      label: ind.label,
      source: row[`${ind.prefix}_source`] || 'Unknown (written by an older version)',
      observedAt,
      updatedAt,
      hasLiveSource: ind.live,
      ...f,
    },
  };
}

export async function saveCronReport(report) {
  await sql.query(
    'UPDATE latest_indicators SET last_cron_run_at = NOW(), last_cron_report = $1 WHERE id = 1',
    [JSON.stringify(report)]
  );
}
