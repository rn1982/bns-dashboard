// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stanceFromSeries } from './stance.js';

// Build a daily series from `start`, `days` long, where the rate is `before`
// until `changeOn` and `after` from then on.
function series(start, days, before, after = before, changeOn = null) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const date = d.toISOString().slice(0, 10);
    out.push({ date, value: changeOn && date >= changeOn ? after : before });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

test('flat daily series → hold_neutral', () => {
  assert.equal(stanceFromSeries(series('2026-07-01', 130, 2.0)).stance, 'hold_neutral');
});

test('25bp hike 30 days ago → hike_moderate (the old code said neutral)', () => {
  const s = series('2026-07-01', 130, 2.25, 2.5, '2026-10-08');
  assert.equal(stanceFromSeries(s).stance, 'hike_moderate');
});

test('25bp cut → cut_moderate, 75bp cut → cut_aggressive', () => {
  assert.equal(stanceFromSeries(series('2026-07-01', 130, 4.5, 4.25, '2026-10-01')).stance, 'cut_moderate');
  assert.equal(stanceFromSeries(series('2026-07-01', 130, 4.5, 3.75, '2026-10-01')).stance, 'cut_aggressive');
});

test('change older than 90 days is ignored', () => {
  const s = series('2026-01-01', 300, 2.0, 2.25, '2026-02-01');
  assert.equal(stanceFromSeries(s).stance, 'hold_neutral');
});

test('works with unsorted input and missing values', () => {
  const s = series('2026-07-01', 130, 2.25, 2.5, '2026-10-08').reverse();
  s.push({ date: '2026-08-01', value: NaN });
  assert.equal(stanceFromSeries(s).stance, 'hike_moderate');
});

test('too little history throws instead of guessing', () => {
  assert.throws(() => stanceFromSeries(series('2026-10-01', 30, 2.0)));
});
