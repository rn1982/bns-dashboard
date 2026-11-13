// Time series of every indicator: table `indicator_history`, one row per
// (indicator, observation date, origin). Written by:
//   - the daily cron: the recent window of each live series (so revisions are picked up),
//   - /api/cron/backfill: everything since 2000, run once by hand,
//   - the manual form: one 'manual' point per saved value.
// `latest_indicators` stays the source of the CURRENT value (it holds the
// manual-vs-live rule, stances and the cron report); this table is for charts.
//
// Every function takes an optional `db` with a pg-style `query(text, params)`,
// so the SQL can be tested against a local Postgres. Default: @vercel/postgres.
import { sql } from '@vercel/postgres';

export const HISTORY_DDL = `
  CREATE TABLE IF NOT EXISTS indicator_history (
    indicator   TEXT             NOT NULL,
    observed_at DATE             NOT NULL,
    origin      TEXT             NOT NULL CHECK (origin IN ('live', 'manual')),
    value       DOUBLE PRECISION NOT NULL,
    source      TEXT,
    recorded_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    PRIMARY KEY (indicator, observed_at, origin)
  )`;

const CHUNK = 5000;

/**
 * Insert or update points. A point that already exists with the same value and
 * source is left alone, so re-running the cron every day changes nothing.
 * Returns the number of rows inserted or changed.
 */
export async function appendHistory(key, points, { origin, source }, db = sql) {
  // One row per date (the last one wins): ON CONFLICT can't touch a row twice in one statement.
  const byDate = new Map();
  for (const p of points) {
    if (p && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.value)) byDate.set(p.date, p.value);
  }
  const all = [...byDate.entries()];
  let written = 0;
  for (let i = 0; i < all.length; i += CHUNK) {
    const chunk = all.slice(i, i + CHUNK);
    const res = await db.query(
      `INSERT INTO indicator_history (indicator, observed_at, origin, value, source)
       SELECT $1, t.d, $2, t.v, $3 FROM unnest($4::date[], $5::float8[]) AS t(d, v)
       ON CONFLICT (indicator, observed_at, origin) DO UPDATE
         SET value = EXCLUDED.value, source = EXCLUDED.source, recorded_at = NOW()
         WHERE indicator_history.value IS DISTINCT FROM EXCLUDED.value
            OR indicator_history.source IS DISTINCT FROM EXCLUDED.source`,
      [key, origin, source, chunk.map(([d]) => d), chunk.map(([, v]) => v)]
    );
    written += res.rowCount;
  }
  return written;
}

/** Remove one point, e.g. the manual value the user reverted to live. */
export async function deleteHistoryPoint(key, date, origin = 'manual', db = sql) {
  const res = await db.query(
    'DELETE FROM indicator_history WHERE indicator = $1 AND observed_at = $2 AND origin = $3',
    [key, date, origin]
  );
  return res.rowCount;
}

/**
 * The series of one indicator between `from` and `to` (inclusive, 'YYYY-MM-DD').
 * When a date has both a manual and a live point, the manual one is shown: same
 * rule as latest_indicators, where a manual value wins until a NEWER live one arrives.
 * freq 'monthly' keeps the last observation of each month (for long daily series).
 */
export async function readHistory(key, { from, to, freq = 'raw' }, db = sql) {
  const best = `
    SELECT DISTINCT ON (observed_at) observed_at, value, origin, source
    FROM indicator_history
    WHERE indicator = $1 AND observed_at >= $2::date AND observed_at <= $3::date
    ORDER BY observed_at, (origin = 'manual') DESC`;
  const picked =
    freq === 'monthly'
      ? `SELECT DISTINCT ON (date_trunc('month', observed_at)) * FROM (${best}) b
         ORDER BY date_trunc('month', observed_at), observed_at DESC`
      : best;
  const { rows } = await db.query(
    `SELECT to_char(observed_at, 'YYYY-MM-DD') AS date, value, origin, source
     FROM (${picked}) p ORDER BY observed_at`,
    [key, from, to]
  );
  return rows.map(r => ({ date: r.date, value: Number(r.value), origin: r.origin, source: r.source }));
}

/** Number of points and date range per indicator (for the backfill report / debugging). */
export async function historySummary(db = sql) {
  const { rows } = await db.query(
    `SELECT indicator, COUNT(*)::int AS points,
            to_char(MIN(observed_at), 'YYYY-MM-DD') AS first,
            to_char(MAX(observed_at), 'YYYY-MM-DD') AS last
     FROM indicator_history GROUP BY indicator ORDER BY indicator`
  );
  return rows;
}
