// Decide which badge an indicator gets: Live / Manual / Stale / Missing.
// Pure function (no DB, no imports) so it can be unit-tested and used anywhere.
//
// Age is measured from the OBSERVATION date (the date the value refers to), not
// from when we fetched it: a value fetched this morning can still be months old.
// Rows written by the old code have no observation date; for those we fall back
// to the write time, which makes them look fresher than they are, so they are
// also marked `legacy`.

const DAY_MS = 24 * 60 * 60 * 1000;

// Accepts 'YYYY-MM-DD', an ISO timestamp or a Date. Returns 'YYYY-MM-DD' or null.
export function toDateString(d) {
  if (d === null || d === undefined || d === '') return null;
  if (d instanceof Date) {
    if (Number.isNaN(d.getTime())) return null;
    // node-postgres turns a DATE column into a Date at LOCAL midnight, so read
    // the local parts back (toISOString would shift it by a day east of UTC).
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export function ageInDays(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const then = Date.parse(`${dateStr}T00:00:00Z`);
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.floor((today - then) / DAY_MS);
}

/**
 * @param {object} args
 * @param {number|null} args.value
 * @param {string|Date|null} args.observedAt
 * @param {string|Date|null} args.updatedAt
 * @param {'live'|'manual'|null} args.origin
 * @param {number} args.maxAgeDays
 * @param {Date} [now]
 * @returns {{ status: 'live'|'manual'|'stale'|'missing', origin: string, ageDays: number|null,
 *            maxAgeDays: number, legacy: boolean, reason: string }}
 */
export function freshness({ value, observedAt, updatedAt, origin, maxAgeDays }, now = new Date()) {
  const originOut = origin === 'live' || origin === 'manual' ? origin : 'unknown';
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { status: 'missing', origin: originOut, ageDays: null, maxAgeDays, legacy: false, reason: 'No value stored yet' };
  }

  const observed = toDateString(observedAt);
  const legacy = !observed;
  const ageDays = ageInDays(observed || toDateString(updatedAt), now);

  if (ageDays === null) {
    return { status: 'stale', origin: originOut, ageDays, maxAgeDays, legacy, reason: 'Date unknown' };
  }
  if (ageDays > maxAgeDays) {
    return {
      status: 'stale', origin: originOut, ageDays, maxAgeDays, legacy,
      reason: `Data is ${ageDays} days old (expected at most ${maxAgeDays})`,
    };
  }
  // Fresh. A value with no recorded origin was written by the old code: we can't
  // tell whether it was live, so call it manual (it needs a human to confirm it).
  const status = originOut === 'live' ? 'live' : 'manual';
  return {
    status, origin: originOut, ageDays, maxAgeDays, legacy,
    reason: originOut === 'unknown' ? 'Written by an older version, origin unknown' : '',
  };
}
