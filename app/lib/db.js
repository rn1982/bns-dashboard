import { sql } from '@vercel/postgres';
import { INDICATORS } from './indicators';

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
export async function writeLive(key, { value, date, source, extra }) {
  const ind = INDICATORS[key];
  if (!ind) throw new Error(`Unknown indicator ${key}`);
  const { sets, params } = buildSet(ind, { value, date, source, origin: 'live', extra });
  params.push(date);
  const d = `$${params.length}`;
  const query = `
    UPDATE latest_indicators SET ${sets.join(', ')}
    WHERE id = 1
      AND (${ind.prefix}_origin IS DISTINCT FROM 'manual'
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

export async function saveCronReport(report) {
  await sql.query(
    'UPDATE latest_indicators SET last_cron_run_at = NOW(), last_cron_report = $1 WHERE id = 1',
    [JSON.stringify(report)]
  );
}
